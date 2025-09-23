const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
  const bq = new BigQuery({ projectId });
  const regions = [
    'region-asia-northeast1',
    'region-asia-northeast2',
    'region-us',
    'region-europe-west1',
    'region-northamerica-northeast1',
  ];
  const results = [];
  for (const region of regions) {
    const sql = `SELECT
      '${region}' AS region,
      job_id,
      creation_time,
      end_time,
      statement_type,
      total_bytes_processed,
      user_email,
      query
    FROM \`${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
    WHERE project_id='${projectId}'
      AND creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
      AND query LIKE '%unified_email_messages%'
    ORDER BY creation_time DESC
    LIMIT 50`;
    try {
      const [rows] = await bq.query({ query: sql, useLegacySql: false });
      if (rows && rows.length) {
        for (const r of rows) results.push(r);
      }
    } catch (e) {
      // ignore region errors
    }
  }
  if (!results.length) {
    console.log('No unified_email_messages jobs found in last 24h.');
  } else {
    for (const r of results) {
      console.log({
        region: r.region,
        job_id: r.job_id,
        created: r.creation_time,
        ended: r.end_time,
        stmt: r.statement_type,
        bytes: r.total_bytes_processed,
      });
    }
  }
})(); 