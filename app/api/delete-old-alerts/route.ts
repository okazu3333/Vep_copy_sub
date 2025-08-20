import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function DELETE(request: NextRequest) {
  try {
    // 削除前の確認
    const checkQuery = `
      SELECT 
        COUNT(*) as count,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record
      FROM \`viewpers.salesguard_alerts.alerts\`
    `

    const checkResult = await bigquery.query({
      query: checkQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const recordInfo = checkResult[0]?.[0] || {}

    // テーブル削除
    const deleteQuery = `DROP TABLE \`viewpers.salesguard_alerts.alerts\``
    
    await bigquery.query({
      query: deleteQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    return NextResponse.json({
      success: true,
      message: '古いalertsテーブルを削除しました',
      deleted_table: {
        name: 'viewpers.salesguard_alerts.alerts',
        record_count: recordInfo.count,
        oldest_record: recordInfo.oldest_record,
        newest_record: recordInfo.newest_record
      },
      remaining_tables: [
        'viewpers.salesguard_alerts.alerts_v2',
        'viewpers.salesguard_alerts.email_messages'
      ]
    })

  } catch (error) {
    console.error('Delete old alerts API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete old alerts table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GETメソッドで削除前の確認のみ
export async function GET(request: NextRequest) {
  try {
    const checkQuery = `
      SELECT 
        COUNT(*) as count,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record
      FROM \`viewpers.salesguard_alerts.alerts\`
    `

    const checkResult = await bigquery.query({
      query: checkQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const recordInfo = checkResult[0]?.[0] || {}

    return NextResponse.json({
      success: true,
      message: '削除対象のalertsテーブルの確認',
      table_info: {
        name: 'viewpers.salesguard_alerts.alerts',
        record_count: recordInfo.count,
        oldest_record: recordInfo.oldest_record,
        newest_record: recordInfo.newest_record
      },
      warning: 'このテーブルを削除するにはDELETEメソッドを使用してください'
    })

  } catch (error) {
    console.error('Check old alerts API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check old alerts table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 