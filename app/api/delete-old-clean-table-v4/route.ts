import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST() {
  try {
    console.log('🗑️ 古いクリーンテーブル（v4）削除開始')

    // 古いクリーンテーブル（alerts_clean_v4）を削除
    const deleteTableQuery = `
      DROP TABLE IF EXISTS \`viewpers.salesguard_alerts.alerts_clean_v4\`
    `

    await bigquery.query({
      query: deleteTableQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    // 削除後のテーブル一覧を確認
    const listTablesQuery = `
      SELECT table_id
      FROM \`viewpers.salesguard_alerts.__TABLES__\`
      WHERE table_id LIKE '%clean%'
      ORDER BY table_id
    `

    const listResult = await bigquery.query({
      query: listTablesQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const remainingTables = listResult[0]?.map((row: any) => row.table_id) || []

    return NextResponse.json({
      success: true,
      message: '古いクリーンテーブル（alerts_clean_v4）が正常に削除されました',
      deletedTable: 'viewpers.salesguard_alerts.alerts_clean_v4',
      remainingCleanTables: remainingTables,
      currentActiveTable: 'viewpers.salesguard_alerts.alerts_clean_v5'
    })

  } catch (error) {
    console.error('❌ 古いクリーンテーブル（v4）削除エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '古いクリーンテーブル（v4）の削除に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 