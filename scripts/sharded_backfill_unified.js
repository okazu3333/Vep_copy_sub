const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
  const dataset = 'salesguard_alerts';
  const table = 'unified_email_messages';
  const fqtn = `\`${projectId}.${dataset}.${table}\``;
  const bq = new BigQuery({ projectId });

  const mergeTemplate = (shard) => `
MERGE ${fqtn} T
USING (
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
    CASE
      WHEN LOWER(REGEXP_EXTRACT(COALESCE(m.from_email, ''), '@([^> ]+)$')) IN (
        SELECT LOWER(domain) FROM \`${projectId}.${dataset}.companies\` WHERE is_internal = TRUE
      ) THEN 'internal' ELSE 'external'
    END AS direction,
    s.level AS primary_risk_type,
    s.keyword AS risk_keywords,
    CAST(s.score AS INT64) AS score
  FROM \`${projectId}.${dataset}.email_messages_threaded_v1\` m
  LEFT JOIN \`${projectId}.${dataset}.email_messages_normalized\` n
    ON n.message_id = m.message_id
  LEFT JOIN \`${projectId}.${dataset}.alerts_v2_scored\` s
    ON s.message_id = m.message_id
  WHERE MOD(ABS(FARM_FINGERPRINT(COALESCE(CAST(m.thread_id AS STRING), m.message_id))), 8) = ${shard}
) S
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
  T.primary_risk_type = S.primary_risk_type,
  T.risk_keywords = S.risk_keywords,
  T.score = S.score
WHEN NOT MATCHED THEN INSERT (message_id, thread_id, in_reply_to, reply_level, is_root, datetime, \`from\`, \`to\`, subject, body_preview, source_uri, company_domain, direction, primary_risk_type, risk_keywords, score)
VALUES (S.message_id, S.thread_id, S.in_reply_to, S.reply_level, S.is_root, S.datetime, S.\`from\`, S.\`to\`, S.subject, S.body_preview, S.source_uri, S.company_domain, S.direction, S.primary_risk_type, S.risk_keywords, S.score)
`;

  try {
    for (let shard = 0; shard < 8; shard++) {
      const query = mergeTemplate(shard);
      console.log(`[Shard ${shard}] Starting MERGE...`);
      const [job] = await bq.createQueryJob({ query, useLegacySql: false, maximumBytesBilled: '200000000000' });
      await job.getQueryResults();
      const [meta] = await job.getMetadata();
      const stats = meta.statistics || {};
      const q = stats.query || {};
      console.log(`[Shard ${shard}] Done. bytesProcessed=${q.totalBytesProcessed || 0}, slotMs=${stats.totalSlotMs || 0}`);
    }
    console.log('All shards completed.');
  } catch (e) {
    console.error('sharded_backfill_unified failed:', e?.message || e);
    process.exit(1);
  }
})(); 