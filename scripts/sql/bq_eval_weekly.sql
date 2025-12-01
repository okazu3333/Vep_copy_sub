-- Weekly evaluation metrics (Precision/Recall/TopN) based on alerts_labels
-- Project: viewpers  Dataset: salesguard_alerts

DECLARE start_30 TIMESTAMP DEFAULT TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY);

WITH labels AS (
  SELECT *
  FROM `viewpers.salesguard_alerts.alerts_labels`
  WHERE labeled_at >= start_30
),
detections AS (
  -- unify detections by (message_id, thread_id, rule_id)
  SELECT message_id, thread_id, 'tone_down_inquiry' AS rule_id, created_at AS detect_at
  FROM `viewpers.salesguard_alerts.det_rule_tone_down_and_inquiry`
  WHERE created_at >= start_30
  UNION ALL
  SELECT NULL AS message_id, thread_id, 'inactivity_72h' AS rule_id, created_at
  FROM `viewpers.salesguard_alerts.det_rule_inactivity_72h`
  WHERE created_at >= start_30
  UNION ALL
  SELECT NULL, NULL, 'night_reply_anomaly', created_at FROM `viewpers.salesguard_alerts.det_rule_night_reply_anomaly`
  WHERE created_at >= start_30
  UNION ALL
  SELECT NULL, NULL, 'tone_and_freq_drop', created_at FROM `viewpers.salesguard_alerts.det_rule_tone_and_freq_drop`
  WHERE created_at >= start_30
),
det_by_msg AS (
  SELECT d.rule_id, d.message_id FROM detections d WHERE d.message_id IS NOT NULL GROUP BY d.rule_id, d.message_id
),
det_by_thread AS (
  SELECT d.rule_id, d.thread_id FROM detections d WHERE d.thread_id IS NOT NULL GROUP BY d.rule_id, d.thread_id
),
joined AS (
  SELECT
    l.rule_id AS label_rule,
    l.importance,
    l.is_true_positive,
    l.message_id AS l_message_id,
    l.thread_id  AS l_thread_id,
    CASE
      WHEN l.message_id IS NOT NULL THEN IF(dm.message_id IS NOT NULL, TRUE, FALSE)
      WHEN l.message_id IS NULL AND l.thread_id IS NOT NULL THEN IF(dt.thread_id IS NOT NULL, TRUE, FALSE)
      ELSE FALSE
    END AS detected
  FROM labels l
  LEFT JOIN det_by_msg dm ON l.rule_id = dm.rule_id AND l.message_id = dm.message_id
  LEFT JOIN det_by_thread dt ON l.rule_id = dt.rule_id AND l.thread_id  = dt.thread_id
)
SELECT
  label_rule,
  COUNTIF(is_true_positive AND detected)       AS tp,
  COUNTIF(is_true_positive AND NOT detected)   AS fn,
  COUNTIF(NOT is_true_positive AND detected)   AS fp,
  SAFE_DIVIDE(COUNTIF(is_true_positive AND detected), NULLIF(COUNTIF(is_true_positive), 0)) AS recall,
  SAFE_DIVIDE(COUNTIF(is_true_positive AND detected), NULLIF(COUNTIF(detected), 0))          AS precision
FROM joined
GROUP BY label_rule
ORDER BY label_rule;


