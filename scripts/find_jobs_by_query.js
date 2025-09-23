const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const search = process.argv[2] || '';
    if (!search) {
      console.error('Usage: node scripts/find_jobs_by_query.js <search-substring>');
      process.exit(1);
    }
    const bq = new BigQuery({ projectId });
    const regions = [
      'region-asia-northeast1',
      'region-asia-northeast2',
      'region-us',
      'region-europe-west1',
      'region-northamerica-northeast1',
    ];
    const out = [];
    for (const region of regions) {
      const sql = `SELECT '${region}' AS region, job_id, state, statement_type, creation_time, start_time, end_time, total_bytes_processed, query
FROM \`${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE project_id='${projectId}'
  AND creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR)
  AND LOWER(query) LIKE LOWER('%${search.replace(/'/g, "\'")}%')
ORDER BY creation_time DESC
LIMIT 50`;
      try {
        const [rows] = await bq.query({ query: sql, useLegacySql: false });
        for (const r of rows || []) {
          out.push({
            region: r.region,
            job_id: r.job_id,
            state: r.state,
            stmt: r.statement_type,
            created: r.creation_time,
            started: r.start_time,
            ended: r.end_time,
            bytes: r.total_bytes_processed,
          });
        }
      } catch {}
    }
    if (!out.length) console.log('No jobs found'); else console.log(out);
  } catch (e) {
    console.error('find_jobs_by_query failed:', e?.message || e);
    process.exit(1);
  }
})(); 