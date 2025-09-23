const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const dataset = 'salesguard_alerts';
    const table = 'alerts_v2_scored';
    const restoreTable = `alerts_v2_scored_restore_${Date.now()}`;
    const hours = Number(process.env.RESTORE_HOURS || 3);
    const bq = new BigQuery({ projectId });

    const snapshotExpr = `TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${hours} HOUR)`;

    const createRestore = `
CREATE TABLE ` + "`" + `${projectId}.${dataset}.${restoreTable}` + "`" + `
PARTITION BY DATE(datetime)
CLUSTER BY thread_id AS
SELECT *
FROM ` + "`" + `${projectId}.${dataset}.${table}` + "`" + ` FOR SYSTEM_TIME AS OF ` + snapshotExpr + `
WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)`;

    const deleteCurrent = `
DELETE FROM ` + "`" + `${projectId}.${dataset}.${table}` + "`" + `
WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)`;

    const insertFromRestore = `
INSERT INTO ` + "`" + `${projectId}.${dataset}.${table}` + "`" + `
SELECT * FROM ` + "`" + `${projectId}.${dataset}.${restoreTable}` + "`" + `;
`;

    const dropRestore = `DROP TABLE ` + "`" + `${projectId}.${dataset}.${restoreTable}` + "`" + `;`;

    console.log('Creating restore snapshot table from time travel...');
    await bq.query({ query: createRestore, useLegacySql: false, location: 'asia-northeast1' });
    console.log('Snapshot table created:', `${projectId}.${dataset}.${restoreTable}`);

    console.log('Deleting current last 90 days...');
    await bq.query({ query: deleteCurrent, useLegacySql: false, location: 'asia-northeast1' });
    console.log('Deleted. Reinserting from snapshot...');
    const [job] = await bq.createQueryJob({ query: insertFromRestore, useLegacySql: false, location: 'asia-northeast1' });
    await job.getQueryResults();
    console.log('Reinsert completed. Dropping snapshot table...');
    await bq.query({ query: dropRestore, useLegacySql: false, location: 'asia-northeast1' });
    console.log('Restore done.');
  } catch (e) {
    console.error('restore_alerts_v2_scored failed:', e && (e.message || e));
    process.exit(1);
  }
})(); 