const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const jobId = process.argv[2];
    const location = process.argv[3] || 'asia-northeast1';
    if (!jobId) {
      console.error('Usage: node scripts/get_job_meta.js <jobId> [location]');
      process.exit(1);
    }
    const bq = new BigQuery({ projectId });
    const job = bq.job(jobId, { location });
    const [meta] = await job.getMetadata();
    const cfg = meta.configuration || {};
    const stats = meta.statistics || {};
    const status = meta.status || {};
    const out = {
      id: meta.id,
      location,
      state: status.state,
      error: status.errorResult || null,
      stmt: (stats.query && stats.query.statementType) || (cfg.query && cfg.query.statementType) || null,
      totalBytesProcessed: (stats.query && stats.query.totalBytesProcessed) || null,
      creationTime: stats.creationTime || null,
      startTime: stats.startTime || null,
      endTime: stats.endTime || null,
      destinationTable: cfg.query && cfg.query.destinationTable || null,
      query: (cfg.query && cfg.query.query) ? String(cfg.query.query).slice(0, 5000) : null,
    };
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error('get_job_meta failed:', e?.message || e);
    process.exit(1);
  }
})(); 