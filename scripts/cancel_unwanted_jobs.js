const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
  const bq = new BigQuery({ projectId });
  // Allowlist: unified MERGE only
  const allowQuerySubstring = 'unified_email_messages';
  const allowStmt = 'MERGE';

  const regions = [
    'region-asia-northeast1',
    'region-asia-northeast2',
    'region-us',
    'region-europe-west1',
    'region-northamerica-northeast1',
  ];
  const toCancel = [];

  for (const region of regions) {
    const sql = `SELECT
      '${region}' AS region,
      job_id,
      creation_time,
      end_time,
      statement_type,
      state,
      query
    FROM \`${region}\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
    WHERE project_id='${projectId}'
      AND creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
      AND state='RUNNING'`;
    try {
      const [rows] = await bq.query({ query: sql, useLegacySql: false });
      for (const r of rows || []) {
        const q = (r.query || '').toString();
        const stmt = (r.statement_type || '').toString();
        const isUnifiedMerge = q.includes(allowQuerySubstring) && stmt === allowStmt;
        if (!isUnifiedMerge) {
          toCancel.push({ job_id: r.job_id.toString(), region: region.replace(/^region-/, '') });
        }
      }
    } catch (e) {
      // ignore region errors
    }
  }

  if (!toCancel.length) {
    console.log('No unwanted RUNNING jobs found.');
    return;
  }

  const cancelled = [];
  for (const j of toCancel) {
    try {
      const job = bq.job(j.job_id);
      job.location = j.region;
      await job.cancel();
      cancelled.push(j);
    } catch (e) {
      console.error('Cancel failed:', j, e?.message || e);
    }
  }

  console.log('Cancelled jobs:', cancelled);
})(); 