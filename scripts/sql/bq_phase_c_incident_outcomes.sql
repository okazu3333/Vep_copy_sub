-- Phase C BigQuery assets for incident outcome modeling
-- Project: viewpers  Dataset: salesguard_alerts

-- 1) Outcomes table (prediction sink)
CREATE TABLE IF NOT EXISTS `viewpers.salesguard_alerts.incident_outcomes` (
  incident_id STRING,
  thread_id STRING,
  rule_id STRING,
  detect_at TIMESTAMP,
  predicted_at TIMESTAMP,
  p_resolved_24h FLOAT64,
  hazard_score FLOAT64,
  ttr_pred_min FLOAT64,
  model_version STRING,
  features STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(predicted_at);

-- 2) Feature view for modeling
CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_incident_features` AS
WITH params AS (
  SELECT IFNULL(MAX(detect_at), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.vw_incident_lifecycle`
),
alerts AS (
  SELECT
    thread_id,
    ANY_VALUE(level) AS alert_level,
    ANY_VALUE(status) AS status,
    ANY_VALUE(department) AS department,
    ANY_VALUE(assigned_user_id) AS assigned_user_id,
    ANY_VALUE(person) AS alert_person,
    ANY_VALUE(resolved_at) AS resolved_at
  FROM `viewpers.salesguard_alerts.alerts_v2_scored`
  GROUP BY thread_id
),
base AS (
  SELECT
    CONCAT(COALESCE(thread_id, ''), '::', COALESCE(rule_id, 'unknown')) AS incident_id,
    thread_id,
    rule_id,
    detect_at,
    first_follow_at,
    al.resolved_at,
    TIMESTAMP_DIFF(first_follow_at, detect_at, MINUTE) AS ttr_first_min,
    TIMESTAMP_DIFF(COALESCE(al.resolved_at, params.anchor_time), detect_at, MINUTE) AS ttr_resolve_min,
    al.resolved_at IS NOT NULL AS is_resolved,
    baseline_sentiment,
    at_detection_sentiment,
    post_followup_sentiment,
    sentiment_recovery
  FROM `viewpers.salesguard_alerts.vw_incident_lifecycle`
  CROSS JOIN params
  LEFT JOIN alerts al USING(thread_id)
),
labels AS (
  SELECT
    incident_id,
    IF(resolved_at IS NOT NULL AND TIMESTAMP_DIFF(resolved_at, detect_at, HOUR) <= 24, 1, 0) AS resolved_within_24h,
    resolved_at IS NULL AS is_censored
  FROM base
),
scored AS (
  SELECT
    b.incident_id,
    MAX(a.final_score) AS final_score
  FROM base b
  LEFT JOIN `viewpers.salesguard_alerts.vw_alerts_scored_bq` a
    ON b.thread_id = a.thread_id
  GROUP BY b.incident_id
),
person AS (
  SELECT
    CONCAT(COALESCE(thread_id, ''), '::', COALESCE(rule_id, 'unknown')) AS incident_id,
    `from` AS sender
  FROM `viewpers.salesguard_alerts.vw_incident_lifecycle`
  JOIN `viewpers.salesguard_alerts.unified_email_messages` USING(thread_id)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY datetime DESC) = 1
),
health AS (
  SELECT
    ph.sender,
    ph.open_incidents,
    ph.overdue_72h,
    ph.night_ratio_7d,
    ph.median_ttr_first_min,
    ph.median_recovery_30d
  FROM `viewpers.salesguard_alerts.vw_person_health` ph
),
change_points AS (
  SELECT
    cp.thread_id,
    cp.change_score,
    cp.sentiment_delta,
    cp.recent_msgs,
    cp.past_msgs
  FROM `viewpers.salesguard_alerts.vw_change_points` cp
),
behavior AS (
  SELECT
    ba.sender,
    ba.anomaly_score,
    ba.sentiment_drop,
    ba.freq_drop
  FROM `viewpers.salesguard_alerts.vw_behavior_anomaly` ba
)
SELECT
  b.incident_id,
  b.thread_id,
  b.rule_id,
  b.detect_at,
  b.first_follow_at,
  b.resolved_at,
  b.ttr_first_min,
  b.ttr_resolve_min,
  b.is_resolved,
  l.resolved_within_24h,
  l.is_censored,
  COALESCE(s.final_score, 0) AS final_score,
  b.baseline_sentiment,
  b.at_detection_sentiment,
  b.post_followup_sentiment,
  b.sentiment_recovery,
  cp.change_score,
  cp.sentiment_delta AS thread_sentiment_delta,
  cp.recent_msgs,
  cp.past_msgs,
  ba.anomaly_score,
  ba.sentiment_drop AS person_sentiment_drop,
  ba.freq_drop AS person_freq_drop,
  COALESCE(pe.sender, al.alert_person) AS owner_sender,
  ph.open_incidents,
  ph.overdue_72h,
  ph.night_ratio_7d,
  ph.median_ttr_first_min AS person_median_ttr_first,
  ph.median_recovery_30d AS person_median_recovery,
  al.alert_level,
  al.status,
  al.department,
  al.assigned_user_id
FROM base b
LEFT JOIN labels l USING(incident_id)
LEFT JOIN scored s USING(incident_id)
LEFT JOIN person pe USING(incident_id)
LEFT JOIN alerts al ON al.thread_id = b.thread_id
LEFT JOIN health ph ON ph.sender = COALESCE(pe.sender, al.alert_person)
LEFT JOIN change_points cp ON cp.thread_id = b.thread_id
LEFT JOIN behavior ba ON ba.sender = COALESCE(pe.sender, al.alert_person);
