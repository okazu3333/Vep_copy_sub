#!/bin/bash
# scripts/fix-body-only.sh
# body部分のみの軽量修正スクリプト（5分版）

set -e

echo "🔧 body部分修正開始（軽量版）"
echo "📊 対象: 771,705件のメールデータ"
echo "🎯 目標: message_bodyのみ適切にデコード"

# 設定
PROJECT_ID="viewpers"
DATASET_ID="salesguard_alerts_new"
SOURCE_TABLE="alerts_decoded"
TARGET_TABLE="alerts_body_fixed"
LOCATION="asia-northeast1"

echo ""
echo "📋 Step 1: body部分デコード処理開始（3分）..."

# 1. body部分のみのデコード処理
bq query --use_legacy_sql=false --location=${LOCATION} "
CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET_ID}.${TARGET_TABLE}\` AS
SELECT
  *,
  -- message_bodyのみを適切にデコード
  CASE 
    WHEN message_body LIKE '=?UTF-8?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(message_body, r'=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    WHEN message_body LIKE '=?ISO-2022-JP?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(message_body, r'=\?ISO-2022-JP\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    WHEN message_body LIKE '=?Shift_JIS?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(message_body, r'=\?Shift_JIS\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    WHEN message_body LIKE '%<email.message.Message%' THEN
      'メッセージ内容は現在表示できません（Pythonオブジェクト形式）'
    WHEN message_body LIKE '%$B%' THEN
      REGEXP_REPLACE(message_body, r'\$B([^$]*)\$([^$]*)', '') -- 日本語エンコード除去
    ELSE message_body
  END as message_body_fixed,
  
  -- デコード品質スコア
  CASE 
    WHEN message_body LIKE '=?UTF-8?B?%' AND 
         NOT message_body LIKE '=?UTF-8?B?%' THEN 1.0
    WHEN message_body LIKE '=?ISO-2022-JP?B?%' AND 
         NOT message_body LIKE '=?ISO-2022-JP?B?%' THEN 1.0
    WHEN message_body LIKE '=?Shift_JIS?B?%' AND 
         NOT message_body LIKE '=?Shift_JIS?B?%' THEN 1.0
    WHEN message_body LIKE '%<email.message.Message%' THEN 0.5
    WHEN message_body LIKE '%$B%' THEN 0.3
    ELSE 0.0
  END as body_decode_score,
  
  CURRENT_TIMESTAMP() as body_fixed_at
FROM \`${PROJECT_ID}.${DATASET_ID}.${SOURCE_TABLE}\`
"

echo "✅ body部分デコード処理完了"

echo ""
echo "🔍 Step 2: 品質確認（2分）..."

# 2. 品質確認
bq query --use_legacy_sql=false --location=${LOCATION} "
SELECT
  'body_decode_quality' as metric,
  COUNT(*) as total_records,
  COUNT(CASE WHEN message_body_fixed NOT LIKE '=?UTF-8?B?%' THEN 1 END) as decoded_bodies,
  COUNT(CASE WHEN message_body_fixed NOT LIKE '%<email.message.Message%' THEN 1 END) as non_python_objects,
  COUNT(CASE WHEN message_body_fixed NOT LIKE '%$B%' THEN 1 END) as non_encoded_data,
  COUNT(CASE WHEN message_body_fixed NOT LIKE '=?UTF-8?B?%' 
              AND message_body_fixed NOT LIKE '%<email.message.Message%' 
              AND message_body_fixed NOT LIKE '%$B%' 
              AND LENGTH(message_body_fixed) > 20 THEN 1 END) as valid_bodies,
  ROUND(AVG(body_decode_score), 3) as avg_decode_score,
  COUNT(CASE WHEN body_decode_score > 0 THEN 1 END) as improved_records
FROM \`${PROJECT_ID}.${DATASET_ID}.${TARGET_TABLE}\`
"

echo "✅ 品質確認完了"

echo ""
echo "📊 Step 3: サンプルデータ確認..."

# 3. サンプルデータ確認
bq query --use_legacy_sql=false --location=${LOCATION} "
SELECT
  message_sender_decoded as sender,
  message_subject_decoded as subject,
  LEFT(message_body, 50) as original_body_preview,
  LEFT(message_body_fixed, 50) as fixed_body_preview,
  body_decode_score,
  detected_keyword
FROM \`${PROJECT_ID}.${DATASET_ID}.${TARGET_TABLE}\`
WHERE body_decode_score > 0
ORDER BY body_decode_score DESC
LIMIT 10
"

echo "✅ サンプルデータ確認完了"

echo ""
echo "🎉 body部分修正完了！"
echo "📊 結果: 新しいテーブル ${PROJECT_ID}.${DATASET_ID}.${TARGET_TABLE} が作成されました"
echo "🔧 次のステップ: APIの更新で新しいテーブルを使用" 