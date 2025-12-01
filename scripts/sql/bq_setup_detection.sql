-- BigQuery setup for detection data mechanism (Phase A+B)
-- Project: viewpers  Dataset: salesguard_alerts

-- =====================
-- Phase A: Core tables
-- =====================

-- 1) Label table (evaluation)
CREATE TABLE IF NOT EXISTS `viewpers.salesguard_alerts.alerts_labels` (
  message_id STRING NOT NULL,
  thread_id STRING,
  rule_id STRING,
  importance STRING,           -- 'high'|'medium'|'low'
  is_true_positive BOOL,
  notes STRING,
  labeled_by STRING,
  labeled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(labeled_at);

-- 2) Phrase dictionary (for rules)
CREATE TABLE IF NOT EXISTS `viewpers.salesguard_alerts.keyword_dictionary` (
  phrase STRING NOT NULL,
  category STRING,             -- 'inquiry'|'churn'|'urgent'|'complaint'|'pricing' etc
  weight FLOAT64 DEFAULT 1.0,
  locale STRING DEFAULT 'ja',
  enabled BOOL DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(updated_at);

-- 3) Audit for message body views
CREATE TABLE IF NOT EXISTS `viewpers.salesguard_alerts.audit_view_body` (
  viewer STRING,
  message_id STRING,
  thread_id STRING,
  view_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  reason STRING
)
PARTITION BY DATE(view_at);

-- =====================
-- Phase B: Feature views
-- =====================

-- Time features
CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_time_features` AS
SELECT
  message_id,
  thread_id,
  `from` AS sender,
  datetime,
  EXTRACT(HOUR FROM datetime) AS hour,
  IF(EXTRACT(HOUR FROM datetime) >= 22 OR EXTRACT(HOUR FROM datetime) < 6, TRUE, FALSE) AS is_night
FROM `viewpers.salesguard_alerts.unified_email_messages`;

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_thread_activity` AS
WITH params AS (
  SELECT IFNULL(MAX(datetime), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.unified_email_messages`
),
base AS (
  SELECT
    thread_id,
    MAX(datetime) AS last_activity,
    MAX(IF(direction='inbound', datetime, NULL)) AS last_inbound,
    MAX(IF(direction='outbound', datetime, NULL)) AS last_outbound
  FROM `viewpers.salesguard_alerts.unified_email_messages`
  GROUP BY thread_id
)
SELECT
  base.*,
  TIMESTAMP_DIFF(params.anchor_time, last_activity, HOUR) AS hours_since_last
FROM base
CROSS JOIN params;

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_sentiment_trends` AS
WITH params AS (
  SELECT IFNULL(MAX(datetime), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.unified_email_messages`
)
SELECT
  `from` AS sender,
  AVG(IF(datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY), sentiment_score, NULL)) AS recent_sentiment,
  AVG(IF(datetime < TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)
         AND datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 30 DAY), sentiment_score, NULL)) AS past_sentiment,
  (AVG(IF(datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY), sentiment_score, NULL))
   - AVG(IF(datetime < TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)
            AND datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 30 DAY), sentiment_score, NULL))) AS sentiment_drop
FROM `viewpers.salesguard_alerts.unified_email_messages`, params
WHERE sentiment_score IS NOT NULL
GROUP BY sender;

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_reply_frequency` AS
WITH params AS (
  SELECT IFNULL(MAX(datetime), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.unified_email_messages`
),
base AS (
  SELECT DISTINCT `from` AS sender
  FROM `viewpers.salesguard_alerts.unified_email_messages`, params
  WHERE datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 30 DAY)
),
recent AS (
  SELECT `from` AS sender, SAFE_DIVIDE(COUNT(*), 7.0) AS recent_daily_reply_rate
  FROM `viewpers.salesguard_alerts.unified_email_messages`, params
  WHERE direction='outbound'
    AND datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)
  GROUP BY sender
),
past AS (
  SELECT `from` AS sender, SAFE_DIVIDE(COUNT(*), 23.0) AS past_daily_reply_rate
  FROM `viewpers.salesguard_alerts.unified_email_messages`, params
  WHERE direction='outbound'
    AND datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 30 DAY)
    AND datetime <  TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)
  GROUP BY sender
)
SELECT
  b.sender,
  COALESCE(r.recent_daily_reply_rate, 0.0) AS recent_daily_reply_rate,
  COALESCE(p.past_daily_reply_rate, r.recent_daily_reply_rate, 0.0) AS past_daily_reply_rate,
  (COALESCE(r.recent_daily_reply_rate, 0.0) - COALESCE(p.past_daily_reply_rate, r.recent_daily_reply_rate, 0.0)) AS freq_drop
FROM base b
LEFT JOIN recent r USING(sender)
LEFT JOIN past p USING(sender);

-- =====================
-- Phase B: Detection rules
-- =====================

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.det_rule_inactivity_72h` AS
WITH params AS (
  SELECT IFNULL(MAX(datetime), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.unified_email_messages`
)
SELECT
  ta.thread_id,
  ta.last_activity,
  ta.last_inbound,
  ta.last_outbound,
  ta.hours_since_last,
  'inactivity_72h' AS rule_id,
  15 AS score_delta,
  '顧客からの問い合わせに72時間以上未返信（自社営業起因）' AS reason,
  params.anchor_time AS created_at
FROM `viewpers.salesguard_alerts.vw_thread_activity` ta, params
WHERE ta.hours_since_last >= 72
  AND (ta.last_inbound IS NOT NULL AND (ta.last_outbound IS NULL OR ta.last_inbound >= ta.last_outbound));

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.det_rule_tone_down_and_inquiry` AS
WITH params AS (
  SELECT IFNULL(MAX(datetime), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.unified_email_messages`
)
SELECT
  u.message_id,
  u.thread_id,
  u.`from` AS sender,
  u.datetime,
  'tone_down_inquiry' AS rule_id,
  20 AS score_delta,
  '感情ダウン + 催促/確認系フレーズ' AS reason,
  params.anchor_time AS created_at
FROM `viewpers.salesguard_alerts.unified_email_messages` u
LEFT JOIN `viewpers.salesguard_alerts.keyword_dictionary` d
  ON d.enabled = TRUE AND d.locale='ja' AND d.category IN ('inquiry','complaint')
CROSS JOIN params
WHERE u.sentiment_score < -0.3
  AND (
    (d.phrase IS NOT NULL AND (REGEXP_CONTAINS(LOWER(COALESCE(u.subject,'')), LOWER(d.phrase))
       OR REGEXP_CONTAINS(LOWER(COALESCE(u.body_preview,'')), LOWER(d.phrase))))
    OR REGEXP_CONTAINS(LOWER(COALESCE(u.subject,'')), r'(進捗|返信|ご回答|お返事|確認|お願い)')
    OR REGEXP_CONTAINS(LOWER(COALESCE(u.body_preview,'')), r'(進捗|返信|ご回答|お返事|確認|お願い)')
  );

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.det_rule_night_reply_anomaly` AS
WITH params AS (
  SELECT IFNULL(MAX(datetime), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.unified_email_messages`
),
recent AS (
  SELECT `from` AS sender,
         COUNTIF(EXTRACT(HOUR FROM datetime) >= 22 OR EXTRACT(HOUR FROM datetime) < 6) * 100.0 / COUNT(*) AS night_rate
  FROM `viewpers.salesguard_alerts.unified_email_messages`, params
  WHERE direction='outbound'
    AND datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)
  GROUP BY sender
),
baseline AS (
  SELECT sender,
         AVG(night_rate) AS avg_night_rate
  FROM (
    SELECT `from` AS sender,
           DATE(datetime) AS day,
           COUNTIF(EXTRACT(HOUR FROM datetime) >= 22 OR EXTRACT(HOUR FROM datetime) < 6) * 100.0 / COUNT(*) AS night_rate
    FROM `viewpers.salesguard_alerts.unified_email_messages`, params
    WHERE direction='outbound'
      AND datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 90 DAY)
      AND datetime <  TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)
    GROUP BY sender, day
  )
  GROUP BY sender
)
SELECT r.sender,
       r.night_rate,
       b.avg_night_rate,
       (r.night_rate - COALESCE(b.avg_night_rate, 20)) AS deviation,
       'night_reply_anomaly' AS rule_id,
       10 AS score_delta,
       '夜間返信率の異常上昇' AS reason,
       params.anchor_time AS created_at
FROM recent r
LEFT JOIN baseline b USING(sender)
CROSS JOIN params
WHERE r.night_rate >= 50 OR (r.night_rate - COALESCE(b.avg_night_rate, 20)) >= 30;

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.det_rule_tone_and_freq_drop` AS
WITH params AS (
  SELECT IFNULL(MAX(datetime), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.unified_email_messages`
),
s AS (
  SELECT `from` AS sender,
         AVG(IF(datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY), sentiment_score, NULL)) AS recent_sentiment,
         AVG(IF(datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 30 DAY) AND datetime < TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY), sentiment_score, NULL)) AS past_sentiment
  FROM `viewpers.salesguard_alerts.unified_email_messages`, params
  WHERE sentiment_score IS NOT NULL
  GROUP BY sender
),
r AS (
  SELECT `from` AS sender,
         SAFE_DIVIDE(COUNTIF(datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)), 7.0) AS recent_daily_reply_rate,
         (
           SELECT SAFE_DIVIDE(COUNT(*), 23.0) FROM `viewpers.salesguard_alerts.unified_email_messages` u2, params p2
           WHERE u2.`from` = u.`from`
             AND u2.direction='outbound'
             AND u2.datetime >= TIMESTAMP_SUB(p2.anchor_time, INTERVAL 30 DAY)
             AND u2.datetime < TIMESTAMP_SUB(p2.anchor_time, INTERVAL 7 DAY)
         ) AS past_daily_reply_rate
  FROM `viewpers.salesguard_alerts.unified_email_messages` u, params
  WHERE direction='outbound' AND datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)
  GROUP BY sender
)
SELECT s.sender,
       (s.recent_sentiment - s.past_sentiment) AS sentiment_drop,
       (r.recent_daily_reply_rate - r.past_daily_reply_rate) AS frequency_drop,
       'tone_and_freq_drop' AS rule_id,
       15 AS score_delta,
       'トーン低下 + 返信頻度低下' AS reason,
       params.anchor_time AS created_at
FROM s JOIN r USING(sender)
CROSS JOIN params
WHERE (s.recent_sentiment - s.past_sentiment) < -0.2
  AND (r.recent_daily_reply_rate - r.past_daily_reply_rate) < -0.5;

-- =====================
-- Phase C: Lifecycle and person health
-- =====================

-- Incident lifecycle (per thread + rule)
CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_incident_lifecycle` AS
WITH detects AS (
  SELECT thread_id, 'inactivity_72h' AS rule_id, MIN(created_at) AS detect_at FROM `viewpers.salesguard_alerts.det_rule_inactivity_72h` GROUP BY thread_id
  UNION ALL
  SELECT thread_id, 'tone_down_inquiry' AS rule_id, MIN(created_at) FROM `viewpers.salesguard_alerts.det_rule_tone_down_and_inquiry` GROUP BY thread_id
  UNION ALL
  SELECT sender       AS thread_id, 'night_reply_anomaly' AS rule_id, MIN(created_at) FROM `viewpers.salesguard_alerts.det_rule_night_reply_anomaly` GROUP BY sender
  UNION ALL
  SELECT sender       AS thread_id, 'tone_and_freq_drop'  AS rule_id, MIN(created_at) FROM `viewpers.salesguard_alerts.det_rule_tone_and_freq_drop`  GROUP BY sender
),
first_follow AS (
  SELECT u.thread_id, MIN(u.datetime) AS first_follow_at
  FROM `viewpers.salesguard_alerts.unified_email_messages` u
  JOIN detects d USING(thread_id)
  WHERE u.direction='outbound' AND u.datetime > d.detect_at
  GROUP BY u.thread_id
),
snap AS (
  SELECT d.thread_id,
         d.rule_id,
         d.detect_at,
         f.first_follow_at,
         TIMESTAMP_DIFF(f.first_follow_at, d.detect_at, MINUTE) AS ttr_first_min,
         -- sentiment snapshots
         (SELECT AVG(u.sentiment_score) FROM `viewpers.salesguard_alerts.unified_email_messages` u
          WHERE u.thread_id=d.thread_id AND u.datetime BETWEEN TIMESTAMP_SUB(d.detect_at, INTERVAL 30 DAY) AND TIMESTAMP_SUB(d.detect_at, INTERVAL 7 DAY)) AS baseline_sentiment,
         (SELECT AVG(u.sentiment_score) FROM `viewpers.salesguard_alerts.unified_email_messages` u
          WHERE u.thread_id=d.thread_id AND u.datetime BETWEEN TIMESTAMP_SUB(d.detect_at, INTERVAL 1 DAY)  AND TIMESTAMP_ADD(d.detect_at,  INTERVAL 1 DAY)) AS at_detection_sentiment,
         (SELECT AVG(u.sentiment_score) FROM `viewpers.salesguard_alerts.unified_email_messages` u
          WHERE u.thread_id=d.thread_id AND u.datetime BETWEEN TIMESTAMP_ADD(d.detect_at,  INTERVAL 1 DAY)  AND TIMESTAMP_ADD(d.detect_at,  INTERVAL 7 DAY)) AS post_followup_sentiment
  FROM detects d
  LEFT JOIN first_follow f USING(thread_id)
)
SELECT *,
       (post_followup_sentiment - at_detection_sentiment) AS sentiment_recovery
FROM snap;

-- Person health (sender-level summary)
CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_person_health` AS
WITH params AS (
  SELECT IFNULL(MAX(datetime), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.unified_email_messages`
),
open_threads AS (
  SELECT thread_id, MAX(datetime) AS last_activity
  FROM `viewpers.salesguard_alerts.unified_email_messages`
  GROUP BY thread_id
),
overdue AS (
  SELECT thread_id FROM `viewpers.salesguard_alerts.det_rule_inactivity_72h`
),
night AS (
  SELECT sender, AVG(night_rate) AS night_ratio_7d FROM (
    SELECT `from` AS sender,
           DATE(datetime) AS day,
           COUNTIF(EXTRACT(HOUR FROM datetime) >= 22 OR EXTRACT(HOUR FROM datetime) < 6) * 100.0 / COUNT(*) AS night_rate
    FROM `viewpers.salesguard_alerts.unified_email_messages`, params
    WHERE direction='outbound' AND datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)
    GROUP BY sender, day
  ) GROUP BY sender
),
ttr AS (
  SELECT u.`from` AS sender,
         APPROX_QUANTILES(TIMESTAMP_DIFF(f.first_follow_at, d.detect_at, MINUTE), 100)[OFFSET(50)] AS median_ttr_first_min
  FROM `viewpers.salesguard_alerts.unified_email_messages` u
  JOIN `viewpers.salesguard_alerts.vw_incident_lifecycle` l ON l.thread_id = u.thread_id
  JOIN (
    SELECT thread_id, MIN(detect_at) AS detect_at FROM `viewpers.salesguard_alerts.vw_incident_lifecycle` GROUP BY thread_id
  ) d ON d.thread_id = u.thread_id
  LEFT JOIN (
    SELECT thread_id, MIN(first_follow_at) AS first_follow_at FROM `viewpers.salesguard_alerts.vw_incident_lifecycle` GROUP BY thread_id
  ) f ON f.thread_id = u.thread_id
  WHERE f.first_follow_at IS NOT NULL
  GROUP BY sender
)
SELECT
  u.`from` AS sender,
  COUNT(DISTINCT u.thread_id) AS open_incidents,
  COUNT(DISTINCT IF(o.thread_id IS NOT NULL, u.thread_id, NULL)) AS overdue_72h,
  COALESCE(n.night_ratio_7d, 0) AS night_ratio_7d,
  COALESCE(t.median_ttr_first_min, 0) AS median_ttr_first_min,
  APPROX_QUANTILES(l.sentiment_recovery, 100)[OFFSET(50)] AS median_recovery_30d
FROM `viewpers.salesguard_alerts.unified_email_messages` u, params
LEFT JOIN open_threads ot USING(thread_id)
LEFT JOIN overdue o USING(thread_id)
LEFT JOIN night n ON n.sender = u.`from`
LEFT JOIN ttr t ON t.sender = u.`from`
LEFT JOIN `viewpers.salesguard_alerts.vw_incident_lifecycle` l ON l.thread_id = u.thread_id
WHERE u.datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 30 DAY)
GROUP BY sender, night_ratio_7d, median_ttr_first_min;

-- =====================
-- Phase D: Final scoring aggregation (view)
-- =====================

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_alerts_scored_bq` AS
WITH base AS (
  SELECT
    u.message_id,
    u.thread_id,
    u.subject,
    u.body_preview,
    u.datetime,
    u.`from` AS sender,
    u.company_domain,
    IFNULL(u.sentiment_score, 0.0) AS sentiment_score
  FROM `viewpers.salesguard_alerts.unified_email_messages` u
),
rule_hits AS (
  SELECT thread_id, message_id, rule_id, score_delta, reason FROM `viewpers.salesguard_alerts.det_rule_tone_down_and_inquiry`
  UNION ALL
  SELECT thread_id, NULL AS message_id, rule_id, score_delta, reason FROM `viewpers.salesguard_alerts.det_rule_inactivity_72h`
),
agg AS (
  SELECT
    b.message_id,
    b.thread_id,
    b.subject,
    b.body_preview,
    b.datetime,
    b.sender,
    b.company_domain,
    SUM(IFNULL(r.score_delta,0))
      + CASE WHEN b.sentiment_score < -0.6 THEN 20 WHEN b.sentiment_score < -0.3 THEN 10 ELSE 0 END AS final_score_raw,
    ARRAY_AGG(r.reason IGNORE NULLS) AS reasons
  FROM base b
  LEFT JOIN rule_hits r USING(thread_id, message_id)
  GROUP BY b.message_id, b.thread_id, b.subject, b.body_preview, b.datetime, b.sender, b.company_domain, b.sentiment_score
)
SELECT
  *,
  LEAST(100, GREATEST(0, CAST(final_score_raw AS INT64))) AS final_score,
  CASE WHEN LEAST(100, GREATEST(0, CAST(final_score_raw AS INT64))) >= 80 THEN 'A'
       WHEN LEAST(100, GREATEST(0, CAST(final_score_raw AS INT64))) >= 60 THEN 'B'
       ELSE 'C' END AS severity
FROM agg;

-- =====================
-- Phase A-add: Change points and behavior anomaly
-- =====================

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_change_points` AS
WITH params AS (
  SELECT IFNULL(MAX(datetime), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.unified_email_messages`
),
stats AS (
  SELECT
    thread_id,
    AVG(IF(datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY), sentiment_score, NULL)) AS recent_sentiment,
    AVG(IF(datetime < TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)
           AND datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 30 DAY), sentiment_score, NULL)) AS past_sentiment,
    COUNTIF(datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)) AS recent_msgs,
    COUNTIF(datetime < TIMESTAMP_SUB(params.anchor_time, INTERVAL 7 DAY)
            AND datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 30 DAY)) AS past_msgs
  FROM `viewpers.salesguard_alerts.unified_email_messages`, params
  WHERE datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 30 DAY)
  GROUP BY thread_id
)
SELECT
  thread_id,
  recent_sentiment,
  past_sentiment,
  (recent_sentiment - COALESCE(past_sentiment, recent_sentiment)) AS sentiment_delta,
  recent_msgs,
  past_msgs,
  -- change score: negative delta weighted by message volume
  GREATEST(0.0, -(recent_sentiment - COALESCE(past_sentiment, recent_sentiment))) * LOG10(1 + recent_msgs) AS change_score,
  (GREATEST(0.0, -(recent_sentiment - COALESCE(past_sentiment, recent_sentiment))) * LOG10(1 + recent_msgs)) > 0.3 AS is_change
FROM stats;

-- Behavior anomaly (sender-level): combine sentiment drop and frequency drop
CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_behavior_anomaly` AS
WITH s AS (
  SELECT * FROM `viewpers.salesguard_alerts.vw_sentiment_trends`
), f AS (
  SELECT * FROM `viewpers.salesguard_alerts.vw_reply_frequency`
)
SELECT
  s.sender,
  s.recent_sentiment,
  s.past_sentiment,
  (s.recent_sentiment - COALESCE(s.past_sentiment, s.recent_sentiment)) AS sentiment_drop,
  f.recent_daily_reply_rate,
  f.past_daily_reply_rate,
  (f.recent_daily_reply_rate - COALESCE(f.past_daily_reply_rate, f.recent_daily_reply_rate)) AS freq_drop,
  -- anomaly score: positive when sentiment worsens and frequency decreases
  (GREATEST(0.0, -(s.recent_sentiment - COALESCE(s.past_sentiment, s.recent_sentiment))) * 1.0
   + GREATEST(0.0, -(f.recent_daily_reply_rate - COALESCE(f.past_daily_reply_rate, f.recent_daily_reply_rate))) * 0.5) AS anomaly_score,
  ((GREATEST(0.0, -(s.recent_sentiment - COALESCE(s.past_sentiment, s.recent_sentiment))) * 1.0
    + GREATEST(0.0, -(f.recent_daily_reply_rate - COALESCE(f.past_daily_reply_rate, f.recent_daily_reply_rate))) * 0.5) > 0.6) AS is_anomalous
FROM s
LEFT JOIN f USING(sender);
