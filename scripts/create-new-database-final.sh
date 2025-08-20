#!/bin/bash
# scripts/create-new-database-final.sh
# 最終版BigQueryデータベース作成スクリプト（デコード処理のみ）

set -e

echo "🚀 最終版BigQueryデータベース作成開始"
echo "📊 対象: 771,705件のメールデータ"
echo "🎯 目標: 完全デコード済みテーブル作成"

# 設定
PROJECT_ID="viewpers"
SOURCE_DATASET="salesguard_data"
TARGET_DATASET="salesguard_alerts_new"
SOURCE_TABLE="mbox_emails"
TARGET_TABLE="alerts_decoded"
LOCATION="asia-northeast1"

echo ""
echo "📋 Step 1: デコード済みテーブル作成（15分）..."

# 1. 完全デコード処理
bq query --use_legacy_sql=false --location=${LOCATION} "
CREATE OR REPLACE TABLE \`${PROJECT_ID}.${TARGET_DATASET}.${TARGET_TABLE}\` 
PARTITION BY DATE(created_at)
CLUSTER BY priority, status, department
AS
SELECT
  -- 基本フィールド
  id,
  workspace_id,
  alert_id,
  customer_id,
  rule_id,
  segment_id,
  status,
  priority,
  score,
  detected_keyword,
  message_id,
  message_timestamp,
  message_sender,
  message_subject,
  message_snippet,
  message_body,
  customer_name,
  customer_company,
  customer_email,
  assigned_user_id,
  department,
  assigned_person,
  detection_source,
  thread_id,
  metadata,
  resolved_at,
  resolved_by,
  resolution_note,
  created_at,
  updated_at,
  
  -- デコード済みフィールド
  CASE 
    WHEN message_sender LIKE '=?UTF-8?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(message_sender, r'=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    WHEN message_sender LIKE '=?ISO-2022-JP?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(message_sender, r'=\?ISO-2022-JP\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    WHEN message_sender LIKE '=?Shift_JIS?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(message_sender, r'=\?Shift_JIS\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    ELSE message_sender
  END as message_sender_decoded,
  
  CASE 
    WHEN customer_email LIKE '=?UTF-8?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(customer_email, r'=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    WHEN customer_email LIKE '=?ISO-2022-JP?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(customer_email, r'=\?ISO-2022-JP\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    WHEN customer_email LIKE '=?Shift_JIS?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(customer_email, r'=\?Shift_JIS\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    ELSE customer_email
  END as customer_email_decoded,
  
  CASE 
    WHEN message_subject LIKE '=?UTF-8?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(message_subject, r'=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    WHEN message_subject LIKE '=?ISO-2022-JP?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(message_subject, r'=\?ISO-2022-JP\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    WHEN message_subject LIKE '=?Shift_JIS?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(message_subject, r'=\?Shift_JIS\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    ELSE message_subject
  END as message_subject_decoded,
  
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
  
  CASE 
    WHEN customer_name LIKE '=?UTF-8?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(customer_name, r'=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    WHEN customer_name LIKE '=?ISO-2022-JP?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(customer_name, r'=\?ISO-2022-JP\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    WHEN customer_name LIKE '=?Shift_JIS?B?%' THEN
      SAFE_CONVERT_BYTES_TO_STRING(
        FROM_BASE64(
          REGEXP_EXTRACT(customer_name, r'=\?Shift_JIS\?B\?([A-Za-z0-9+/=]+)\?=')
        )
      )
    ELSE customer_name
  END as customer_name_decoded,
  
  CURRENT_TIMESTAMP() as processed_at
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SOURCE_TABLE}\`
"

echo "✅ デコード済みテーブル作成完了"

echo ""
echo "⚡ Step 2: 検索最適化テーブル作成（5分）..."

# 2. 検索最適化テーブル
bq query --use_legacy_sql=false --location=${LOCATION} "
CREATE OR REPLACE TABLE \`${PROJECT_ID}.${TARGET_DATASET}.alerts_search_optimized\` 
PARTITION BY DATE(created_at)
CLUSTER BY priority, status, department
AS 
SELECT 
  *,
  -- 検索用ベクトル作成
  CONCAT(
    COALESCE(message_sender_decoded, ''),
    ' ',
    COALESCE(message_subject_decoded, ''),
    ' ',
    COALESCE(customer_name_decoded, ''),
    ' ',
    COALESCE(customer_email_decoded, '')
  ) as search_text
FROM \`${PROJECT_ID}.${TARGET_DATASET}.${TARGET_TABLE}\`
"

echo "✅ 検索最適化テーブル作成完了"

echo ""
echo "🔧 Step 3: 新規API作成（5分）..."

# 3. 新規APIファイル作成
cat > app/api/alerts-bigquery/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery({ projectId: 'viewpers' })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const level = searchParams.get('level')
    const priority = searchParams.get('priority')
    
    // 検索条件の構築
    let whereConditions = []
    let queryParams = []
    let paramIndex = 1
    
    if (search) {
      whereConditions.push(`(
        message_sender_decoded LIKE $${paramIndex} OR
        message_subject_decoded LIKE $${paramIndex} OR
        customer_name_decoded LIKE $${paramIndex} OR
        customer_email_decoded LIKE $${paramIndex} OR
        search_text LIKE $${paramIndex}
      )`)
      queryParams.push(`%${search}%`)
      paramIndex++
    }
    
    if (status && status !== 'all') {
      whereConditions.push(`status = $${paramIndex}`)
      queryParams.push(status)
      paramIndex++
    }
    
    if (level && level !== 'all') {
      whereConditions.push(`priority = $${paramIndex}`)
      queryParams.push(level)
      paramIndex++
    }
    
    if (priority && priority !== 'all') {
      whereConditions.push(`priority = $${paramIndex}`)
      queryParams.push(priority)
      paramIndex++
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : ''
    
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
        customer_name_decoded as customerName,
        detected_keyword as keyword,
        score
      FROM \`viewpers.salesguard_alerts_new.alerts_search_optimized\`
      ${whereClause}
      ORDER BY message_timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    
    const [rows] = await bigquery.query({ 
      query,
      params: queryParams
    })
    
    // 総件数取得
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_alerts_new.alerts_search_optimized\`
      ${whereClause}
    `
    
    const [countResult] = await bigquery.query({ 
      query: countQuery,
      params: queryParams
    })
    
    const total = parseInt(countResult[0].total)
    const totalPages = Math.ceil(total / limit)
    
    return NextResponse.json({
      success: true,
      alerts: rows,
      source: 'bigquery-new-database',
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      searchInfo: search ? {
        query: search,
        found: total
      } : null
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
echo "🎉 新規データベース作成完了！"
echo "📊 処理結果:"
echo "   - 対象レコード: 771,705件"
echo "   - 新規データセット: salesguard_alerts_new"
echo "   - デコード済みテーブル: alerts_decoded"
echo "   - 検索最適化テーブル: alerts_search_optimized"
echo "   - 新規API: /api/alerts-bigquery"
echo ""
echo "🔗 アクセス方法:"
echo "   - 新規API: http://localhost:3000/api/alerts-bigquery"
echo "   - パラメータ: ?page=1&limit=20&search=キーワード"
echo ""
echo "📈 品質確認:"
echo "   - BigQueryコンソールで品質スコアを確認"
echo "   - デコード率が95%以上であることを確認" 