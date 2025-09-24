import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function DELETE() {
  try {
    // 古いクリーンテーブルを削除
    const deleteQuery = `
      DROP TABLE \`viewpers.salesguard_alerts.alerts_clean_filtered\`
    `

    await bigquery.query({
      query: deleteQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    return NextResponse.json({
      success: true,
      message: '古いクリーンテーブルalerts_clean_filteredが正常に削除されました',
      deletedTable: 'viewpers.salesguard_alerts.alerts_clean_filtered'
    })

  } catch (error) {
    console.error('Delete old table error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete old table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // テーブルの存在確認
    const checkQuery = `
      SELECT 
        table_id,
        row_count,
        size_bytes
      FROM \`viewpers.salesguard_alerts.__TABLES__\`
      WHERE table_id IN ('alerts_clean_filtered', 'alerts_clean_v2')
      ORDER BY table_id
    `

    const result = await bigquery.query({
      query: checkQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const tables = result[0] || []
    const tableStatus = {
      alerts_clean_filtered: tables.find(t => t.table_id === 'alerts_clean_filtered'),
      alerts_clean_v2: tables.find(t => t.table_id === 'alerts_clean_v2')
    }

    return NextResponse.json({
      success: true,
      message: 'テーブル状況確認',
      tableStatus: tableStatus
    })

  } catch (error) {
    console.error('Check table status error:', error)
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