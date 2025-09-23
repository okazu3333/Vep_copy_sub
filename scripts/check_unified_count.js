const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const bq = new BigQuery({ projectId });
    const [rows] = await bq.query({
      query: 'SELECT COUNT(*) AS c, MAX(datetime) AS max_dt FROM `viewpers.salesguard_alerts.unified_email_messages`',
      useLegacySql: false,
    });
    console.log(rows[0] || {});
  } catch (e) {
    console.error('check_unified_count failed:', e?.message || e);
    process.exit(1);
  }
})(); 