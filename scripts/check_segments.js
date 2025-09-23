const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
  const bq = new BigQuery({ projectId });
  const dataset = 'salesguard_alerts';
  const table = 'alerts_v2_scored';
  const dayWindow = Number(process.env.SEG_DAYS || 30);
  try {
    const sql = `
WITH base AS (
  SELECT 
    id,
    message_id,
    description,
    messageBody,
    CONCAT(IFNULL(description,''),' ',IFNULL(messageBody,'')) AS text_all,
    datetime
  FROM ` + "`" + `${projectId}.${dataset}.${table}` + "`" + `
  WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${dayWindow} DAY)
), flags AS (
  SELECT
    COUNTIF(REGEXP_CONTAINS(text_all, r'(見送り|今回は|再検討|不要|解約)')) AS lose,
    COUNTIF(REGEXP_CONTAINS(text_all, r'(他社|比較|乗り換え|別ベンダー)')) AS rival,
    COUNTIF(REGEXP_CONTAINS(text_all, r'(追加|オプション|他サービス|新機能)')) AS addreq,
    COUNTIF(REGEXP_CONTAINS(text_all, r'(更新|契約|継続|期間)')) AS renewal,
    COUNT(*) AS total
  FROM base
)
SELECT * FROM flags`;

    const [rows] = await bq.query({ query: sql, useLegacySql: false });
    console.log('Segment counts (last', dayWindow, 'days):', rows[0]);

    // fetch few samples for one segment if exists
    const sampleSql = `
SELECT id, message_id, description
FROM ` + "`" + `${projectId}.${dataset}.${table}` + "`" + `
WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${dayWindow} DAY)
  AND REGEXP_CONTAINS(CONCAT(IFNULL(description,''),' ',IFNULL(messageBody,'')), r'(見送り|今回は|再検討|不要|解約)')
LIMIT 5`;
    const [samp] = await bq.query({ query: sampleSql, useLegacySql: false });
    console.log('Lose-risk sample (up to 5):', samp);
  } catch (e) {
    console.error('check_segments failed:', e && (e.message || e));
    process.exit(1);
  }
})(); 