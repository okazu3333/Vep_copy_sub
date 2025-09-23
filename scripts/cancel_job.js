const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const jobId = process.argv[2];
    const location = process.argv[3] || 'asia-northeast1';
    if (!jobId) {
      console.error('Usage: node scripts/cancel_job.js <jobId> [location]');
      process.exit(1);
    }
    const bq = new BigQuery({ projectId });
    const job = bq.job(jobId);
    job.location = location;
    const [apiResponse] = await job.cancel();
    console.log('Cancel response:', apiResponse);
  } catch (e) {
    console.error('cancel_job failed:', e?.message || e);
    process.exit(1);
  }
})(); 