-- BigQuery setup for alert segment transitions and auto-resolution
-- Project: viewpers  Dataset: salesguard_alerts

-- =====================
-- セグメント遷移履歴テーブル
-- =====================

CREATE TABLE IF NOT EXISTS `viewpers.salesguard_alerts.alert_segment_history` (
  id STRING NOT NULL,
  alert_id STRING,
  thread_id STRING,
  from_segment STRING,
  to_segment STRING,
  transition_reason STRING,
  transition_score FLOAT64,
  transitioned_by STRING, -- 'system' | 'manual' | user_id
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
CLUSTER BY thread_id, alert_id;

-- =====================
-- 自動解決履歴テーブル
-- =====================

CREATE TABLE IF NOT EXISTS `viewpers.salesguard_alerts.alert_auto_resolutions` (
  id STRING NOT NULL,
  alert_id STRING,
  thread_id STRING,
  resolution_type STRING, -- 'positive_sentiment' | 'no_response_7d' | 'spam_detected'
  resolution_score FLOAT64,
  resolution_reason STRING,
  previous_status STRING,
  resolved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(resolved_at)
CLUSTER BY thread_id, alert_id;

-- =====================
-- セグメント遷移判定用ビュー
-- =====================

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_alert_transition_candidates` AS
WITH current_alerts AS (
  SELECT DISTINCT
    a.thread_id,
    a.alert_id,
    a.primary_segment,
    a.status,
    a.detection_score,
    a.urgency_score,
    a.sentiment_score,
    a.updated_at,
    a.assigned_user_id,
    -- Phase Cデータ
    io.p_resolved_24h,
    io.ttr_pred_min,
    -- Phase Dデータ
    rq.quality_score,
    -- 検知ルールデータ
    dr.rule_type AS detection_rule_type,
    dr.hours_since_last_activity,
    dr.score AS detection_rule_score
  FROM `viewpers.salesguard_alerts.alerts_v2_scored` a
  LEFT JOIN `viewpers.salesguard_alerts.incident_outcomes` io 
    ON a.thread_id = io.thread_id
  LEFT JOIN `viewpers.salesguard_alerts.reply_quality` rq
    ON a.thread_id = rq.thread_id
  LEFT JOIN `viewpers.salesguard_alerts.detection_alerts` dr
    ON a.thread_id = dr.thread_id
  WHERE a.status IN ('unhandled', 'in_progress')
),
segment_meta AS (
  SELECT 
    thread_id,
    primary_segment,
    CASE 
      WHEN primary_segment LIKE 'forecast_%' THEN 'forecast'
      WHEN primary_segment LIKE 'occurrence_%' THEN 'occurrence'
      WHEN primary_segment LIKE 'follow_%' THEN 'follow'
      ELSE NULL
    END AS segment_category
  FROM current_alerts
),
-- 予兆→発生の判定候補
forecast_to_occurrence AS (
  SELECT 
    ca.thread_id,
    ca.alert_id,
    ca.primary_segment AS from_segment,
    'occurrence_followup' AS to_segment, -- デフォルトは催促
    'forecast_to_occurrence' AS transition_type,
    -- 判定条件
    CASE 
      WHEN ca.detection_score >= 70 THEN 1
      WHEN ca.urgency_score >= 70 THEN 1
      WHEN ca.sentiment_score <= -0.5 THEN 1
      WHEN ca.detection_rule_type = 'sentiment_urgency' THEN 1
      WHEN ca.detection_rule_type = 'inactivity_72h' AND ca.hours_since_last_activity >= 72 THEN 1
      ELSE 0
    END AS should_transition,
    -- 遷移スコア
    COALESCE(ca.detection_score, 0) + 
    COALESCE(ca.urgency_score, 0) * 0.3 +
    CASE WHEN ca.sentiment_score <= -0.5 THEN 20 ELSE 0 END +
    CASE WHEN ca.detection_rule_type = 'sentiment_urgency' THEN 15 ELSE 0 END +
    CASE WHEN ca.detection_rule_type = 'inactivity_72h' AND ca.hours_since_last_activity >= 72 THEN 10 ELSE 0 END
    AS transition_score,
    -- 遷移理由
    CONCAT(
      CASE WHEN ca.detection_score >= 70 THEN '検知スコア高' ELSE '' END,
      CASE WHEN ca.urgency_score >= 70 THEN '緊急度高い' ELSE '' END,
      CASE WHEN ca.sentiment_score <= -0.5 THEN '感情スコア低下' ELSE '' END,
      CASE WHEN ca.detection_rule_type = 'sentiment_urgency' THEN '催促検知' ELSE '' END,
      CASE WHEN ca.detection_rule_type = 'inactivity_72h' AND ca.hours_since_last_activity >= 72 THEN '72h放置' ELSE '' END
    ) AS transition_reason
  FROM current_alerts ca
  INNER JOIN segment_meta sm ON ca.thread_id = sm.thread_id
  WHERE sm.segment_category = 'forecast'
),
-- 催促発生後の返信チェック
reply_check AS (
  -- 催促発生後に自社営業側が返信したかチェック
  SELECT 
    ca.thread_id,
    ca.alert_id,
    ca.primary_segment AS from_segment,
    ca.status,
    ca.updated_at,
    ca.p_resolved_24h,
    ca.sentiment_score,
    -- 催促発生後の自社営業側の返信を確認
    MAX(CASE WHEN u.direction = 'outbound' AND u.datetime > ca.updated_at THEN u.datetime ELSE NULL END) AS reply_after_followup,
    -- 返信後の経過時間
    TIMESTAMP_DIFF(
      CURRENT_TIMESTAMP(),
      MAX(CASE WHEN u.direction = 'outbound' AND u.datetime > ca.updated_at THEN u.datetime ELSE NULL END),
      HOUR
    ) AS hours_since_reply
  FROM current_alerts ca
  INNER JOIN segment_meta sm ON ca.thread_id = sm.thread_id
  LEFT JOIN `viewpers.salesguard_alerts.unified_email_messages` u
    ON ca.thread_id = u.thread_id
  WHERE sm.segment_category = 'occurrence'
    AND (ca.primary_segment = 'occurrence_followup' OR ca.status IN ('in_progress', 'completed'))
  GROUP BY ca.thread_id, ca.alert_id, ca.primary_segment, ca.status, ca.updated_at, ca.p_resolved_24h, ca.sentiment_score
),
-- 発生→回復の判定候補
occurrence_to_recovery AS (
  SELECT 
    rc.thread_id,
    rc.alert_id,
    rc.from_segment,
    'follow_recovery' AS to_segment,
    'occurrence_to_recovery' AS transition_type,
    -- 判定条件: 催促発生後に返信した場合、または従来の条件
    CASE 
      -- 催促発生後に返信した場合（最優先）
      WHEN rc.from_segment = 'occurrence_followup' AND rc.reply_after_followup IS NOT NULL 
        AND (rc.hours_since_reply >= 1 OR rc.status IN ('in_progress', 'completed')) THEN 1
      -- 従来の条件
      WHEN rc.status IN ('in_progress', 'completed') THEN 1
      ELSE 0
    END AS should_transition,
    -- 遷移スコア
    CASE 
      WHEN rc.status = 'completed' THEN 100
      -- 催促発生後に返信した場合
      WHEN rc.from_segment = 'occurrence_followup' AND rc.reply_after_followup IS NOT NULL THEN 90
      WHEN rc.status = 'in_progress' AND rc.p_resolved_24h IS NOT NULL THEN 80
      WHEN rc.status = 'in_progress' AND rc.sentiment_score > 0 THEN 70
      WHEN rc.status = 'in_progress' AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), rc.updated_at, HOUR) >= 24 THEN 60
      ELSE 0
    END AS transition_score,
    -- 遷移理由
    CONCAT(
      CASE WHEN rc.status = 'completed' THEN '解決済み' ELSE '' END,
      CASE WHEN rc.from_segment = 'occurrence_followup' AND rc.reply_after_followup IS NOT NULL 
        THEN CONCAT('催促発生後に返信済み（', CAST(rc.hours_since_reply AS STRING), '時間前）') ELSE '' END,
      CASE WHEN rc.p_resolved_24h IS NOT NULL THEN '鎮火確率計算可能' ELSE '' END,
      CASE WHEN rc.sentiment_score > 0 THEN 'ポジティブ反応' ELSE '' END,
      CASE WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), rc.updated_at, HOUR) >= 24 THEN '24h経過' ELSE '' END
    ) AS transition_reason
  FROM reply_check rc
  WHERE 
    -- 催促発生後に返信した場合（1時間以上経過、またはステータスがin_progress/completed）
    (rc.from_segment = 'occurrence_followup' AND rc.reply_after_followup IS NOT NULL 
      AND (rc.hours_since_reply >= 1 OR rc.status IN ('in_progress', 'completed')))
    -- または従来の条件
    OR (rc.status IN ('in_progress', 'completed')
      AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), rc.updated_at, HOUR) >= 24)
)
SELECT * FROM forecast_to_occurrence WHERE should_transition = 1
UNION ALL
SELECT * FROM occurrence_to_recovery WHERE should_transition = 1;

-- =====================
-- 自動解決判定用ビュー
-- =====================

CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_auto_resolution_candidates` AS
WITH recent_messages AS (
  SELECT 
    thread_id,
    MAX(datetime) AS last_message_time,
    AVG(sentiment_score) AS avg_sentiment_7d,
    COUNT(*) AS message_count_7d
  FROM `viewpers.salesguard_alerts.unified_email_messages`
  WHERE direction = 'inbound'
    AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  GROUP BY thread_id
),
current_alerts AS (
  SELECT DISTINCT
    a.thread_id,
    a.alert_id,
    a.status,
    a.sentiment_score,
    a.updated_at,
    rm.last_message_time,
    rm.avg_sentiment_7d,
    rm.message_count_7d,
    TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), COALESCE(rm.last_message_time, a.updated_at), HOUR) AS hours_since_last_activity
  FROM `viewpers.salesguard_alerts.alerts_v2_scored` a
  LEFT JOIN recent_messages rm ON a.thread_id = rm.thread_id
  WHERE a.status IN ('unhandled', 'in_progress')
)
SELECT 
  thread_id,
  alert_id,
  status AS previous_status,
  -- ポジティブ反応による自動解決
  CASE 
    WHEN avg_sentiment_7d > 0.3 AND message_count_7d >= 2 THEN 'positive_sentiment'
    WHEN sentiment_score > 0.5 THEN 'positive_sentiment'
    ELSE NULL
  END AS resolution_type,
  CASE 
    WHEN avg_sentiment_7d > 0.3 AND message_count_7d >= 2 THEN avg_sentiment_7d * 100
    WHEN sentiment_score > 0.5 THEN sentiment_score * 100
    ELSE NULL
  END AS resolution_score,
  CASE 
    WHEN avg_sentiment_7d > 0.3 AND message_count_7d >= 2 THEN CONCAT('7日間の平均感情スコア: ', ROUND(avg_sentiment_7d, 2), ' (', message_count_7d, '件)')
    WHEN sentiment_score > 0.5 THEN CONCAT('現在の感情スコア: ', ROUND(sentiment_score, 2))
    ELSE NULL
  END AS resolution_reason
FROM current_alerts
WHERE 
  -- ポジティブ反応の条件
  (avg_sentiment_7d > 0.3 AND message_count_7d >= 2)
  OR sentiment_score > 0.5;


