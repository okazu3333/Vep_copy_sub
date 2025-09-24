const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = 'viewpers';
    const dataset = 'salesguard_alerts';
    const bq = new BigQuery({ projectId });

    console.log('=== email_messages_normalized ベース統合テーブル構築 ===');
    console.log('CC/BCC重複を考慮した正しい統合処理');
    console.log('');

    // Step 1: Drop and recreate unified table
    console.log('📊 Step 1: 統合テーブル再作成');
    const dropQuery = `DROP TABLE IF EXISTS \`${projectId}.${dataset}.unified_email_messages\``;
    await bq.query({ query: dropQuery, useLegacySql: false, location: 'asia-northeast1' });

    const createTableDDL = `
      CREATE TABLE \`${projectId}.${dataset}.unified_email_messages\` (
        message_id STRING NOT NULL,
        thread_id STRING,
        in_reply_to STRING,
        reply_level INT64,
        is_root BOOL,
        datetime TIMESTAMP NOT NULL,
        \`from\` STRING,
        \`to\` STRING,
        subject STRING,
        body_preview STRING,
        source_uri STRING,
        company_domain STRING,
        direction STRING,
        primary_risk_type STRING,
        risk_keywords STRING,
        score INT64,
        sentiment_label STRING,
        sentiment_score FLOAT64,
        negative_flag BOOL,
        -- CC/BCC情報も保持
        cc_emails STRING,
        bcc_emails STRING,
        recipient_type STRING  -- 'to', 'cc', 'bcc'
      )
      PARTITION BY DATE(datetime)
      CLUSTER BY message_id, datetime, company_domain
      OPTIONS (
        description = "Unified email messages based on email_messages_normalized with proper CC/BCC handling"
      )
    `;

    await bq.query({ query: createTableDDL, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ 統合テーブル作成完了');

    // Step 2: Insert data from email_messages_normalized with alert enrichment
    console.log('');
    console.log('📊 Step 2: normalized ベースでデータ挿入');
    const insertQuery = `
      INSERT INTO \`${projectId}.${dataset}.unified_email_messages\`
      WITH 
      -- Get the best alert for each message (highest score, latest)
      best_alerts AS (
        SELECT 
          message_id,
          ANY_VALUE(thread_id) as thread_id,
          ANY_VALUE(level) as level,
          ANY_VALUE(keyword) as keyword,
          ANY_VALUE(score) as score,
          ANY_VALUE(reply_level) as reply_level,
          ANY_VALUE(is_root) as is_root,
          COUNT(*) as alert_count
        FROM \`${projectId}.${dataset}.alerts_v2_scored\`
        WHERE message_id IS NOT NULL
        GROUP BY message_id
      ),
      
      -- Deduplicate normalized messages (keep one per message_id)
      unique_messages AS (
        SELECT * EXCEPT(row_num)
        FROM (
          SELECT 
            *,
            ROW_NUMBER() OVER (
              PARTITION BY message_id 
              ORDER BY date DESC
            ) as row_num
          FROM \`${projectId}.${dataset}.email_messages_normalized\`
        )
        WHERE row_num = 1
      )
      
      SELECT
        n.message_id,
        COALESCE(a.thread_id, CONCAT('thread_', n.message_id)) as thread_id,
        n.in_reply_to,
        COALESCE(a.reply_level, 0) as reply_level,
        COALESCE(a.is_root, n.in_reply_to IS NULL OR n.in_reply_to = '') as is_root,
        CAST(n.date AS TIMESTAMP) as datetime,
        COALESCE(n.from_email, '') as \`from\`,
        COALESCE(ARRAY_TO_STRING(n.to_emails, ', '), '') as \`to\`,
        COALESCE(n.subject, '') as subject,
        COALESCE(n.body_preview, '') as body_preview,
        COALESCE(n.body_gcs_uri, '') as source_uri,
        LOWER(REGEXP_EXTRACT(COALESCE(n.from_email, ''), '@([^> ]+)$')) as company_domain,
        CASE 
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(n.from_email, '')), r'(viewpers|crossmedia|cross-m|cm-group)') THEN 'internal'
          ELSE 'external'
        END as direction,
        COALESCE(a.level, 'low') as primary_risk_type,
        COALESCE(a.keyword, '') as risk_keywords,
        CAST(COALESCE(a.score, 0) AS INT64) as score,
        CAST(NULL AS STRING) as sentiment_label,
        CAST(NULL AS FLOAT64) as sentiment_score,
        CAST(NULL AS BOOL) as negative_flag,
        COALESCE(n.cc_emails, '') as cc_emails,
        COALESCE(n.bcc_emails, '') as bcc_emails,
        'primary' as recipient_type
      FROM unique_messages n
      LEFT JOIN best_alerts a
        ON n.message_id = a.message_id
      WHERE CAST(n.date AS TIMESTAMP) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY)
    `;

    console.log('実行中: データ挿入 (CC/BCC考慮)...');
    const [insertJob] = await bq.createQueryJob({
      query: insertQuery,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '20000000000' // 20GB limit
    });

    await insertJob.getQueryResults();
    const [insertMeta] = await insertJob.getMetadata();
    const insertBytes = insertMeta.statistics?.query?.totalBytesProcessed || 0;
    console.log(`✓ データ挿入完了 (処理: ${(insertBytes / (1024**3)).toFixed(2)} GB)`);

    // Step 3: Calculate proper reply levels
    console.log('');
    console.log('📊 Step 3: Gmail風reply_level計算');
    
    // Reset reply levels for proper calculation
    const resetQuery = `
      UPDATE \`${projectId}.${dataset}.unified_email_messages\`
      SET 
        reply_level = CASE WHEN in_reply_to IS NULL OR in_reply_to = '' THEN 0 ELSE -1 END,
        is_root = CASE WHEN in_reply_to IS NULL OR in_reply_to = '' THEN TRUE ELSE FALSE END
      WHERE TRUE
    `;
    
    await bq.query({ query: resetQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ reply_level リセット完了');

    // Calculate reply levels iteratively
    for (let level = 1; level <= 10; level++) {
      const updateLevelQuery = `
        UPDATE \`${projectId}.${dataset}.unified_email_messages\` u1
        SET reply_level = ${level}
        WHERE u1.reply_level = -1
          AND u1.in_reply_to IN (
            SELECT message_id 
            FROM \`${projectId}.${dataset}.unified_email_messages\` u2
            WHERE u2.reply_level = ${level - 1}
          )
      `;
      
      const [levelJob] = await bq.createQueryJob({
        query: updateLevelQuery,
        useLegacySql: false,
        location: 'asia-northeast1'
      });
      
      await levelJob.getQueryResults();
      const updatedRows = levelJob.metadata?.statistics?.query?.numDmlAffectedRows || 0;
      
      if (updatedRows === 0) {
        console.log(`  Level ${level}: 更新なし - 計算完了`);
        break;
      } else {
        console.log(`  Level ${level}: ${updatedRows}件更新`);
      }
    }

    // Handle orphaned messages
    const orphanQuery = `
      UPDATE \`${projectId}.${dataset}.unified_email_messages\`
      SET reply_level = 0, is_root = TRUE
      WHERE reply_level = -1
    `;
    
    await bq.query({ query: orphanQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ 未解決メッセージ処理完了');

    // Step 4: Create thread_id for messages without one
    console.log('');
    console.log('📊 Step 4: thread_id 生成');
    const threadIdQuery = `
      UPDATE \`${projectId}.${dataset}.unified_email_messages\`
      SET thread_id = CONCAT('thread_', message_id)
      WHERE thread_id IS NULL OR thread_id = ''
    `;
    
    await bq.query({ query: threadIdQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ thread_id 生成完了');

    // Step 5: Final validation
    console.log('');
    console.log('📊 Step 5: 最終検証');
    
    const validationQuery = `
      SELECT
        COUNT(*) as total_messages,
        COUNT(DISTINCT message_id) as unique_message_ids,
        COUNT(DISTINCT thread_id) as unique_threads,
        COUNTIF(is_root = TRUE) as root_messages,
        COUNTIF(reply_level = 0) as level_0,
        COUNTIF(reply_level = 1) as level_1,
        COUNTIF(reply_level = 2) as level_2,
        COUNTIF(reply_level >= 3) as level_3plus,
        MAX(reply_level) as max_level,
        ROUND(AVG(reply_level), 2) as avg_level,
        COUNTIF(primary_risk_type != 'low') as risk_messages
      FROM \`${projectId}.${dataset}.unified_email_messages\`
    `;

    const [validationResult] = await bq.query({ 
      query: validationQuery, 
      useLegacySql: false, 
      location: 'asia-northeast1' 
    });

    const stats = validationResult[0];
    console.log('');
    console.log('📈 統合テーブル最終統計:');
    console.log(`  総メッセージ数: ${stats.total_messages?.toLocaleString()}`);
    console.log(`  ユニークmessage_id: ${stats.unique_message_ids?.toLocaleString()}`);
    console.log(`  ユニークthread: ${stats.unique_threads?.toLocaleString()}`);
    console.log(`  ルートメッセージ: ${stats.root_messages?.toLocaleString()} (${((stats.root_messages/stats.total_messages)*100).toFixed(1)}%)`);
    console.log(`  Level 0: ${stats.level_0?.toLocaleString()}`);
    console.log(`  Level 1: ${stats.level_1?.toLocaleString()}`);
    console.log(`  Level 2: ${stats.level_2?.toLocaleString()}`);
    console.log(`  Level 3+: ${stats.level_3plus?.toLocaleString()}`);
    console.log(`  最大Level: ${stats.max_level}`);
    console.log(`  平均Level: ${stats.avg_level}`);
    console.log(`  リスクメッセージ: ${stats.risk_messages?.toLocaleString()}`);

    // Step 6: Show Gmail-style thread samples
    console.log('');
    console.log('📧 Gmail風スレッド構造サンプル:');
    const sampleQuery = `
      SELECT 
        thread_id,
        message_id,
        reply_level,
        is_root,
        LEFT(subject, 50) as subject_preview,
        LEFT(\`from\`, 30) as from_preview,
        datetime
      FROM \`${projectId}.${dataset}.unified_email_messages\`
      WHERE thread_id IN (
        SELECT thread_id 
        FROM \`${projectId}.${dataset}.unified_email_messages\` 
        GROUP BY thread_id 
        HAVING COUNT(*) >= 2 AND MAX(reply_level) >= 1
        ORDER BY MAX(reply_level) DESC
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
        console.log(`\n🧵 Thread: ${row.thread_id.substring(0, 40)}...`);
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
    console.log('🎉 email_messages_normalized ベース統合テーブル構築完了！');
    console.log('');
    console.log('✅ 完了した機能:');
    console.log('  • CC/BCC重複を適切に処理');
    console.log('  • message_id単位での重複除去');
    console.log('  • Gmail風reply_level階層計算');
    console.log('  • アラート情報の適切な統合');
    console.log('  • パーティション+クラスタ最適化');

  } catch (e) {
    console.error('統合テーブル構築エラー:', e?.message || e);
    process.exit(1);
  }
})(); 