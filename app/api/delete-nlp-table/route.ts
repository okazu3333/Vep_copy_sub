import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST() {
  try {
    console.log('🗑️ nlp_analysis_resultsテーブル削除開始...')

    // テーブル削除
    const dropTableQuery = `DROP TABLE IF EXISTS \`viewpers.salesguard_alerts.nlp_analysis_results\``
    await bigquery.query({ query: dropTableQuery, useLegacySql: false })
    console.log('✅ nlp_analysis_resultsテーブルを削除しました')

    // 残存テーブルの確認
    const remainingTablesQuery = `
      SELECT table_id, creation_time, row_count, size_bytes 
      FROM \`viewpers.salesguard_alerts.__TABLES__\` 
      WHERE table_id = 'nlp_analysis_results'
    `
    const [remainingTables] = await bigquery.query({ query: remainingTablesQuery, useLegacySql: false })

    if (remainingTables && remainingTables.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'テーブルが削除されていません',
        remaining_tables: remainingTables
      })
    }

    return NextResponse.json({
      success: true,
      message: 'nlp_analysis_resultsテーブルが正常に削除されました',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ テーブル削除エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete table',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 