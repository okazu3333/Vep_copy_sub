import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST() {
  try {
    // learn@メールアドレスを除外した新しいクリーンテーブルを作成
    const createUpdatedTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.alerts_clean_filtered_v2\` AS
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
        alert_id,
        detected_keyword,
        priority,
        status,
        score,
        department,
        customer_email,
        alert_id_formatted
      FROM \`viewpers.salesguard_alerts.alerts_clean_filtered\`
      WHERE (
        -- 既存の除外条件に加えて、learn@も除外
        \`from\` NOT LIKE '%learn@%'
      )
    `

    await bigquery.query({
      query: createUpdatedTableQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    // 更新後の件数を確認
    const countQuery = `
      SELECT COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.alerts_clean_filtered_v2\`
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
      FROM \`viewpers.salesguard_alerts.alerts_clean_filtered\`
      WHERE \`from\` LIKE '%learn@%'
    `

    const excludedResult = await bigquery.query({
      query: excludedCountQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const excludedCount = excludedResult[0]?.[0]?.count || 0

    return NextResponse.json({
      success: true,
      message: 'learn@メールアドレスを除外したクリーンテーブルが作成されました',
      oldTableName: 'viewpers.salesguard_alerts.alerts_clean_filtered',
      newTableName: 'viewpers.salesguard_alerts.alerts_clean_filtered_v2',
      oldRecordCount: 1364,
      newRecordCount: recordCount,
      excludedRecords: excludedCount,
      excludedConditions: [
        'body LIKE %$B% (文字化けデータ)',
        'body LIKE %以下のとおり配信依頼送信完了しました% (配信完了メール)',
        'from LIKE %facebookmail.com% (Facebookメール)',
        'from LIKE %ns.chatwork.com% (Chatworkメール)',
        'from LIKE %learn@% (学習関連メール)'
      ]
    })

  } catch (error) {
    console.error('Update clean table error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update clean table',
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
    
    // 新しいクリーンテーブルの内容を確認
    const checkQuery = `
      SELECT 
        thread_id,
        alert_id,
        alert_id_formatted,
        subject,
        \`from\`,
        \`to\`,
        date,
        reply_level,
        is_root
      FROM \`viewpers.salesguard_alerts.alerts_clean_filtered_v2\`
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
      message: 'learn@除外後のクリーンテーブル確認',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_filtered_v2',
      recordCount: records.length,
      records: records
    })

  } catch (error) {
    console.error('Check updated table error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check updated table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 