const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const dataset = 'salesguard_alerts';
    const table = 'messages_sentiment';
    const bq = new BigQuery({ projectId });

    const ddl = `
CREATE TABLE IF NOT EXISTS ` + "`" + `${projectId}.${dataset}.${table}` + "`" + ` (
  message_id STRING,
  sentiment_label STRING,
  sentiment_score FLOAT64,
  updated_at TIMESTAMP
) PARTITION BY DATE(updated_at)
`;

    console.log('Ensuring sentiment table exists...');
    await bq.query({ query: ddl, useLegacySql: false });

    // Simple keyword-based sentiment as a placeholder (negative-biased keywords)
    const merge = `
MERGE ` + "`" + `${projectId}.${dataset}.${table}` + "`" + ` T
USING (
  WITH src AS (
    SELECT
      s.message_id,
      CONCAT(IFNULL(s.description,''), ' ', IFNULL(s.messageBody,'')) AS text_all
    FROM ` + "`" + `${projectId}.${dataset}.alerts_v2_scored` + "`" + ` s
    WHERE s.datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY)
      AND s.message_id IS NOT NULL
  ), scored AS (
    SELECT
      message_id,
      -- naive scoring: -1 for negative hints, +1 for positive hints, 0 otherwise
      (
        0
        + 1.0 * IF(REGEXP_CONTAINS(text_all, r'(助かった|満足|ありがとう|感謝|良い|助かる)'), 1, 0)
        - 1.0 * IF(REGEXP_CONTAINS(text_all, r'(高い|遅い|解約|不便|困る|至急|トラブル|責任|返金|不満|苦情|クレーム|不具合|故障)'), 1, 0)
      ) AS raw_score
    FROM src
  ), mapped AS (
    SELECT
      message_id,
      CASE WHEN raw_score > 0 THEN 'positive' WHEN raw_score < 0 THEN 'negative' ELSE 'neutral' END AS sentiment_label,
      CAST(CASE WHEN raw_score > 0 THEN 0.6 WHEN raw_score < 0 THEN -0.7 ELSE 0.0 END AS FLOAT64) AS sentiment_score,
      CURRENT_TIMESTAMP() AS updated_at
    FROM scored
  )
  SELECT * FROM mapped
) S
ON T.message_id = S.message_id
WHEN MATCHED THEN UPDATE SET
  T.sentiment_label = S.sentiment_label,
  T.sentiment_score = S.sentiment_score,
  T.updated_at = S.updated_at
WHEN NOT MATCHED THEN INSERT (message_id, sentiment_label, sentiment_score, updated_at)
VALUES (S.message_id, S.sentiment_label, S.sentiment_score, S.updated_at)
`;

    console.log('Running sentiment merge (rule-based placeholder)...');
    const [job] = await bq.createQueryJob({ query: merge, useLegacySql: false, location: 'asia-northeast1' });
    await job.getQueryResults();
    console.log('Sentiment merge done.');
  } catch (e) {
    console.error('sentiment_rule_backfill failed:', e && (e.message || e));
    process.exit(1);
  }
})(); 