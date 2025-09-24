const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const dataset = 'salesguard_alerts';
    const bq = new BigQuery({ projectId });

    console.log('Creating compatibility views...');

    // alerts_v2_compat_unified - references current alerts_v2_scored
    const alertsViewDDL = `
      CREATE OR REPLACE VIEW \`${projectId}.${dataset}.alerts_v2_compat_unified\` AS
      SELECT
        s.id,
        s.message_id,
        CAST(s.thread_id AS STRING) AS thread_id,
        COALESCE(s.description, '') AS subject,
        COALESCE(s.person, '') AS customer,
        COALESCE(s.customer_email, '') AS customer_email,
        COALESCE(s.department, '') AS department,
        COALESCE(s.status, 'unhandled') AS status,
        COALESCE(s.level, 'medium') AS severity,
        COALESCE(s.keyword, '') AS phrases,
        s.datetime,
        s.updated_at,
        COALESCE(s.messageBody, s.description, '') AS ai_summary,
        LOWER(REGEXP_EXTRACT(COALESCE(s.customer_email, ''), '@([^> ]+)$')) AS company_domain,
        CAST(s.reply_level AS INT64) AS reply_level,
        CAST(s.is_root AS BOOL) AS is_root,
        s.source_file
      FROM \`${projectId}.${dataset}.alerts_v2_scored\` s
      WHERE DATE(s.datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 180 DAY)
    `;

    // messages_compat_unified - references current email_messages_threaded_v1
    const messagesViewDDL = `
      CREATE OR REPLACE VIEW \`${projectId}.${dataset}.messages_compat_unified\` AS
      SELECT
        m.message_id,
        CAST(m.thread_id AS STRING) AS thread_id,
        n.in_reply_to,
        CAST(m.reply_level AS INT64) AS reply_level,
        CAST(m.is_root AS BOOL) AS is_root,
        TIMESTAMP(m.date) AS datetime,
        m.from_email AS \`from\`,
        ARRAY_TO_STRING(m.to_emails, ', ') AS \`to\`,
        COALESCE(m.subject, '') AS subject,
        COALESCE(m.body_preview, '') AS body_preview,
        m.body_gcs_uri AS source_uri,
        LOWER(REGEXP_EXTRACT(COALESCE(m.from_email, ''), '@([^> ]+)$')) AS company_domain,
        CASE WHEN LOWER(REGEXP_EXTRACT(COALESCE(m.from_email, ''), '@([^> ]+)$')) IN (
               SELECT LOWER(domain) FROM \`${projectId}.${dataset}.companies\` WHERE is_internal = TRUE
             ) THEN 'internal' ELSE 'external' END AS direction
      FROM \`${projectId}.${dataset}.email_messages_threaded_v1\` m
      LEFT JOIN \`${projectId}.${dataset}.email_messages_normalized\` n
        ON n.message_id = m.message_id
      WHERE DATE(TIMESTAMP(m.date)) >= DATE_SUB(CURRENT_DATE(), INTERVAL 180 DAY)
    `;

    console.log('Creating alerts_v2_compat_unified view...');
    await bq.query({ query: alertsViewDDL, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ alerts_v2_compat_unified created');

    console.log('Creating messages_compat_unified view...');
    await bq.query({ query: messagesViewDDL, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ messages_compat_unified created');

    // Test the views
    console.log('Testing views...');
    const testQuery = `
      SELECT COUNT(*) as count, MAX(datetime) as latest
      FROM \`${projectId}.${dataset}.alerts_v2_compat_unified\`
      WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    `;
    
    const [testRows] = await bq.query({ query: testQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('Test result:', testRows[0]);

    console.log('Compatibility views created successfully!');
  } catch (e) {
    console.error('Failed to create compatibility views:', e?.message || e);
    process.exit(1);
  }
})(); 