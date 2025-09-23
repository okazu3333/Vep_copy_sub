const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const dataset = 'salesguard_alerts';
    const table = 'alerts_v2_scored';
    const bq = new BigQuery({ projectId });

    const deleteSql = `
DELETE FROM ` + "`" + `${projectId}.${dataset}.${table}` + "`" + `
WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)`;

    const insertSql = `
INSERT INTO ` + "`" + `${projectId}.${dataset}.${table}` + "`" + ` (
  id, original_alert_id, message_id, status, level, score, keyword,
  department, assigned_user_id, customer_email, datetime, updated_at,
  resolved_at, resolved_by, resolution_note, person, description, messageBody,
  source_file, thread_id, reply_level, is_root
)
WITH texted AS (
  SELECT 
    m.message_id,
    CAST(m.thread_id AS STRING) AS thread_id,
    m.reply_level,
    m.is_root,
    m.subject,
    m.from_email,
    m.body_preview,
    m.body_gcs_uri,
    m.date,
    CONCAT(COALESCE(m.subject,''), ' ', COALESCE(m.body_preview,'')) AS text_all
  FROM ` + "`" + `${projectId}.${dataset}.email_messages_threaded_v1` + "`" + ` m
  WHERE DATE(SAFE_CAST(m.date AS TIMESTAMP)) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
), scored AS (
  SELECT
    message_id, thread_id, reply_level, is_root, subject, from_email, body_preview, body_gcs_uri, date,
    (
      0
      + CASE WHEN STRPOS(text_all,'クレーム')>0 THEN 1.0 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'苦情')>0 THEN 1.0 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'不満')>0 THEN 1.0 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'緊急')>0 THEN 1.5 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'至急')>0 THEN 1.5 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'急ぎ')>0 THEN 1.5 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'キャンセル')>0 THEN 1.2 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'解約')>0 THEN 1.2 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'高い')>0 THEN 0.8 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'料金')>0 THEN 0.8 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'価格')>0 THEN 0.8 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'不良')>0 THEN 1.3 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'不具合')>0 THEN 1.3 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'故障')>0 THEN 1.3 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'まだですか')>0 THEN 1.1 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'対応して')>0 THEN 1.1 ELSE 0 END
      + CASE WHEN STRPOS(text_all,'返事がない')>0 THEN 1.1 ELSE 0 END
    ) AS rule_score,
    (
      SELECT STRING_AGG(kw, ', ')
      FROM UNNEST(['クレーム','苦情','不満','緊急','至急','急ぎ','キャンセル','解約','高い','料金','価格','不良','不具合','故障','まだですか','対応して','返事がない']) kw
      WHERE STRPOS(text_all, kw) > 0
    ) AS detected_keyword
  FROM texted
)
SELECT
  CONCAT('ALT-', TO_HEX(MD5(COALESCE(message_id, CONCAT(subject, body_preview))))) AS id,
  CAST(NULL AS STRING) AS original_alert_id,
  message_id,
  'new' AS status,
  CASE WHEN rule_score >= 2.5 THEN 'high' WHEN rule_score >= 1.0 THEN 'medium' ELSE 'low' END AS level,
  CAST(LEAST(100, ROUND(rule_score * 30)) AS INT64) AS score,
  detected_keyword AS keyword,
  CAST(NULL AS STRING) AS department,
  CAST(NULL AS STRING) AS assigned_user_id,
  CAST(NULL AS STRING) AS customer_email,
  CAST(SAFE_CAST(date AS TIMESTAMP)) AS datetime,
  CAST(SAFE_CAST(date AS TIMESTAMP)) AS updated_at,
  CAST(NULL AS TIMESTAMP) AS resolved_at,
  CAST(NULL AS STRING) AS resolved_by,
  CAST(NULL AS STRING) AS resolution_note,
  from_email AS person,
  subject AS description,
  body_preview AS messageBody,
  body_gcs_uri AS source_file,
  thread_id,
  CAST(reply_level AS INT64) AS reply_level,
  CAST(is_root AS BOOL) AS is_root
FROM scored`;

    console.log('Deleting last 90 days from alerts_v2_scored...');
    await bq.query({ query: deleteSql, useLegacySql: false, location: 'asia-northeast1' });
    console.log('Deleted. Inserting rescored rows...');
    const [job] = await bq.createQueryJob({ query: insertSql, useLegacySql: false, location: 'asia-northeast1' });
    await job.getQueryResults();
    console.log('Rescore insert done.');
  } catch (e) {
    console.error('rescore_last90 failed:', e && (e.message || e));
    process.exit(1);
  }
})();
