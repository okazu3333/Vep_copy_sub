const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const bq = new BigQuery({ projectId });

    const arg = process.argv[2];
    if (!arg) {
      console.error('Usage: node scripts/check_reply_levels.js <ALT-id or thread_id>');
      process.exit(1);
    }

    let threadId = arg;
    if (arg.startsWith('ALT-')) {
      const [rows] = await bq.query({
        query: 'SELECT ANY_VALUE(thread_id) AS thread_id, ANY_VALUE(message_id) AS message_id FROM `viewpers.salesguard_alerts.alerts_v2_scored` WHERE id=@id',
        params: { id: arg },
        useLegacySql: false,
      });
      if (!rows || !rows.length || !rows[0].thread_id) {
        console.log(JSON.stringify({ id: arg, thread_id: null, message: 'id not found or no thread_id' }, null, 2));
        process.exit(0);
      }
      threadId = String(rows[0].thread_id);
    }

    const [scoredLevels] = await bq.query({
      query: 'SELECT reply_level, COUNT(*) AS cnt FROM `viewpers.salesguard_alerts.alerts_v2_scored` WHERE SAFE_CAST(thread_id AS STRING)=@tid GROUP BY reply_level ORDER BY reply_level',
      params: { tid: threadId },
      useLegacySql: false,
    });

    const [threadedLevels] = await bq.query({
      query: 'SELECT reply_level, COUNT(*) AS cnt FROM `viewpers.salesguard_alerts.email_messages_threaded_v1` WHERE SAFE_CAST(thread_id AS STRING)=@tid GROUP BY reply_level ORDER BY reply_level',
      params: { tid: threadId },
      useLegacySql: false,
    });

    const [sample] = await bq.query({
      query: 'SELECT message_id, subject, date AS datetime, reply_level, is_root FROM `viewpers.salesguard_alerts.email_messages_threaded_v1` WHERE SAFE_CAST(thread_id AS STRING)=@tid ORDER BY SAFE_CAST(date AS TIMESTAMP) LIMIT 5',
      params: { tid: threadId },
      useLegacySql: false,
    });

    console.log(JSON.stringify({
      input: arg,
      thread_id: threadId,
      scored_levels: scoredLevels,
      threaded_levels: threadedLevels,
      sample_first5: sample,
    }, null, 2));
  } catch (e) {
    console.error('ERR:', e && (e.message || e));
    process.exit(1);
  }
})(); 