const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const bq = new BigQuery({ projectId });

    const queries = [
      {
        name: 'email_messages_threaded_v1',
        sql: 'SELECT COUNT(*) AS c, MAX(TIMESTAMP(date)) AS last_ts FROM `viewpers.salesguard_alerts.email_messages_threaded_v1`',
      },
      {
        name: 'email_messages_normalized',
        sql: 'SELECT COUNT(*) AS c, MAX(TIMESTAMP(date)) AS last_ts FROM `viewpers.salesguard_alerts.email_messages_normalized`',
      },
      {
        name: 'alerts_v2_scored',
        sql: 'SELECT COUNT(*) AS c, MAX(datetime) AS last_ts FROM `viewpers.salesguard_alerts.alerts_v2_scored`',
      },
      {
        name: 'threaded_tree_fields',
        sql: 'SELECT COUNT(*) AS total, COUNTIF(reply_level IS NULL) AS null_reply_level, COUNTIF(is_root IS NULL) AS null_is_root FROM `viewpers.salesguard_alerts.email_messages_threaded_v1`',
      },
      {
        name: 'normalized_in_reply_to',
        sql: 'SELECT COUNT(*) AS total, COUNTIF(in_reply_to IS NULL) AS null_in_reply_to FROM `viewpers.salesguard_alerts.email_messages_normalized`',
      },
    ];

    for (const q of queries) {
      const [rows] = await bq.query({ query: q.sql, useLegacySql: false });
      console.log(`=== ${q.name} ===`);
      console.log(rows[0] || {});
    }
  } catch (e) {
    console.error('bq_inventory failed:', e?.message || e);
    process.exit(1);
  }
})(); 