-- 実データ運用前のテーブル構造確認用SQL
-- BigQueryコンソールで実行して、実際のカラム名を確認

-- =====================
-- 1. alerts_v2_scoredテーブルの構造確認
-- =====================
SELECT 
  column_name,
  data_type,
  is_nullable,
  description
FROM `viewpers.salesguard_alerts.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'alerts_v2_scored'
  AND (
    -- セグメント関連
    column_name LIKE '%segment%' OR
    -- ID関連
    column_name LIKE '%alert%' OR
    column_name = 'id' OR
    -- スコア関連
    column_name LIKE '%score%' OR
    column_name LIKE '%urgency%' OR
    column_name LIKE '%sentiment%' OR
    -- ステータス関連
    column_name = 'status' OR
    -- タイムスタンプ関連
    column_name LIKE '%updated%' OR
    column_name LIKE '%created%' OR
    -- スレッド関連
    column_name LIKE '%thread%'
  )
ORDER BY ordinal_position;

-- =====================
-- 2. セグメントカラムの確認
-- =====================
SELECT DISTINCT
  primary_segment,  -- または primarySegment
  COUNT(*) AS count
FROM `viewpers.salesguard_alerts.alerts_v2_scored`
GROUP BY primary_segment  -- または primarySegment
ORDER BY count DESC
LIMIT 20;

-- =====================
-- 3. ステータスカラムの確認
-- =====================
SELECT DISTINCT
  status,
  COUNT(*) AS count
FROM `viewpers.salesguard_alerts.alerts_v2_scored`
GROUP BY status
ORDER BY count DESC;

-- =====================
-- 4. IDカラムの確認
-- =====================
-- alert_idが存在するか確認
SELECT 
  COUNT(*) AS total_rows,
  COUNT(alert_id) AS alert_id_count,  -- または id
  COUNT(DISTINCT alert_id) AS unique_alert_ids  -- または id
FROM `viewpers.salesguard_alerts.alerts_v2_scored`
LIMIT 1;

-- =====================
-- 5. 依存テーブルの存在確認
-- =====================
SELECT 
  table_name,
  table_type,
  creation_time
FROM `viewpers.salesguard_alerts.INFORMATION_SCHEMA.TABLES`
WHERE table_name IN (
  'unified_email_messages',
  'incident_outcomes',
  'reply_quality',
  'detection_alerts',
  'alert_segment_history',
  'alert_auto_resolutions'
)
ORDER BY table_name;

-- =====================
-- 6. unified_email_messagesテーブルの構造確認
-- =====================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM `viewpers.salesguard_alerts.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'unified_email_messages'
  AND (
    column_name LIKE '%thread%' OR
    column_name LIKE '%datetime%' OR
    column_name LIKE '%direction%' OR
    column_name LIKE '%sentiment%'
  )
ORDER BY ordinal_position;

-- =====================
-- 7. サンプルデータの確認（実際のカラム名を確認）
-- =====================
SELECT 
  thread_id,
  alert_id,  -- または id
  primary_segment,  -- または primarySegment
  status,
  detection_score,
  urgency_score,
  sentiment_score,
  updated_at
FROM `viewpers.salesguard_alerts.alerts_v2_scored`
WHERE status IN ('unhandled', 'in_progress')
LIMIT 5;


