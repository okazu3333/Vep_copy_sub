const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const bq = new BigQuery({ projectId });

    const [jobs] = await bq.getJobs({ maxResults: 100 });
    const hits = [];
    for (const job of jobs) {
      const meta = job.metadata || {};
      const cfg = meta.configuration || {};
      const q = (cfg.query && cfg.query.query) || '';
      if (typeof q === 'string' && q.includes('unified_email_messages')) {
        hits.push({
          id: job.id,
          state: (meta.status && meta.status.state) || 'UNKNOWN',
          created: meta.statistics && meta.statistics.creationTime ? new Date(Number(meta.statistics.creationTime)).toISOString() : null,
          bytes: meta.statistics && meta.statistics.totalBytesProcessed || null,
          dest: cfg.query && cfg.query.destinationTable ? cfg.query.destinationTable.tableId : null,
          stmt: (meta.statistics && meta.statistics.query && meta.statistics.query.statementType) || null,
        });
      }
    }

    if (hits.length === 0) {
      console.log('No recent jobs found for unified_email_messages');
    } else {
      console.log('Recent unified_email_messages jobs:');
      for (const h of hits) console.log(h);
    }
  } catch (e) {
    console.error('find_unified_job failed:', e?.message || e);
    process.exit(1);
  }
})(); 