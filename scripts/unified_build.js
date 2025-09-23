const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
  const dataset = 'salesguard_alerts';
  const table = 'unified_email_messages';
  const fqtn = `${projectId}.${dataset}.${table}`;
  const bq = new BigQuery({ projectId });

  const ddl = `
CREATE TABLE IF NOT EXISTS ` + "`" + `${projectId}.${dataset}.${table}` + "`" + ` (
  alert_id STRING,
  message_id STRING,
  thread_id STRING,
  thread_id_norm STRING,
  in_reply_to STRING,
  reply_level INT64,
  is_root BOOL,
  datetime TIMESTAMP,
  \`from\` STRING,
  \`to\` STRING,
  subject STRING,
  subject_norm STRING,
  description STRING,
  message_body STRING,
  body_preview STRING,
  body_snippet STRING,
  source_uri STRING,
  source_file STRING,
  company_domain STRING,
  company_domain_norm STRING,
  customer_email STRING,
  customer_email_norm STRING,
  person STRING,
  person_norm STRING,
  customer_name_header STRING,
  customer_display_name STRING,
  company_name STRING,
  direction STRING,
  status STRING,
  level STRING,
  keyword STRING,
  department STRING,
  assigned_user_id STRING,
  assignee_name STRING,
  primary_risk_type STRING,
  risk_keywords STRING,
  score INT64,
  detection_score INT64,
  composite_risk INT64,
  sentiment_label STRING,
  sentiment_score FLOAT64,
  negative_flag BOOL,
  seg_lose BOOL,
  seg_rival BOOL,
  seg_addreq BOOL,
  seg_renewal BOOL
)
PARTITION BY DATE(datetime)
CLUSTER BY thread_id, datetime, primary_risk_type, company_domain
OPTIONS (require_partition_filter = TRUE)
`;

  const backfill = `
INSERT INTO ` + "`" + `${projectId}.${dataset}.${table}` + "`" + ` (
  alert_id, message_id, thread_id, thread_id_norm, in_reply_to, reply_level, is_root, datetime,
  \`from\`, \`to\`, subject, subject_norm, description, message_body, body_preview, body_snippet, source_uri, source_file,
  company_domain, company_domain_norm, customer_email, customer_email_norm,
  person, person_norm, customer_name_header, customer_display_name, company_name,
  direction, status, level, keyword, department, assigned_user_id, assignee_name,
  primary_risk_type, risk_keywords, score, detection_score, composite_risk,
  sentiment_label, sentiment_score, negative_flag,
  seg_lose, seg_rival, seg_addreq, seg_renewal
)
WITH src AS (
  SELECT
    s.id AS alert_id,
    m.message_id,
    CAST(m.thread_id AS STRING) AS thread_id,
    REGEXP_REPLACE(CAST(m.thread_id AS STRING), r'^<|>$', '') AS thread_id_norm,
    n.in_reply_to,
    CAST(m.reply_level AS INT64) AS reply_level,
    CAST(m.is_root AS BOOL) AS is_root,
    TIMESTAMP(m.date) AS datetime,
    m.from_email AS \`from\`,
    ARRAY_TO_STRING(m.to_emails, ', ') AS \`to\`,
    m.subject AS subject,
    LOWER(IFNULL(m.subject, '')) AS subject_norm,
    m.body_preview AS body_preview,
    SUBSTR(REGEXP_REPLACE(IFNULL(m.body_preview, ''), '\\s+', ' '), 0, 256) AS body_snippet,
    m.body_gcs_uri AS source_uri,
    s.source_file AS source_file,
    LOWER(REGEXP_EXTRACT(COALESCE(m.from_email, ''), '@([^> ]+)$')) AS company_domain,
    LOWER(REGEXP_EXTRACT(COALESCE(m.from_email, ''), '@([^> ]+)$')) AS company_domain_norm,
    s.customer_email,
    LOWER(COALESCE(s.customer_email, '')) AS customer_email_norm,
    s.person AS person,
    LOWER(COALESCE(s.person, '')) AS person_norm,
    REGEXP_REPLACE(TRIM(REGEXP_EXTRACT(COALESCE(n.\`from\`, s.person), '^(.*?)(?:<|$)')), '"', '') AS customer_name_header,
    c.display_name AS customer_display_name,
    comp.company_name AS company_name,
    CASE
      WHEN LOWER(REGEXP_EXTRACT(COALESCE(m.from_email, ''), '@([^> ]+)$')) IN (
        SELECT LOWER(domain) FROM ` + "`" + `${projectId}.${dataset}.companies` + "`" + ` WHERE is_internal = TRUE
      ) THEN 'internal'
      ELSE 'external'
    END AS direction,
    s.status,
    s.level,
    s.keyword,
    s.department,
    s.assigned_user_id,
    u.display_name AS assignee_name,
    s.description,
    s.messageBody AS message_body,
    s.level AS primary_risk_type,
    s.keyword AS risk_keywords,
    CAST(s.score AS INT64) AS score,
    CAST(s.score AS INT64) AS detection_score,
    ROUND(0.6 * COALESCE(s.score,0) + 0.4 * ((COALESCE(ms.sentiment_score,0)+1)/2) * 100) AS composite_risk,
    ms.sentiment_label,
    ms.sentiment_score,
    (COALESCE(ms.sentiment_score, 0) <= -0.7) AS negative_flag,
    REGEXP_CONTAINS(LOWER(CONCAT(IFNULL(s.description,''),' ',IFNULL(s.messageBody,''))), r'(見送り|今回は|再検討|不要|解約)') AS seg_lose,
    REGEXP_CONTAINS(LOWER(CONCAT(IFNULL(s.description,''),' ',IFNULL(s.messageBody,''))), r'(他社|比較|乗り換え|別ベンダー)') AS seg_rival,
    REGEXP_CONTAINS(LOWER(CONCAT(IFNULL(s.description,''),' ',IFNULL(s.messageBody,''))), r'(追加|オプション|他サービス|新機能)') AS seg_addreq,
    REGEXP_CONTAINS(LOWER(CONCAT(IFNULL(s.description,''),' ',IFNULL(s.messageBody,''))), r'(更新|契約|継続|期間)') AS seg_renewal
  FROM ` + "`" + `${projectId}.${dataset}.email_messages_threaded_v1` + "`" + ` m
  LEFT JOIN ` + "`" + `${projectId}.${dataset}.email_messages_normalized` + "`" + ` n
    ON n.message_id = m.message_id
  LEFT JOIN ` + "`" + `${projectId}.${dataset}.alerts_v2_scored` + "`" + ` s
    ON s.message_id = m.message_id
  LEFT JOIN ` + "`" + `${projectId}.${dataset}.messages_sentiment` + "`" + ` ms
    ON ms.message_id = m.message_id
  LEFT JOIN ` + "`" + `${projectId}.${dataset}.users` + "`" + ` u
    ON u.user_id = s.assigned_user_id
  LEFT JOIN ` + "`" + `${projectId}.${dataset}.customers` + "`" + ` c
    ON LOWER(c.email) = LOWER(COALESCE(s.customer_email, s.person))
  LEFT JOIN ` + "`" + `${projectId}.${dataset}.companies` + "`" + ` comp
    ON LOWER(comp.domain) = LOWER(REGEXP_EXTRACT(COALESCE(s.customer_email, s.person), '@([^> ]+)$'))
)
SELECT * FROM src
`;

  try {
    console.log('Creating unified table with partitioning/clustering...');
    await bq.query({ query: ddl, useLegacySql: false });
    console.log('DDL done:', fqtn);

    console.log('Backfilling unified table from existing sources (this may take a while)...');
    const [job] = await bq.createQueryJob({ query: backfill, useLegacySql: false });
    await job.getQueryResults();
    console.log('Backfill done.');
  } catch (e) {
    console.error('unified_build failed:', e?.message || e);
    process.exit(1);
  }
})(); 
