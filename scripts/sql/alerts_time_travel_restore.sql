-- Time travel restore template for alerts_v2_scored (replace timestamps accordingly)
-- This restores a snapshot from 24 hours ago into a temporary table, then MERGE back.

DECLARE snapshot_timestamp TIMESTAMP DEFAULT TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR);
DECLARE restore_start DATE DEFAULT DATE_SUB(CURRENT_DATE('Asia/Tokyo'), INTERVAL 90 DAY);

-- 1. Create snapshot table from time travel
CREATE OR REPLACE TABLE `viewpers.salesguard_alerts.alerts_v2_scored_snapshot`
PARTITION BY DATE(datetime)
CLUSTER BY thread_id, datetime AS
SELECT *
FROM `viewpers.salesguard_alerts.alerts_v2_scored`
FOR SYSTEM_TIME AS OF snapshot_timestamp
WHERE DATE(datetime) BETWEEN restore_start AND CURRENT_DATE('Asia/Tokyo');

-- 2. MERGE back missing data (message_id as key)
MERGE `viewpers.salesguard_alerts.alerts_v2_scored` T
USING `viewpers.salesguard_alerts.alerts_v2_scored_snapshot` S
ON T.message_id = S.message_id
WHEN NOT MATCHED THEN INSERT ROW
WHEN MATCHED THEN UPDATE SET
  T.status = S.status,
  T.level = S.level,
  T.score = S.score,
  T.keyword = S.keyword,
  T.department = S.department,
  T.customer_email = S.customer_email,
  T.datetime = S.datetime,
  T.person = S.person,
  T.description = S.description,
  T.messageBody = S.messageBody,
  T.thread_id = S.thread_id,
  T.reply_level = S.reply_level,
  T.is_root = S.is_root,
  T.source_file = S.source_file;

-- 3. Drop snapshot when finished
DROP TABLE `viewpers.salesguard_alerts.alerts_v2_scored_snapshot`;
