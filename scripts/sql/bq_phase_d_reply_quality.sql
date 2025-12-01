-- Phase D BigQuery assets for reply quality scoring and similarity search
-- Project: viewpers  Dataset: salesguard_alerts

-- 1) Base view: outbound replies
CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_outbound_replies` AS
WITH params AS (
  SELECT IFNULL(MAX(datetime), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.unified_email_messages`
),
base AS (
  SELECT
    message_id,
    thread_id,
    `from` AS sender,
    `to` AS recipient,
    subject,
    body_preview,
    datetime,
    sentiment_score,
    company_domain,
    direction,
    ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY datetime DESC) AS reply_rank_desc,
    ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY datetime ASC) AS reply_rank_asc
  FROM `viewpers.salesguard_alerts.unified_email_messages`, params
  WHERE direction = 'outbound'
    AND datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 90 DAY)
)
SELECT *
FROM base;

-- 2) Reply quality table
CREATE TABLE IF NOT EXISTS `viewpers.salesguard_alerts.reply_quality` (
  message_id STRING,
  thread_id STRING,
  sender STRING,
  scored_at TIMESTAMP,
  score FLOAT64,
  politeness FLOAT64,
  specificity FLOAT64,
  coverage FLOAT64,
  structure FLOAT64,
  sentiment FLOAT64,
  level STRING,
  model_version STRING,
  signals STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(scored_at);

-- 3) Summary view
CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_reply_quality_summary` AS
WITH base AS (
  SELECT
    sender,
    DATE(scored_at) AS scored_date,
    score,
    level
  FROM `viewpers.salesguard_alerts.reply_quality`
)
SELECT
  sender,
  scored_date,
  COUNT(*) AS reply_count,
  AVG(score) AS avg_score,
  APPROX_QUANTILES(score, 100)[OFFSET(90)] AS p90_score,
  COUNTIF(level = 'High') AS high_count,
  COUNTIF(level = 'Low') AS low_count
FROM base
GROUP BY sender, scored_date;

-- 4) Similarity candidates view
CREATE OR REPLACE VIEW `viewpers.salesguard_alerts.vw_similar_candidates` AS
WITH params AS (
  SELECT IFNULL(MAX(datetime), CURRENT_TIMESTAMP()) AS anchor_time
  FROM `viewpers.salesguard_alerts.unified_email_messages`
)
SELECT
  message_id,
  thread_id,
  `from` AS sender,
  subject,
  body_preview,
  datetime,
  sentiment_score,
  company_domain,
  direction
FROM `viewpers.salesguard_alerts.unified_email_messages`, params
WHERE datetime >= TIMESTAMP_SUB(params.anchor_time, INTERVAL 180 DAY)
  AND direction IN ('outbound', 'inbound');
