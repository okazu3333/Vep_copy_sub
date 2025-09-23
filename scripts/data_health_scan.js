const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
  const bq = new BigQuery({ projectId });
  const dataset = 'salesguard_alerts';
  const table = 'alerts_v2_scored';
  const days = Number(process.env.SCAN_DAYS || 120);
  try {
    const byDaySql = `
SELECT DATE(datetime) AS d, COUNT(*) AS c, COUNTIF(keyword IS NOT NULL AND keyword != '') AS kw
FROM ` + "`" + `${projectId}.${dataset}.${table}` + "`" + `
WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
GROUP BY d ORDER BY d DESC`;
    const [byDay] = await bq.query({ query: byDaySql, useLegacySql: false });
    console.log('Counts by day (last', days, 'days):');
    console.table(byDay.slice(0, 30));

    const segSql = `
WITH base AS (
  SELECT CONCAT(IFNULL(description,''),' ',IFNULL(messageBody,'')) AS text_all
  FROM ` + "`" + `${projectId}.${dataset}.${table}` + "`" + `
  WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
)
SELECT 
  COUNTIF(REGEXP_CONTAINS(text_all, r'(見送り|今回は|再検討|不要|解約)')) AS lose,
  COUNTIF(REGEXP_CONTAINS(text_all, r'(他社|比較|乗り換え|別ベンダー)')) AS rival,
  COUNTIF(REGEXP_CONTAINS(text_all, r'(追加|オプション|他サービス|新機能)')) AS addreq,
  COUNTIF(REGEXP_CONTAINS(text_all, r'(更新|契約|継続|期間)')) AS renewal
FROM base`;
    const [seg] = await bq.query({ query: segSql, useLegacySql: false });
    console.log('Segment regex counts:', seg[0]);
  } catch (e) {
    console.error('data_health_scan failed:', e && (e.message || e));
    process.exit(1);
  }
})(); 