const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const dataset = 'salesguard_alerts';
    const shard = Number(process.argv[2] || 0);
    const start = process.argv[3]; // 'YYYY-MM-DD'
    const end = process.argv[4];   // 'YYYY-MM-DD'
    if (!start || !end) {
      console.error('Usage: node scripts/run_one_unified_task.js <shard:int> <start:YYYY-MM-DD> <end:YYYY-MM-DD>');
      process.exit(1);
    }

    const bq = new BigQuery({ projectId });
    const target = `\`${projectId}.${dataset}.unified_email_messages\``;
    const stage = `\`${projectId}.${dataset}.unified_stage_shard_${shard}_${start.replace(/-/g,'')}_${end.replace(/-/g,'')}\``;
    const label = `[Shard ${shard} ${start}..${end}]`;

    const selectSourceMinimal = `
SELECT
  m.message_id,
  CAST(m.thread_id AS STRING) AS thread_id,
  n.in_reply_to,
  CAST(m.reply_level AS INT64) AS reply_level,
  CAST(m.is_root AS BOOL) AS is_root,
  TIMESTAMP(m.date) AS datetime,
  m.from_email AS \`from\`,
  ARRAY_TO_STRING(m.to_emails, ', ') AS \`to\`,
  m.subject AS subject,
  m.body_preview AS body_preview,
  m.body_gcs_uri AS source_uri,
  LOWER(REGEXP_EXTRACT(COALESCE(m.from_email, ''), '@([^> ]+)$')) AS company_domain,
  CASE WHEN LOWER(REGEXP_EXTRACT(COALESCE(m.from_email, ''), '@([^> ]+)$')) IN (
         SELECT LOWER(domain) FROM \`${projectId}.${dataset}.companies\` WHERE is_internal = TRUE
       ) THEN 'internal' ELSE 'external' END AS direction,
  CAST(NULL AS STRING) AS primary_risk_type,
  CAST(NULL AS STRING) AS risk_keywords,
  CAST(NULL AS INT64) AS score
FROM \`${projectId}.${dataset}.email_messages_threaded_v1\` m
LEFT JOIN \`${projectId}.${dataset}.email_messages_normalized\` n
  ON n.message_id = m.message_id
WHERE MOD(ABS(FARM_FINGERPRINT(COALESCE(CAST(m.thread_id AS STRING), m.message_id))), 16) = ${shard}
  AND DATE(TIMESTAMP(m.date)) >= DATE('${start}') AND DATE(TIMESTAMP(m.date)) < DATE('${end}')`;

    const mergeFromStage = (stageName) => `
MERGE ${target} T
USING (SELECT * FROM ${stageName}) S
ON T.message_id = S.message_id
WHEN MATCHED THEN UPDATE SET
  T.thread_id = S.thread_id,
  T.in_reply_to = S.in_reply_to,
  T.reply_level = S.reply_level,
  T.is_root = S.is_root,
  T.datetime = S.datetime,
  T.\`from\` = S.\`from\`,
  T.\`to\` = S.\`to\`,
  T.subject = S.subject,
  T.body_preview = S.body_preview,
  T.source_uri = S.source_uri,
  T.company_domain = S.company_domain,
  T.direction = S.direction,
  T.primary_risk_type = COALESCE(S.primary_risk_type, T.primary_risk_type),
  T.risk_keywords = COALESCE(S.risk_keywords, T.risk_keywords),
  T.score = COALESCE(S.score, T.score)
WHEN NOT MATCHED THEN INSERT (message_id, thread_id, in_reply_to, reply_level, is_root, datetime, \`from\`, \`to\`, subject, body_preview, source_uri, company_domain, direction, primary_risk_type, risk_keywords, score)
VALUES (S.message_id, S.thread_id, S.in_reply_to, S.reply_level, S.is_root, S.datetime, S.\`from\`, S.\`to\`, S.subject, S.body_preview, S.source_uri, S.company_domain, S.direction, S.primary_risk_type, S.risk_keywords, S.score)`;

    console.log(`${label} CTAS stage (simple)...`);
    const ctas = `CREATE OR REPLACE TABLE ${stage} AS ${selectSourceMinimal}`;
    let [job] = await bq.createQueryJob({ query: ctas, useLegacySql: false, maximumBytesBilled: '40000000000' });
    await job.getQueryResults();
    let [meta] = await job.getMetadata();
    console.log(`${label} CTAS done. bytes=${(meta.statistics && meta.statistics.query && meta.statistics.query.totalBytesProcessed) || 0}`);

    console.log(`${label} MERGE from stage...`);
    const merge = mergeFromStage(stage);
    ;[job] = await bq.createQueryJob({ query: merge, useLegacySql: false, maximumBytesBilled: '40000000000' });
    await job.getQueryResults();
    ;[meta] = await job.getMetadata();
    console.log(`${label} MERGE done. bytes=${(meta.statistics && meta.statistics.query && meta.statistics.query.totalBytesProcessed) || 0}`);

    console.log(`${label} DROP stage...`);
    const drop = `DROP TABLE ${stage}`;
    ;[job] = await bq.createQueryJob({ query: drop, useLegacySql: false });
    await job.getQueryResults();
    console.log(`${label} Completed.`);
  } catch (e) {
    console.error('run_one_unified_task failed:', e?.message || e);
    process.exit(1);
  }
})(); 