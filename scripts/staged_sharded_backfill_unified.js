const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
  const dataset = 'salesguard_alerts';
  const target = `\`${projectId}.${dataset}.unified_email_messages\``;
  const bq = new BigQuery({ projectId });
  const CONCURRENCY = Number(process.env.CONCURRENCY || 6);

  const selectSourceMinimal = (shard, dayStart, dayEnd) => `
SELECT
  s.id AS alert_id,
  m.message_id,
  CAST(m.thread_id AS STRING) AS thread_id,
  REGEXP_REPLACE(CAST(m.thread_id AS STRING), r'^<|>$', '') AS thread_id_norm,
  n.in_reply_to,
  CAST(m.reply_level AS INT64) AS reply_level,
  CAST(m.is_root AS BOOL) AS is_root,
  TIMESTAMP(m.date) AS datetime,
  m.from_email AS \`from\`,
  ARRAY_TO_STRING(m.to_emails, ', ') AS \`to\`,
  m.subject AS subject,
  LOWER(IFNULL(m.subject, '')) AS subject_norm,
  s.description,
  s.messageBody AS message_body,
  m.body_preview AS body_preview,
  SUBSTR(REGEXP_REPLACE(IFNULL(m.body_preview, ''), '\\s+', ' '), 0, 256) AS body_snippet,
  m.body_gcs_uri AS source_uri,
  s.source_file AS source_file,
  LOWER(REGEXP_EXTRACT(COALESCE(m.from_email, ''), '@([^> ]+)$')) AS company_domain,
  LOWER(REGEXP_EXTRACT(COALESCE(m.from_email, ''), '@([^> ]+)$')) AS company_domain_norm,
  s.customer_email,
  LOWER(COALESCE(s.customer_email, '')) AS customer_email_norm,
  s.person AS person,
  LOWER(COALESCE(s.person, '')) AS person_norm,
  REGEXP_REPLACE(TRIM(REGEXP_EXTRACT(COALESCE(n.\`from\`, s.person), '^(.*?)(?:<|$)')), '"', '') AS customer_name_header,
  c.display_name AS customer_display_name,
  comp.company_name AS company_name,
  CASE
    WHEN LOWER(REGEXP_EXTRACT(COALESCE(m.from_email, ''), '@([^> ]+)$')) IN (
      SELECT LOWER(domain) FROM \`${projectId}.${dataset}.companies\` WHERE is_internal = TRUE
    ) THEN 'internal' ELSE 'external'
  END AS direction,
  s.status,
  s.level,
  s.keyword,
  s.department,
  s.assigned_user_id,
  u.display_name AS assignee_name,
  s.level AS primary_risk_type,
  s.keyword AS risk_keywords,
  CAST(s.score AS INT64) AS score,
  CAST(s.score AS INT64) AS detection_score,
  ROUND(0.6 * COALESCE(s.score,0) + 0.4 * ((COALESCE(ms.sentiment_score,0)+1)/2) * 100) AS composite_risk,
  ms.sentiment_label,
  ms.sentiment_score,
  (COALESCE(ms.sentiment_score, 0) <= -0.7) AS negative_flag,
  REGEXP_CONTAINS(LOWER(CONCAT(IFNULL(s.description,''),' ',IFNULL(s.messageBody,''))), r'(見送り|今回は|再検討|不要|解約)') AS seg_lose,
  REGEXP_CONTAINS(LOWER(CONCAT(IFNULL(s.description,''),' ',IFNULL(s.messageBody,''))), r'(他社|比較|乗り換え|別ベンダー)') AS seg_rival,
  REGEXP_CONTAINS(LOWER(CONCAT(IFNULL(s.description,''),' ',IFNULL(s.messageBody,''))), r'(追加|オプション|他サービス|新機能)') AS seg_addreq,
  REGEXP_CONTAINS(LOWER(CONCAT(IFNULL(s.description,''),' ',IFNULL(s.messageBody,''))), r'(更新|契約|継続|期間)') AS seg_renewal
FROM \`${projectId}.${dataset}.email_messages_threaded_v1\` m
LEFT JOIN \`${projectId}.${dataset}.email_messages_normalized\` n
  ON n.message_id = m.message_id
LEFT JOIN \`${projectId}.${dataset}.alerts_v2_scored\` s
  ON s.message_id = m.message_id
LEFT JOIN \`${projectId}.${dataset}.messages_sentiment\` ms
  ON ms.message_id = m.message_id
LEFT JOIN \`${projectId}.${dataset}.users\` u
  ON u.user_id = s.assigned_user_id
LEFT JOIN \`${projectId}.${dataset}.customers\` c
  ON LOWER(c.email) = LOWER(COALESCE(s.customer_email, s.person))
LEFT JOIN \`${projectId}.${dataset}.companies\` comp
  ON LOWER(comp.domain) = LOWER(REGEXP_EXTRACT(COALESCE(s.customer_email, s.person), '@([^> ]+)$'))
WHERE MOD(ABS(FARM_FINGERPRINT(COALESCE(CAST(m.thread_id AS STRING), m.message_id))), 16) = ${shard}
  AND DATE(TIMESTAMP(m.date)) >= DATE('${dayStart}') AND DATE(TIMESTAMP(m.date)) < DATE('${dayEnd}')
`;

  const mergeFromStage = (stage) => `
MERGE ${target} T
USING (SELECT * FROM ${stage}) S
ON T.message_id = S.message_id
WHEN MATCHED THEN UPDATE SET
  T.alert_id = COALESCE(S.alert_id, T.alert_id),
  T.thread_id = S.thread_id,
  T.thread_id_norm = S.thread_id_norm,
  T.in_reply_to = S.in_reply_to,
  T.reply_level = S.reply_level,
  T.is_root = S.is_root,
  T.datetime = S.datetime,
  T.\`from\` = S.\`from\`,
  T.\`to\` = S.\`to\`,
  T.subject = S.subject,
  T.subject_norm = S.subject_norm,
  T.description = COALESCE(S.description, T.description),
  T.message_body = COALESCE(S.message_body, T.message_body),
  T.body_preview = S.body_preview,
  T.body_snippet = S.body_snippet,
  T.source_uri = S.source_uri,
  T.source_file = COALESCE(S.source_file, T.source_file),
  T.company_domain = S.company_domain,
  T.company_domain_norm = S.company_domain_norm,
  T.customer_email = COALESCE(S.customer_email, T.customer_email),
  T.customer_email_norm = COALESCE(S.customer_email_norm, T.customer_email_norm),
  T.person = COALESCE(S.person, T.person),
  T.person_norm = COALESCE(S.person_norm, T.person_norm),
  T.customer_name_header = COALESCE(S.customer_name_header, T.customer_name_header),
  T.customer_display_name = COALESCE(S.customer_display_name, T.customer_display_name),
  T.company_name = COALESCE(S.company_name, T.company_name),
  T.direction = S.direction,
  T.status = COALESCE(S.status, T.status),
  T.level = COALESCE(S.level, T.level),
  T.keyword = COALESCE(S.keyword, T.keyword),
  T.department = COALESCE(S.department, T.department),
  T.assigned_user_id = COALESCE(S.assigned_user_id, T.assigned_user_id),
  T.assignee_name = COALESCE(S.assignee_name, T.assignee_name),
  T.primary_risk_type = COALESCE(S.primary_risk_type, T.primary_risk_type),
  T.risk_keywords = COALESCE(S.risk_keywords, T.risk_keywords),
  T.score = COALESCE(S.score, T.score),
  T.detection_score = COALESCE(S.detection_score, T.detection_score),
  T.composite_risk = COALESCE(S.composite_risk, T.composite_risk),
  T.sentiment_label = COALESCE(S.sentiment_label, T.sentiment_label),
  T.sentiment_score = COALESCE(S.sentiment_score, T.sentiment_score),
  T.negative_flag = COALESCE(S.negative_flag, T.negative_flag),
  T.seg_lose = S.seg_lose,
  T.seg_rival = S.seg_rival,
  T.seg_addreq = S.seg_addreq,
  T.seg_renewal = S.seg_renewal
WHEN NOT MATCHED THEN INSERT (alert_id, message_id, thread_id, thread_id_norm, in_reply_to, reply_level, is_root, datetime, \`from\`, \`to\`, subject, subject_norm, description, message_body, body_preview, body_snippet, source_uri, source_file, company_domain, company_domain_norm, customer_email, customer_email_norm, person, person_norm, customer_name_header, customer_display_name, company_name, direction, status, level, keyword, department, assigned_user_id, assignee_name, primary_risk_type, risk_keywords, score, detection_score, composite_risk, sentiment_label, sentiment_score, negative_flag, seg_lose, seg_rival, seg_addreq, seg_renewal)
VALUES (S.alert_id, S.message_id, S.thread_id, S.thread_id_norm, S.in_reply_to, S.reply_level, S.is_root, S.datetime, S.\`from\`, S.\`to\`, S.subject, S.subject_norm, S.description, S.message_body, S.body_preview, S.body_snippet, S.source_uri, S.source_file, S.company_domain, S.company_domain_norm, S.customer_email, S.customer_email_norm, S.person, S.person_norm, S.customer_name_header, S.customer_display_name, S.company_name, S.direction, S.status, S.level, S.keyword, S.department, S.assigned_user_id, S.assignee_name, S.primary_risk_type, S.risk_keywords, S.score, S.detection_score, S.composite_risk, S.sentiment_label, S.sentiment_score, S.negative_flag, S.seg_lose, S.seg_rival, S.seg_addreq, S.seg_renewal)
`;

  const lastNDaysSlices = (n) => {
    const slices = [];
    const end = new Date();
    end.setUTCHours(0,0,0,0);
    for (let i = n; i >= 1; i--) {
      const s = new Date(end); s.setUTCDate(s.getUTCDate() - i);
      const e = new Date(end); e.setUTCDate(e.getUTCDate() - i + 1);
      const fmt = (d) => d.toISOString().slice(0, 10);
      slices.push([fmt(s), fmt(e)]);
    }
    return slices;
  };

  const runTask = async (shard, start, end) => {
    const stage = `\`${projectId}.${dataset}.unified_stage_shard_${shard}_${start.replace(/-/g,'')}_${end.replace(/-/g,'')}\``;
    const label = `[Shard ${shard} ${start}..${end}]`;
    try {
      console.log(`${label} CTAS stage minimal...`);
      const ctas = `CREATE OR REPLACE TABLE ${stage} OPTIONS (expiration_timestamp=TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR), require_partition_filter=TRUE) PARTITION BY DATE(datetime) CLUSTER BY thread_id, datetime AS ${selectSourceMinimal(shard, start, end)}`;
      let [job] = await bq.createQueryJob({ query: ctas, useLegacySql: false, maximumBytesBilled: '80000000000' });
      await job.getQueryResults();
      let [meta] = await job.getMetadata();
      console.log(`${label} CTAS done. bytes=${(meta.statistics && meta.statistics.query && meta.statistics.query.totalBytesProcessed) || 0}`);

      console.log(`${label} MERGE from stage minimal...`);
      const merge = mergeFromStage(stage);
      ;[job] = await bq.createQueryJob({ query: merge, useLegacySql: false, maximumBytesBilled: '80000000000' });
      await job.getQueryResults();
      ;[meta] = await job.getMetadata();
      console.log(`${label} MERGE done. bytes=${(meta.statistics && meta.statistics.query && meta.statistics.query.totalBytesProcessed) || 0}`);
    } catch (e) {
      console.error(`${label} FAILED:`, e?.message || e);
    } finally {
      try {
        console.log(`${label} DROP stage...`);
        const drop = `DROP TABLE ${stage}`;
        const [job] = await bq.createQueryJob({ query: drop, useLegacySql: false });
        await job.getQueryResults();
      } catch {}
    }
  };

  const runWithConcurrency = async (tasks, concurrency) => {
    let idx = 0; let active = 0; let resolved = 0;
    return new Promise((resolve) => {
      const launch = () => {
        while (active < concurrency && idx < tasks.length) {
          const t = tasks[idx++];
          active++;
          t().finally(() => {
            active--; resolved++;
            if (resolved === tasks.length) resolve(); else launch();
          });
        }
      };
      launch();
    });
  };

  try {
    const daySlices = lastNDaysSlices(7);
    const tasks = [];
    for (let shard = 0; shard < 16; shard++) {
      for (const [start, end] of daySlices) {
        tasks.push(() => runTask(shard, start, end));
      }
    }
    console.log(`Starting backfill with concurrency=${CONCURRENCY}, tasks=${tasks.length} (16 shards x ${daySlices.length} days)`);
    await runWithConcurrency(tasks, CONCURRENCY);
    console.log('All shards completed with daily slices (last 7 days).');
  } catch (e) {
    console.error('staged_sharded_backfill_unified failed:', e?.message || e);
    process.exit(1);
  }
})(); 
