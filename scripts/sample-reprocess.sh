#!/bin/bash
# scripts/sample-reprocess.sh
# サンプル再処理（1個のZIPファイルのみ）

set -e

echo "🔧 サンプル再処理開始（1個のZIPファイル）"
echo "📊 対象: 1個のZIPファイル"
echo "🎯 目標: 効果確認とコスト検証"

# 設定
PROJECT_ID="viewpers"
DATASET_ID="salesguard_alerts_new"
TARGET_TABLE="alerts_sample_fixed"
LOCATION="asia-northeast1"

echo ""
echo "📋 Step 1: サンプルZIPファイルの確認..."

# 1. 利用可能なZIPファイルを確認
echo "利用可能なZIPファイル:"
gsutil ls gs://salesguarddata/salesguarddata/*.zip | head -5

echo ""
echo "📦 Step 2: サンプル処理開始（30分）..."

# 2. 最初の1個のZIPファイルを処理
SAMPLE_ZIP=$(gsutil ls gs://salesguarddata/salesguarddata/*.zip | head -1)
echo "処理対象: $SAMPLE_ZIP"

# 3. サンプル処理の実行
node scripts/fix-python-objects.js --sample --zip-file="$SAMPLE_ZIP"

echo ""
echo "🔍 Step 3: 結果確認..."

# 4. 処理結果の確認
bq query --use_legacy_sql=false --location=${LOCATION} "
SELECT
  'sample_quality' as metric,
  COUNT(*) as total_records,
  COUNT(CASE WHEN message_body NOT LIKE '%<email.message.Message%' THEN 1 END) as valid_bodies,
  COUNT(CASE WHEN message_body NOT LIKE '%$B%' THEN 1 END) as non_encoded,
  COUNT(CASE WHEN LENGTH(message_body) > 20 THEN 1 END) as meaningful_content,
  COUNT(CASE WHEN detected_keyword IS NOT NULL AND detected_keyword != '' THEN 1 END) as keyword_detected
FROM \`${PROJECT_ID}.${DATASET_ID}.${TARGET_TABLE}\`
"

echo ""
echo "📊 Step 4: サンプルデータ確認..."

# 5. サンプルデータの確認
bq query --use_legacy_sql=false --location=${LOCATION} "
SELECT
  message_sender,
  message_subject,
  LEFT(message_body, 100) as body_preview,
  detected_keyword,
  priority
FROM \`${PROJECT_ID}.${DATASET_ID}.${TARGET_TABLE}\`
WHERE message_body NOT LIKE '%<email.message.Message%'
  AND LENGTH(message_body) > 20
LIMIT 5
"

echo ""
echo "🎉 サンプル処理完了！"
echo "📊 結果を確認して、本格処理の判断をしてください"
echo "💰 推定コスト: $2（サンプル処理）"
echo "⏱️  推定時間: 30分" 