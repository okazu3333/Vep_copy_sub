const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = 'viewpers';
    const dataset = 'salesguard_alerts';
    const bq = new BigQuery({ projectId });

    console.log('=== Gmail風reply_level計算開始 (修正版) ===');
    console.log('in_reply_toヘッダーから階層構造を再計算');
    console.log('');

    // Step 1: Analyze current data
    console.log('📊 Step 1: 現在のデータ分析');
    const analysisQuery = `
      SELECT
        COUNT(*) as total_messages,
        COUNTIF(in_reply_to IS NOT NULL AND in_reply_to != '') as has_in_reply_to,
        COUNT(DISTINCT thread_id) as unique_threads,
        MAX(reply_level) as current_max_level,
        COUNTIF(reply_level > 0) as current_replies
      FROM \`${projectId}.${dataset}.unified_email_messages\`
    `;

    const [analysisResult] = await bq.query({ 
      query: analysisQuery, 
      useLegacySql: false, 
      location: 'asia-northeast1' 
    });

    const analysis = analysisResult[0];
    console.log('📈 現在のデータ状況:');
    console.log(`  総メッセージ数: ${analysis.total_messages?.toLocaleString()}`);
    console.log(`  in_reply_to有り: ${analysis.has_in_reply_to?.toLocaleString()} (${((analysis.has_in_reply_to/analysis.total_messages)*100).toFixed(1)}%)`);
    console.log(`  ユニークスレッド: ${analysis.unique_threads?.toLocaleString()}`);
    console.log(`  現在の最大Level: ${analysis.current_max_level}`);
    console.log(`  現在の返信数: ${analysis.current_replies?.toLocaleString()}`);

    // Step 2: Update in_reply_to using MERGE to avoid duplicates
    console.log('');
    console.log('📊 Step 2: in_reply_to を安全に更新 (MERGE使用)');
    const mergeInReplyToQuery = `
      MERGE \`${projectId}.${dataset}.unified_email_messages\` u
      USING (
        SELECT DISTINCT
          message_id,
          in_reply_to
        FROM \`${projectId}.${dataset}.email_messages_normalized\`
        WHERE in_reply_to IS NOT NULL AND in_reply_to != ''
      ) n
      ON u.message_id = n.message_id
      WHEN MATCHED THEN
        UPDATE SET in_reply_to = n.in_reply_to
    `;

    const [mergeJob] = await bq.createQueryJob({
      query: mergeInReplyToQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    await mergeJob.getQueryResults();
    console.log('✓ in_reply_to 更新完了');

    // Step 3: Calculate reply levels using iterative approach (safer than recursive)
    console.log('');
    console.log('📊 Step 3: 階層構造計算 (反復アプローチ)');
    
    // Create temporary table for level calculation
    const createTempQuery = `
      CREATE OR REPLACE TABLE \`${projectId}.${dataset}.temp_message_levels\` AS
      SELECT
        message_id,
        thread_id,
        in_reply_to,
        datetime,
        CASE 
          WHEN in_reply_to IS NULL OR in_reply_to = '' THEN 0
          ELSE -1  -- Will be calculated
        END as reply_level,
        CASE 
          WHEN in_reply_to IS NULL OR in_reply_to = '' THEN TRUE
          ELSE FALSE
        END as is_root
      FROM \`${projectId}.${dataset}.unified_email_messages\`
      WHERE thread_id IS NOT NULL
    `;

    await bq.query({ query: createTempQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ 一時テーブル作成完了');

    // Iteratively calculate reply levels (up to 10 levels)
    for (let level = 1; level <= 10; level++) {
      console.log(`  Level ${level} 計算中...`);
      
      const updateLevelQuery = `
        UPDATE \`${projectId}.${dataset}.temp_message_levels\` t
        SET reply_level = ${level}
        WHERE t.reply_level = -1
          AND t.in_reply_to IN (
            SELECT message_id 
            FROM \`${projectId}.${dataset}.temp_message_levels\` 
            WHERE reply_level = ${level - 1}
          )
      `;

      const [levelJob] = await bq.createQueryJob({
        query: updateLevelQuery,
        useLegacySql: false,
        location: 'asia-northeast1'
      });

      const [levelResult] = await levelJob.getQueryResults();
      const updatedRows = levelJob.metadata?.statistics?.query?.numDmlAffectedRows || 0;
      
      if (updatedRows === 0) {
        console.log(`  Level ${level}: 更新なし - 計算完了`);
        break;
      } else {
        console.log(`  Level ${level}: ${updatedRows}件更新`);
      }
    }

    // Handle remaining messages that couldn't be resolved
    const handleOrphansQuery = `
      UPDATE \`${projectId}.${dataset}.temp_message_levels\`
      SET reply_level = 0, is_root = TRUE
      WHERE reply_level = -1
    `;

    await bq.query({ query: handleOrphansQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ 未解決メッセージをLevel 0に設定');

    // Step 4: Update unified table with calculated levels
    console.log('');
    console.log('📊 Step 4: 計算結果を統合テーブルに反映');
    const updateUnifiedQuery = `
      MERGE \`${projectId}.${dataset}.unified_email_messages\` u
      USING \`${projectId}.${dataset}.temp_message_levels\` t
      ON u.message_id = t.message_id
      WHEN MATCHED THEN
        UPDATE SET 
          reply_level = t.reply_level,
          is_root = t.is_root
    `;

    const [updateJob] = await bq.createQueryJob({
      query: updateUnifiedQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    await updateJob.getQueryResults();
    console.log('✓ 統合テーブル更新完了');

    // Step 5: Clean up
    const dropTempQuery = `DROP TABLE \`${projectId}.${dataset}.temp_message_levels\``;
    await bq.query({ query: dropTempQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ 一時テーブル削除完了');

    // Step 6: Final validation
    console.log('');
    console.log('📊 Step 6: Gmail風階層構造検証');
    
    const validationQuery = `
      SELECT
        COUNT(*) as total_messages,
        COUNTIF(is_root = TRUE) as root_messages,
        COUNTIF(reply_level = 0) as level_0_messages,
        COUNTIF(reply_level = 1) as level_1_messages,
        COUNTIF(reply_level = 2) as level_2_messages,
        COUNTIF(reply_level >= 3) as level_3plus_messages,
        MAX(reply_level) as max_reply_level,
        ROUND(AVG(reply_level), 2) as avg_reply_level,
        COUNT(DISTINCT thread_id) as unique_threads
      FROM \`${projectId}.${dataset}.unified_email_messages\`
    `;

    const [validationResult] = await bq.query({ 
      query: validationQuery, 
      useLegacySql: false, 
      location: 'asia-northeast1' 
    });

    const stats = validationResult[0];
    console.log('');
    console.log('📈 Gmail風階層構造統計:');
    console.log(`  総メッセージ数: ${stats.total_messages?.toLocaleString()}`);
    console.log(`  ルートメッセージ: ${stats.root_messages?.toLocaleString()} (${((stats.root_messages/stats.total_messages)*100).toFixed(1)}%)`);
    console.log(`  Level 0: ${stats.level_0_messages?.toLocaleString()}`);
    console.log(`  Level 1: ${stats.level_1_messages?.toLocaleString()}`);
    console.log(`  Level 2: ${stats.level_2_messages?.toLocaleString()}`);
    console.log(`  Level 3+: ${stats.level_3plus_messages?.toLocaleString()}`);
    console.log(`  最大reply_level: ${stats.max_reply_level}`);
    console.log(`  平均reply_level: ${stats.avg_reply_level}`);
    console.log(`  ユニークスレッド: ${stats.unique_threads?.toLocaleString()}`);

    // Step 7: Show Gmail-style thread samples
    console.log('');
    console.log('📧 Gmail風スレッド構造サンプル:');
    const sampleQuery = `
      SELECT 
        thread_id,
        message_id,
        reply_level,
        is_root,
        LEFT(subject, 45) as subject_preview,
        LEFT(\`from\`, 25) as from_preview,
        datetime
      FROM \`${projectId}.${dataset}.unified_email_messages\`
      WHERE thread_id IN (
        SELECT thread_id 
        FROM \`${projectId}.${dataset}.unified_email_messages\` 
        WHERE thread_id IS NOT NULL
        GROUP BY thread_id 
        HAVING COUNT(*) >= 3 AND MAX(reply_level) >= 1
        ORDER BY MAX(reply_level) DESC
        LIMIT 2
      )
      ORDER BY thread_id, reply_level, datetime
      LIMIT 15
    `;

    const [sampleResult] = await bq.query({ 
      query: sampleQuery, 
      useLegacySql: false, 
      location: 'asia-northeast1' 
    });

    let currentThread = null;
    sampleResult.forEach(row => {
      if (row.thread_id !== currentThread) {
        currentThread = row.thread_id;
        console.log(`\n🧵 Thread: ${row.thread_id.substring(0, 35)}...`);
      }
      const indent = '  '.repeat(Math.min(row.reply_level || 0, 5));
      const rootFlag = row.is_root ? '📧' : '↳';
      const time = new Date(row.datetime?.value || row.datetime).toLocaleString('ja-JP', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      console.log(`${indent}${rootFlag} L${row.reply_level}: ${row.subject_preview}...`);
      console.log(`${indent}   ${row.from_preview} (${time})`);
    });

    console.log('');
    console.log('🎉 Gmail風reply_level計算完了！');
    console.log('');
    console.log('✅ 完了した機能:');
    console.log('  • in_reply_toヘッダーから階層構造を正確に計算');
    console.log('  • 真のGmail風スレッド表示 (L0→L1→L2...)');
    console.log('  • is_root の正確な判定');
    console.log('  • 反復アプローチによる安全な計算');
    console.log('');
    console.log('🚀 次のステップ:');
    console.log('  • 互換VIEW更新');
    console.log('  • UI でのGmail風階層表示確認');

  } catch (e) {
    console.error('reply_level計算エラー:', e?.message || e);
    process.exit(1);
  }
})(); 