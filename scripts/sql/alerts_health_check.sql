-- Alerts health check: last 120 and 30 day daily counts, max datetime, keyword coverage.
-- Parameters: @start_120 (DATE), @start_30 (DATE)

DECLARE start_120 DATE DEFAULT DATE_SUB(CURRENT_DATE('Asia/Tokyo'), INTERVAL 119 DAY);
DECLARE start_30 DATE DEFAULT DATE_SUB(CURRENT_DATE('Asia/Tokyo'), INTERVAL 29 DAY);

-- Daily counts for last 120 days
WITH daily AS (
  SELECT
    DATE(datetime) AS day,
    COUNT(*) AS alert_count,
    COUNTIF(keyword IS NOT NULL AND keyword != '') AS keyword_count,
    MAX(datetime) AS max_datetime
  FROM `viewpers.salesguard_alerts.alerts_v2_scored`
  WHERE datetime >= TIMESTAMP(start_120, 'Asia/Tokyo')
  GROUP BY day
),
summary AS (
  SELECT
    COUNT(*) AS total_days,
    SUM(IF(alert_count = 0, 1, 0)) AS zero_days,
    MIN(alert_count) AS min_alerts,
    MAX(alert_count) AS max_alerts
  FROM daily
)
SELECT * FROM daily ORDER BY day DESC;

SELECT * FROM summary;

-- Daily counts for last 30 days
WITH daily AS (
  SELECT
    DATE(datetime) AS day,
    COUNT(*) AS alert_count,
    COUNTIF(keyword IS NOT NULL AND keyword != '') AS keyword_count,
    MAX(datetime) AS max_datetime
  FROM `viewpers.salesguard_alerts.alerts_v2_scored`
  WHERE datetime >= TIMESTAMP(start_30, 'Asia/Tokyo')
  GROUP BY day
)
SELECT * FROM daily ORDER BY day DESC;

-- Max datetime overall
SELECT MAX(datetime) AS last_datetime
FROM `viewpers.salesguard_alerts.alerts_v2_scored`;
