#!/bin/bash
# scripts/ultra-fast-migration.sh
# 30分版超最速移行スクリプト（message_bodyデコード含む）

set -e

echo "🚀 超最速移行開始（30分版）"
echo "📊 対象: 771,705件のメールデータ"
echo "🎯 目標: message_body含む完全デコード"

# 設定
PROJECT_ID="viewpers"
DATASET_ID="salesguard_data"
SOURCE_TABLE="mbox_emails"
TARGET_TABLE="mbox_emails_decoded_complete"

echo ""
echo "📋 Step 1: 基本デコード処理開始（15分）..."

# 1. 完全デコード処理（message_body含む）
bq query --use_legacy_sql=false "
CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET_ID}.${TARGET_TABLE}\` AS
SELECT
  *,
  -- 送信者デコード
  CASE 
    WHEN message_sender LIKE '=?UTF-8?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(message_sender, r'=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    ELSE message_sender
  END as message_sender_decoded,
  
  -- 受信者デコード
  CASE 
    WHEN customer_email LIKE '=?UTF-8?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(customer_email, r'=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    ELSE customer_email
  END as customer_email_decoded,
  
  -- 件名デコード
  CASE 
    WHEN message_subject LIKE '=?UTF-8?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(message_subject, r'=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    ELSE message_subject
  END as message_subject_decoded,
  
  -- message_bodyデコード（重要）
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
    ELSE message_body
  END as message_body_decoded,
  
  -- 品質スコア計算
  CASE 
    WHEN (message_sender LIKE '=?UTF-8?B?%' AND message_sender_decoded NOT LIKE '=?UTF-8?B?%') OR
         (customer_email LIKE '=?UTF-8?B?%' AND customer_email_decoded NOT LIKE '=?UTF-8?B?%') OR
         (message_subject LIKE '=?UTF-8?B?%' AND message_subject_decoded NOT LIKE '=?UTF-8?B?%') OR
         (message_body LIKE '=?UTF-8?B?%' AND message_body_decoded NOT LIKE '=?UTF-8?B?%') THEN 1.0
    ELSE 0.0
  END as decode_quality_score,
  
  CURRENT_TIMESTAMP() as processed_at
FROM \`${PROJECT_ID}.${DATASET_ID}.${SOURCE_TABLE}\`
"

echo "✅ 基本デコード処理完了"

echo ""
echo "🔍 Step 2: 品質確認（5分）..."

# 2. 品質確認
bq query --use_legacy_sql=false "
SELECT
  'decode_quality' as metric,
  COUNT(*) as total_records,
  COUNT(CASE WHEN message_sender_decoded NOT LIKE '=?UTF-8?B?%' THEN 1 END) as decoded_senders,
  COUNT(CASE WHEN customer_email_decoded NOT LIKE '=?UTF-8?B?%' THEN 1 END) as decoded_recipients,
  COUNT(CASE WHEN message_subject_decoded NOT LIKE '=?UTF-8?B?%' THEN 1 END) as decoded_subjects,
  COUNT(CASE WHEN message_body_decoded NOT LIKE '=?UTF-8?B?%' THEN 1 END) as decoded_bodies,
  ROUND(AVG(decode_quality_score), 3) as avg_quality_score,
  COUNT(CASE WHEN decode_quality_score = 0 THEN 1 END) as failed_decodes
FROM \`${PROJECT_ID}.${DATASET_ID}.${TARGET_TABLE}\`
"

echo "✅ 品質確認完了"

echo ""
echo "⚡ Step 3: 最適化処理（5分）..."

# 3. 最適化テーブル作成
bq query --use_legacy_sql=false "
CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET_ID}.mbox_emails_optimized\` 
PARTITION BY DATE(created_at)
CLUSTER BY message_sender_decoded, customer_email_decoded, decode_quality_score
AS SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.${TARGET_TABLE}\`
"

echo "✅ 最適化処理完了"

echo ""
echo "🔧 Step 4: 最小限API作成（5分）..."

# 4. 新規APIファイル作成
cat > app/api/alerts-new/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery({ projectId: 'viewpers' })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    
    const query = `
      SELECT 
        alert_id as id,
        message_sender_decoded as person,
        message_subject_decoded as description,
        message_body_decoded as messageBody,
        priority as level,
        status,
        message_timestamp as datetime,
        department,
        customer_email_decoded as customerEmail,
        decode_quality_score as quality
      FROM \`viewpers.salesguard_data.mbox_emails_optimized\`
      WHERE message_sender_decoded IS NOT NULL
      ORDER BY message_timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    
    const [rows] = await bigquery.query({ query })
    
    return NextResponse.json({
      success: true,
      alerts: rows,
      source: 'bigquery-new',
      total: rows.length,
      page,
      limit
    })
    
  } catch (error) {
    console.error('BigQuery API error:', error)
    return NextResponse.json({
      success: false,
      message: 'データ取得に失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
EOF

echo "✅ 新規API作成完了"

echo ""
echo "🎉 移行完了！"
echo "📊 処理結果:"
echo "   - 対象レコード: 771,705件"
echo "   - デコード対象: message_sender, customer_email, message_subject, message_body"
echo "   - 新規API: /api/alerts-new"
echo "   - 最適化テーブル: mbox_emails_optimized"
echo ""
echo "🔗 アクセス方法:"
echo "   - 新規API: http://localhost:3000/api/alerts-new"
echo "   - パラメータ: ?page=1&limit=20"
echo ""
echo "📈 品質確認:"
echo "   - BigQueryコンソールで品質スコアを確認"
echo "   - デコード率が95%以上であることを確認" 