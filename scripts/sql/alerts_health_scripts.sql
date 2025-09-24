-- Helper script: report days with low/zero counts within last 120 days
DECLARE threshold INT64 DEFAULT 10;
DECLARE start_120 DATE DEFAULT DATE_SUB(CURRENT_DATE('Asia/Tokyo'), INTERVAL 119 DAY);

WITH daily AS (
  SELECT DATE(datetime) AS day, COUNT(*) AS alert_count
  FROM `viewpers.salesguard_alerts.alerts_v2_scored`
  WHERE datetime >= TIMESTAMP(start_120, 'Asia/Tokyo')
  GROUP BY day
)
SELECT day, alert_count
FROM daily
WHERE alert_count <= threshold
ORDER BY day;

-- Identify gaps (days missing entirely)
DECLARE start_date DATE DEFAULT DATE_SUB(CURRENT_DATE('Asia/Tokyo'), INTERVAL 119 DAY);
DECLARE end_date DATE DEFAULT CURRENT_DATE('Asia/Tokyo');

WITH calendar AS (
  SELECT day
  FROM UNNEST(GENERATE_DATE_ARRAY(start_date, end_date)) AS day
),
daily AS (
  SELECT DATE(datetime) AS day, COUNT(*) AS alert_count
  FROM `viewpers.salesguard_alerts.alerts_v2_scored`
  WHERE datetime >= TIMESTAMP(start_date, 'Asia/Tokyo')
  GROUP BY day
)
SELECT calendar.day
FROM calendar
LEFT JOIN daily USING (day)
WHERE daily.day IS NULL
ORDER BY calendar.day;
