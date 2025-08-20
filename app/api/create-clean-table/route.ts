import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    // 指定された4つの除外条件でフィルタリングされたクリーンテーブルを作成
    const createTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.alerts_clean_filtered\` AS
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
        -- 指定された4つの除外条件を除外
        body NOT LIKE '%$B%' AND
        body NOT LIKE '%以下のとおり配信依頼送信完了しました%' AND
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
      FROM \`viewpers.salesguard_alerts.alerts_clean_filtered\`
    `

    const countResult = await bigquery.query({
      query: countQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const recordCount = countResult[0]?.[0]?.count || 0

    return NextResponse.json({
      success: true,
      message: 'クリーンテーブルが正常に作成されました',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_filtered',
      recordCount: recordCount,
      excludedConditions: [
        'body LIKE %$B% (文字化けデータ)',
        'body LIKE %以下のとおり配信依頼送信完了しました% (配信完了メール)',
        'from LIKE %facebookmail.com% (Facebookメール)',
        'from LIKE %ns.chatwork.com% (Chatworkメール)'
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
    // クリーンテーブルの状況を確認
    const checkQuery = `
      SELECT 
        table_id,
        row_count,
        size_bytes
      FROM \`viewpers.salesguard_alerts.__TABLES__\`
      WHERE table_id = 'alerts_clean_filtered'
    `

    const result = await bigquery.query({
      query: checkQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    if (result[0] && result[0].length > 0) {
      const tableInfo = result[0][0]
      return NextResponse.json({
        success: true,
        tableExists: true,
        tableInfo: tableInfo
      })
    } else {
      return NextResponse.json({
        success: true,
        tableExists: false,
        message: 'クリーンテーブルはまだ作成されていません'
      })
    }

  } catch (error) {
    console.error('Table check error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check table status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 