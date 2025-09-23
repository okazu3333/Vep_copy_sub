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
  const targets = [];
  for (const region of regions) {
    const sql = `SELECT '${region}' AS region, job_id, state, query
FROM \`${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE project_id='${projectId}'
  AND state='RUNNING'
  AND creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)
  AND query LIKE '%unified_stage_shard_0%'`;
    try {
      const [rows] = await bq.query({ query: sql, useLegacySql: false });
      for (const r of rows || []) targets.push({ job_id: r.job_id.toString(), region: region.replace(/^region-/, '') });
    } catch {}
  }
  if (!targets.length) {
    console.log('No running stage-0 jobs found.');
    return;
  }
  const cancelled = [];
  for (const j of targets) {
    try {
      const job = bq.job(j.job_id);
      job.location = j.region;
      await job.cancel();
      cancelled.push(j);
    } catch (e) {
      console.error('Cancel failed:', j, e?.message || e);
    }
  }
  console.log('Cancelled stage-0 jobs:', cancelled);
})(); 