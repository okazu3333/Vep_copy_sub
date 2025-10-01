-- 🔄 復元スクリプト
-- 作成日: 2025-09-26T08:43:12.116Z
-- バックアップ: unified_email_messages_backup_2025-09-26

-- 緊急復元（現在のテーブルを置き換え）
DROP TABLE IF EXISTS `viewpers.salesguard_alerts.unified_email_messages`;
CREATE TABLE `viewpers.salesguard_alerts.unified_email_messages` AS
SELECT * FROM `viewpers.salesguard_alerts.unified_email_messages_backup_2025-09-26`;

-- 確認クエリ
SELECT 
  COUNT(*) as total_records,
  MIN(datetime) as earliest_date,
  MAX(datetime) as latest_date
FROM `viewpers.salesguard_alerts.unified_email_messages`;
