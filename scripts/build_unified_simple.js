const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = 'viewpers';
    const dataset = 'salesguard_alerts';
    const bq = new BigQuery({ projectId });

    console.log('=== 統合テーブル構築 (簡易版) ===');

    // Step 1: Drop and recreate table to ensure clean state
    console.log('📊 Step 1: テーブル再作成');
    
    const dropTableDDL = `DROP TABLE IF EXISTS \`${projectId}.${dataset}.unified_email_messages\``;
    await bq.query({ query: dropTableDDL, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ 既存テーブル削除完了');

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
        negative_flag BOOL
      )
      PARTITION BY DATE(datetime)
      CLUSTER BY thread_id, datetime, primary_risk_type, company_domain
    `;

    await bq.query({ query: createTableDDL, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ unified_email_messages テーブル作成完了');

    // Step 2: Simple insert from alerts_v2_scored only
    console.log('📊 Step 2: alerts_v2_scored からの基本データ挿入');
    const simpleInsertQuery = `
      INSERT INTO \`${projectId}.${dataset}.unified_email_messages\`
      (
        message_id,
        thread_id,
        in_reply_to,
        reply_level,
        is_root,
        datetime,
        \`from\`,
        \`to\`,
        subject,
        body_preview,
        source_uri,
        company_domain,
        direction,
        primary_risk_type,
        risk_keywords,
        score,
        sentiment_label,
        sentiment_score,
        negative_flag
      )
      SELECT
        s.message_id,
        s.thread_id,
        CAST(NULL AS STRING) as in_reply_to,
        COALESCE(s.reply_level, 0) as reply_level,
        COALESCE(s.is_root, FALSE) as is_root,
        s.datetime,
        COALESCE(s.person, '') as \`from\`,
        '' as \`to\`,
        COALESCE(s.description, '') as subject,
        COALESCE(s.messageBody, '') as body_preview,
        COALESCE(s.source_file, '') as source_uri,
        LOWER(REGEXP_EXTRACT(COALESCE(s.person, ''), '@([^> ]+)$')) as company_domain,
        CASE 
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(s.person, '')), r'(viewpers|crossmedia|cm-group)') THEN 'internal'
          ELSE 'external'
        END as direction,
        COALESCE(s.level, 'medium') as primary_risk_type,
        COALESCE(s.keyword, '') as risk_keywords,
        CAST(COALESCE(s.score, 0) AS INT64) as score,
        CAST(NULL AS STRING) as sentiment_label,
        CAST(NULL AS FLOAT64) as sentiment_score,
        CAST(NULL AS BOOL) as negative_flag
      FROM \`${projectId}.${dataset}.alerts_v2_scored\` s
      WHERE s.message_id IS NOT NULL
        AND s.datetime IS NOT NULL
        AND DATE(s.datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 180 DAY)
      LIMIT 1000
    `;

    console.log('実行中: 基本データ挿入 (1000件限定)...');
    const [insertJob] = await bq.createQueryJob({
      query: simpleInsertQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    await insertJob.getQueryResults();
    console.log('✓ 基本データ挿入完了');

    // Step 3: Validation
    console.log('📊 Step 3: データ検証');
    const validationQuery = `
      SELECT
        COUNT(*) as total_messages,
        COUNTIF(reply_level IS NOT NULL) as reply_level_filled,
        COUNTIF(is_root IS NOT NULL) as is_root_filled,
        COUNTIF(thread_id IS NOT NULL) as thread_id_filled,
        MAX(reply_level) as max_reply_level,
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
    console.log('📈 統合テーブル統計:');
    console.log(`  総メッセージ数: ${stats.total_messages?.toLocaleString()}`);
    console.log(`  reply_level有り: ${stats.reply_level_filled?.toLocaleString()} (${((stats.reply_level_filled/stats.total_messages)*100).toFixed(1)}%)`);
    console.log(`  is_root有り: ${stats.is_root_filled?.toLocaleString()} (${((stats.is_root_filled/stats.total_messages)*100).toFixed(1)}%)`);
    console.log(`  thread_id有り: ${stats.thread_id_filled?.toLocaleString()} (${((stats.thread_id_filled/stats.total_messages)*100).toFixed(1)}%)`);
    console.log(`  最大reply_level: ${stats.max_reply_level}`);
    console.log(`  ユニークスレッド: ${stats.unique_threads?.toLocaleString()}`);

    // Sample thread structure
    const sampleQuery = `
      SELECT 
        thread_id,
        message_id,
        reply_level,
        is_root,
        LEFT(subject, 40) as subject_preview
      FROM \`${projectId}.${dataset}.unified_email_messages\`
      WHERE thread_id IS NOT NULL
      ORDER BY thread_id, reply_level, datetime
      LIMIT 10
    `;

    const [sampleResult] = await bq.query({ 
      query: sampleQuery, 
      useLegacySql: false, 
      location: 'asia-northeast1' 
    });

    console.log('');
    console.log('📧 スレッド構造サンプル:');
    let currentThread = null;
    sampleResult.forEach(row => {
      if (row.thread_id !== currentThread) {
        currentThread = row.thread_id;
        console.log(`\n🧵 Thread: ${row.thread_id.substring(0, 30)}...`);
      }
      const indent = '  '.repeat(Math.min(row.reply_level || 0, 5));
      const rootFlag = row.is_root ? '📧' : '↳';
      console.log(`${indent}${rootFlag} L${row.reply_level}: ${row.subject_preview}...`);
    });

    console.log('');
    console.log('🎉 基本統合テーブル構築完了！');

  } catch (e) {
    console.error('統合テーブル構築エラー:', e?.message || e);
    process.exit(1);
  }
})(); 