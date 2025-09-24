-- Compatibility views pointing to current production tables.
-- Step 1 prior to migration: create these views so API can swap without downtime.

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.messages_compat_unified` AS
SELECT
  m.message_id,
  CAST(m.thread_id AS STRING) AS thread_id,
  REGEXP_REPLACE(CAST(m.thread_id AS STRING), r'^<|>$', '') AS thread_id_norm,
  TIMESTAMP(m.date) AS datetime,
  m.subject,
  LOWER(IFNULL(m.subject, '')) AS subject_norm,
  '' AS message_body,
  m.body_preview,
  SUBSTR(REGEXP_REPLACE(IFNULL(m.body_preview, ''), '\s+', ' '), 0, 256) AS body_snippet,
  m.body_gcs_uri AS source_uri,
  s.source_file,
  s.person,
  LOWER(COALESCE(s.person, '')) AS person_norm,
  s.customer_email,
  LOWER(COALESCE(s.customer_email, '')) AS customer_email_norm,
  REGEXP_REPLACE(TRIM(REGEXP_EXTRACT(COALESCE(n.`from`, s.person), '^(.*?)(?:<|$)')), '"', '') AS customer_name_header,
  LOWER(REGEXP_EXTRACT(COALESCE(s.customer_email, s.person), '@([^> ]+)$')) AS company_domain,
  LOWER(REGEXP_EXTRACT(COALESCE(s.customer_email, s.person), '@([^> ]+)$')) AS company_domain_norm
FROM `viewpers.salesguard_alerts.email_messages_threaded_v1` m
LEFT JOIN `viewpers.salesguard_alerts.email_messages_normalized` n ON n.message_id = m.message_id
LEFT JOIN `viewpers.salesguard_alerts.alerts_v2_scored` s ON s.message_id = m.message_id;

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.alerts_v2_compat_unified` AS
SELECT
  s.id,
  s.message_id,
  s.status,
  s.level,
  s.score,
  s.keyword,
  s.department,
  s.customer_email,
  s.datetime,
  s.person,
  s.description,
  s.messageBody AS message_body,
  CAST(m.thread_id AS STRING) AS thread_id,
  REGEXP_REPLACE(CAST(m.thread_id AS STRING), r'^<|>$', '') AS thread_id_norm,
  COALESCE(m.reply_level, s.reply_level) AS reply_level,
  COALESCE(m.is_root, s.is_root) AS is_root,
  COALESCE(s.source_file, m.body_gcs_uri) AS source_file,
  TIMESTAMP(m.date) AS message_datetime,
  LOWER(REGEXP_EXTRACT(COALESCE(s.customer_email, s.person, n.`from`), '@([^> ]+)$')) AS company_domain,
  LOWER(REGEXP_EXTRACT(COALESCE(s.customer_email, s.person, n.`from`), '@([^> ]+)$')) AS company_domain_norm,
  s.assigned_user_id,
  u.display_name AS assignee_name,
  REGEXP_REPLACE(TRIM(REGEXP_EXTRACT(COALESCE(n.`from`, s.person), '^(.*?)(?:<|$)')), '"', '') AS customer_name_header,
  c.display_name AS customer_display_name,
  comp.company_name AS company_name,
  DATE(s.datetime) AS event_date,
  s.thread_id AS legacy_thread_id,
  FALSE AS seg_lose,
  FALSE AS seg_rival,
  FALSE AS seg_addreq,
  FALSE AS seg_renewal,
  s.sentiment_label,
  s.sentiment_score,
  s.score AS detection_score,
  s.score AS composite_risk,
  s.negative_flag
FROM `viewpers.salesguard_alerts.alerts_v2_scored` s
LEFT JOIN `viewpers.salesguard_alerts.email_messages_threaded_v1` m ON m.message_id = s.message_id
LEFT JOIN `viewpers.salesguard_alerts.email_messages_normalized` n ON n.message_id = s.message_id
LEFT JOIN `viewpers.salesguard_alerts.users` u ON u.user_id = s.assigned_user_id
LEFT JOIN `viewpers.salesguard_alerts.customers` c ON LOWER(c.email) = LOWER(COALESCE(s.customer_email, s.person))
LEFT JOIN `viewpers.salesguard_alerts.companies` comp ON LOWER(comp.domain) = LOWER(REGEXP_EXTRACT(COALESCE(s.customer_email, s.person), '@([^> ]+)$'));

-- Verification queries
-- SELECT COUNT(*) FROM `viewpers.salesguard_alerts.alerts_v2_scored`;
-- SELECT COUNT(*) FROM `viewpers.salesguard_alerts.alerts_v2_compat_unified`;
-- SELECT * FROM `viewpers.salesguard_alerts.alerts_v2_compat_unified` LIMIT 10;
-- bytes check: EXPLAIN SELECT * FROM `viewpers.salesguard_alerts.alerts_v2_compat_unified` WHERE datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY);

-- Cutover: update API constants to point to compat views instead of physical tables.
-- Rollback: revert constant to original table names and DROP VIEW if necessary.
