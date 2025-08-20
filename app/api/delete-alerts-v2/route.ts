import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function DELETE(request: NextRequest) {
  try {
    // 削除前の確認
    const checkQuery = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(DISTINCT thread_id) as unique_threads
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
    `

    const checkResult = await bigquery.query({
      query: checkQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const recordInfo = checkResult[0]?.[0] || {}

    // テーブル削除
    const deleteQuery = `DROP TABLE \`viewpers.salesguard_alerts.alerts_v2\``
    
    await bigquery.query({
      query: deleteQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    return NextResponse.json({
      success: true,
      message: '不要なalerts_v2テーブルを削除しました',
      deleted_table: {
        name: 'viewpers.salesguard_alerts.alerts_v2',
        total_records: recordInfo.total_count,
        unique_threads: recordInfo.unique_threads
      },
      remaining_tables: [
        'viewpers.salesguard_alerts.alerts_clean',
        'viewpers.salesguard_alerts.email_messages'
      ]
    })

  } catch (error) {
    console.error('Delete alerts v2 API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete alerts v2 table',
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
        COUNT(*) as total_count,
        COUNT(DISTINCT thread_id) as unique_threads
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
    `

    const checkResult = await bigquery.query({
      query: checkQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
      })

    const recordInfo = checkResult[0]?.[0] || {}

    return NextResponse.json({
      success: true,
      message: '削除対象のalerts_v2テーブルの確認',
      table_info: {
        name: 'viewpers.salesguard_alerts.alerts_v2',
        total_records: recordInfo.total_count,
        unique_threads: recordInfo.unique_threads
      },
      warning: 'このテーブルを削除するにはDELETEメソッドを使用してください'
    })

  } catch (error) {
    console.error('Check alerts v2 API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check alerts v2 table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 