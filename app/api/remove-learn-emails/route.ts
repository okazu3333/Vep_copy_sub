import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    // 既存のクリーンテーブルからlearn@メールアドレスを削除
    const deleteQuery = `
      DELETE FROM \`viewpers.salesguard_alerts.alerts_clean_filtered\`
      WHERE \`from\` LIKE '%learn@%'
    `

    const result = await bigquery.query({
      query: deleteQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    // 削除後の件数を確認
    const countQuery = `
      SELECT COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.alerts_clean_filtered\`
    `

    const countResult = await bigquery.query({
      query: countQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const remainingCount = countResult[0]?.[0]?.count || 0

    // 削除された件数も確認
    const deletedCountQuery = `
      SELECT COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.alerts_clean_filtered\`
      WHERE \`from\` LIKE '%learn@%'
    `

    const deletedResult = await bigquery.query({
      query: deletedCountQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const deletedCount = deletedResult[0]?.[0]?.count || 0

    return NextResponse.json({
      success: true,
      message: 'learn@メールアドレスが既存のクリーンテーブルから削除されました',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_filtered',
      deletedRecords: deletedCount,
      remainingRecords: remainingCount,
      excludedConditions: [
        'body LIKE %$B% (文字化けデータ)',
        'body LIKE %以下のとおり配信依頼送信完了しました% (配信完了メール)',
        'from LIKE %facebookmail.com% (Facebookメール)',
        'from LIKE %ns.chatwork.com% (Chatworkメール)',
        'from LIKE %learn@% (学習関連メール) - 削除済み'
      ]
    })

  } catch (error) {
    console.error('Remove learn emails error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to remove learn emails',
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
    
    // learn@削除後のクリーンテーブルの内容を確認
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
      FROM \`viewpers.salesguard_alerts.alerts_clean_filtered\`
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
      message: 'learn@削除後のクリーンテーブル確認',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_filtered',
      recordCount: records.length,
      records: records
    })

  } catch (error) {
    console.error('Check table after deletion error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check table after deletion',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 