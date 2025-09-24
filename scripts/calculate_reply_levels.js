const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = 'viewpers';
    const dataset = 'salesguard_alerts';
    const bq = new BigQuery({ projectId });

    console.log('=== Gmail風reply_level計算開始 ===');
    console.log('in_reply_toヘッダーから階層構造を再計算');
    console.log('');

    // Step 1: Analyze current in_reply_to data
    console.log('📊 Step 1: in_reply_to データ分析');
    const analysisQuery = `
      SELECT
        COUNT(*) as total_messages,
        COUNTIF(n.in_reply_to IS NOT NULL AND n.in_reply_to != '') as has_in_reply_to,
        COUNT(DISTINCT u.thread_id) as unique_threads,
        COUNT(DISTINCT n.in_reply_to) as unique_reply_targets
      FROM \`${projectId}.${dataset}.unified_email_messages\` u
      LEFT JOIN \`${projectId}.${dataset}.email_messages_normalized\` n
        ON u.message_id = n.message_id
    `;

    const [analysisResult] = await bq.query({ 
      query: analysisQuery, 
      useLegacySql: false, 
      location: 'asia-northeast1' 
    });

    const analysis = analysisResult[0];
    console.log('📈 in_reply_to 分析結果:');
    console.log(`  総メッセージ数: ${analysis.total_messages?.toLocaleString()}`);
    console.log(`  in_reply_to有り: ${analysis.has_in_reply_to?.toLocaleString()} (${((analysis.has_in_reply_to/analysis.total_messages)*100).toFixed(1)}%)`);
    console.log(`  ユニークスレッド: ${analysis.unique_threads?.toLocaleString()}`);
    console.log(`  ユニーク返信先: ${analysis.unique_reply_targets?.toLocaleString()}`);

    // Step 2: Update in_reply_to in unified table
    console.log('');
    console.log('📊 Step 2: unified_email_messages に in_reply_to を更新');
    const updateInReplyToQuery = `
      UPDATE \`${projectId}.${dataset}.unified_email_messages\` u
      SET in_reply_to = n.in_reply_to
      FROM \`${projectId}.${dataset}.email_messages_normalized\` n
      WHERE u.message_id = n.message_id
        AND n.in_reply_to IS NOT NULL
        AND n.in_reply_to != ''
    `;

    const [updateJob] = await bq.createQueryJob({
      query: updateInReplyToQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    await updateJob.getQueryResults();
    console.log('✓ in_reply_to 更新完了');

    // Step 3: Calculate reply levels using recursive CTE
    console.log('');
    console.log('📊 Step 3: 階層構造計算 (再帰CTE)');
    
    // First, create a temporary table with calculated reply levels
    const calculateReplyLevelsQuery = `
      CREATE OR REPLACE TABLE \`${projectId}.${dataset}.temp_reply_levels\` AS
      WITH RECURSIVE thread_hierarchy AS (
        -- Base case: root messages (no in_reply_to)
        SELECT
          message_id,
          thread_id,
          in_reply_to,
          datetime,
          0 as reply_level,
          TRUE as is_root,
          ARRAY[message_id] as path
        FROM \`${projectId}.${dataset}.unified_email_messages\`
        WHERE (in_reply_to IS NULL OR in_reply_to = '')
          AND thread_id IS NOT NULL
        
        UNION ALL
        
        -- Recursive case: replies
        SELECT
          u.message_id,
          u.thread_id,
          u.in_reply_to,
          u.datetime,
          h.reply_level + 1 as reply_level,
          FALSE as is_root,
          ARRAY_CONCAT(h.path, [u.message_id]) as path
        FROM \`${projectId}.${dataset}.unified_email_messages\` u
        JOIN thread_hierarchy h
          ON u.in_reply_to = h.message_id
          AND u.thread_id = h.thread_id
        WHERE u.in_reply_to IS NOT NULL 
          AND u.in_reply_to != ''
          AND ARRAY_LENGTH(h.path) < 10  -- Prevent infinite loops
      )
      SELECT
        message_id,
        thread_id,
        reply_level,
        is_root
      FROM thread_hierarchy
    `;

    console.log('実行中: 階層構造計算...');
    const [hierarchyJob] = await bq.createQueryJob({
      query: calculateReplyLevelsQuery,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '10000000000' // 10GB limit
    });

    await hierarchyJob.getQueryResults();
    console.log('✓ 階層構造計算完了');

    // Step 4: Update unified table with calculated reply levels
    console.log('');
    console.log('📊 Step 4: reply_level と is_root を更新');
    const updateReplyLevelsQuery = `
      UPDATE \`${projectId}.${dataset}.unified_email_messages\` u
      SET 
        reply_level = t.reply_level,
        is_root = t.is_root
      FROM \`${projectId}.${dataset}.temp_reply_levels\` t
      WHERE u.message_id = t.message_id
    `;

    const [updateReplyJob] = await bq.createQueryJob({
      query: updateReplyLevelsQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    await updateReplyJob.getQueryResults();
    console.log('✓ reply_level/is_root 更新完了');

    // Step 5: Clean up temporary table
    const dropTempQuery = `DROP TABLE \`${projectId}.${dataset}.temp_reply_levels\``;
    await bq.query({ query: dropTempQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ 一時テーブル削除完了');

    // Step 6: Validation and results
    console.log('');
    console.log('📊 Step 6: Gmail風階層構造検証');
    
    const validationQuery = `
      SELECT
        COUNT(*) as total_messages,
        COUNTIF(reply_level IS NOT NULL) as reply_level_filled,
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
    console.log(`  reply_level有り: ${stats.reply_level_filled?.toLocaleString()} (${((stats.reply_level_filled/stats.total_messages)*100).toFixed(1)}%)`);
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
        LEFT(subject, 50) as subject_preview,
        \`from\`,
        datetime
      FROM \`${projectId}.${dataset}.unified_email_messages\`
      WHERE thread_id IN (
        SELECT thread_id 
        FROM \`${projectId}.${dataset}.unified_email_messages\` 
        WHERE thread_id IS NOT NULL
        GROUP BY thread_id 
        HAVING COUNT(*) >= 3 AND MAX(reply_level) >= 2
        LIMIT 3
      )
      ORDER BY thread_id, reply_level, datetime
      LIMIT 20
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
        console.log(`\n🧵 Thread: ${row.thread_id.substring(0, 30)}...`);
      }
      const indent = '  '.repeat(Math.min(row.reply_level || 0, 5));
      const rootFlag = row.is_root ? '📧' : '↳';
      const from = row.from ? row.from.substring(0, 25) : 'Unknown';
      const time = new Date(row.datetime?.value || row.datetime).toLocaleString('ja-JP', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      console.log(`${indent}${rootFlag} L${row.reply_level}: ${row.subject_preview}...`);
      console.log(`${indent}   ${from} (${time})`);
    });

    console.log('');
    console.log('🎉 Gmail風reply_level計算完了！');
    console.log('');
    console.log('✅ 完了した機能:');
    console.log('  • in_reply_toヘッダーから階層構造を再計算');
    console.log('  • 真のGmail風スレッド表示 (L0→L1→L2...)');
    console.log('  • is_root の正確な判定');
    console.log('  • 再帰CTE による無限ループ防止');
    console.log('');
    console.log('🚀 次のステップ:');
    console.log('  • 互換VIEW更新');
    console.log('  • UI でのGmail風階層表示確認');
    console.log('  • 左右分割 + 階層インデント表示');

  } catch (e) {
    console.error('reply_level計算エラー:', e?.message || e);
    process.exit(1);
  }
})(); 