const { BigQuery } = require('@google-cloud/bigquery');
(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const bq = new BigQuery({ projectId });
    const [rows] = await bq.query({
      query: 'SELECT COUNT(*) AS internal_users FROM `viewpers.salesguard_alerts.users`',
      useLegacySql: false,
    });
    console.log('internal_users:', Number(rows?.[0]?.internal_users || 0));
  } catch (e) {
    console.error('Query failed:', e?.message || e);
    process.exit(1);
  }
})(); 