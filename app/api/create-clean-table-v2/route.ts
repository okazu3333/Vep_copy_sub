import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    // 第1弾除外条件でフィルタリングされたクリーンテーブルを作成
    const createTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.alerts_clean_v2\` AS
      SELECT 
        thread_id,
        message_id,
        subject,
        \`from\`,
        \`to\`,
        body,
        date,
        reply_level,
        is_root,
        source_file,
        -- アラート関連フィールド
        ROW_NUMBER() OVER (ORDER BY MIN(date)) as alert_id,
        'キーワード未設定' as detected_keyword,
        '中' as priority,
        '新規' as status,
        50 as score,
        '営業部' as department,
        COALESCE(\`to\`, 'customer@example.com') as customer_email
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE (
        -- 第1弾除外条件
        -- 1. 文字化けデータ
        body NOT LIKE '%?%' AND
        body NOT LIKE '%$B%' AND
        
        -- 2. 配信管理システム
        \`from\` NOT LIKE '%md_sys_admin@%' AND
        
        -- 3. 自動メール
        \`from\` NOT LIKE '%info@%' AND
        \`from\` NOT LIKE '%noreply@%' AND
        \`from\` NOT LIKE '%support@%' AND
        \`from\` NOT LIKE '%magazine@%' AND
        \`from\` NOT LIKE '%learn@%' AND
        
        -- 4. システムメール
        \`from\` NOT LIKE '%root@%' AND
        \`from\` NOT LIKE '%kintai@%' AND
        
        -- 5. 外部サービス
        \`from\` NOT LIKE '%facebookmail.com%' AND
        \`from\` NOT LIKE '%ns.chatwork.com%'
      )
      GROUP BY thread_id, message_id, subject, \`from\`, \`to\`, body, date, reply_level, is_root, source_file
    `

    const result = await bigquery.query({
      query: createTableQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    // 作成されたテーブルの件数を確認
    const countQuery = `
      SELECT COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.alerts_clean_v2\`
    `

    const countResult = await bigquery.query({
      query: countQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const recordCount = countResult[0]?.[0]?.count || 0

    // 除外された件数も確認
    const excludedCountQuery = `
      SELECT COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE (
        body LIKE '%?%' OR
        body LIKE '%$B%' OR
        \`from\` LIKE '%md_sys_admin@%' OR
        \`from\` LIKE '%info@%' OR
        \`from\` LIKE '%noreply@%' OR
        \`from\` LIKE '%support@%' OR
        \`from\` LIKE '%magazine@%' OR
        \`from\` LIKE '%learn@%' OR
        \`from\` LIKE '%root@%' OR
        \`from\` LIKE '%kintai@%' OR
        \`from\` LIKE '%facebookmail.com%' OR
        \`from\` LIKE '%ns.chatwork.com%'
      )
    `

    const excludedResult = await bigquery.query({
      query: excludedCountQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const excludedCount = excludedResult[0]?.[0]?.count || 0

    return NextResponse.json({
      success: true,
      message: '第1弾除外条件でクリーンテーブルが正常に作成されました',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_v2',
      recordCount: recordCount,
      excludedRecords: excludedCount,
      originalRecords: 1721,
      exclusionPercentage: Math.round((excludedCount / 1721) * 100),
      excludedConditions: [
        'body LIKE %?% (文字化けデータ)',
        'body LIKE %$B% (文字化けデータ)',
        'from LIKE %md_sys_admin@% (配信管理システム)',
        'from LIKE %info@% (自動メール)',
        'from LIKE %noreply@% (自動メール)',
        'from LIKE %support@% (自動メール)',
        'from LIKE %magazine@% (自動メール)',
        'from LIKE %learn@% (自動メール)',
        'from LIKE %root@% (システムメール)',
        'from LIKE %kintai@% (システムメール)',
        'from LIKE %facebookmail.com% (外部サービス)',
        'from LIKE %ns.chatwork.com% (外部サービス)'
      ]
    })

  } catch (error) {
    console.error('Clean table creation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create clean table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5')
    
    // 第1弾除外後のクリーンテーブルの内容を確認
    const checkQuery = `
      SELECT 
        thread_id,
        alert_id,
        subject,
        \`from\`,
        \`to\`,
        date,
        reply_level,
        is_root
      FROM \`viewpers.salesguard_alerts.alerts_clean_v2\`
      ORDER BY alert_id DESC
      LIMIT ${limit}
    `

    const result = await bigquery.query({
      query: checkQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const records = result[0] || []

    return NextResponse.json({
      success: true,
      message: '第1弾除外後のクリーンテーブル確認',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_v2',
      recordCount: records.length,
      records: records
    })

  } catch (error) {
    console.error('Check clean table error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check clean table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 