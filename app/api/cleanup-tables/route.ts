import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 不要なテーブル削除開始...')

    const { action } = await request.json()

    if (action === 'list_tables') {
      // テーブル一覧を取得
      const listTablesQuery = `
        SELECT table_id, creation_time, row_count, size_bytes 
        FROM \`viewpers.salesguard_alerts.__TABLES__\` 
        ORDER BY table_id
      `
      const [tables] = await bigquery.query({ query: listTablesQuery, useLegacySql: false })
      
      return NextResponse.json({
        success: true,
        tables: tables || [],
        timestamp: new Date().toISOString()
      })

    } else if (action === 'delete_test_tables') {
      // テスト用テーブルを削除
      const tablesToDelete = [
        'test_simple_insert',
        'nlp_analysis_results_old',
        'nlp_analysis_results_backup'
      ]

      const deletedTables = []
      const errors = []

      for (const tableName of tablesToDelete) {
        try {
          const dropQuery = `DROP TABLE IF EXISTS \`viewpers.salesguard_alerts.${tableName}\``
          await bigquery.query({ query: dropQuery, useLegacySql: false })
          deletedTables.push(tableName)
          console.log(`✅ テーブル削除完了: ${tableName}`)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          errors.push({ table: tableName, error: errorMsg })
          console.error(`❌ テーブル削除エラー ${tableName}:`, error)
        }
      }

      return NextResponse.json({
        success: true,
        deleted_tables: deletedTables,
        errors: errors,
        timestamp: new Date().toISOString()
      })

    } else if (action === 'delete_duplicate_tables') {
      // 重複・古いテーブルを削除
      const tablesToDelete = [
        'nlp_analysis_results_v1',
        'nlp_analysis_results_v2',
        'nlp_analysis_results_backup',
        'segment_distribution_old',
        'analysis_statistics_old'
      ]

      const deletedTables = []
      const errors = []

      for (const tableName of tablesToDelete) {
        try {
          const dropQuery = `DROP TABLE IF EXISTS \`viewpers.salesguard_alerts.${tableName}\``
          await bigquery.query({ query: dropQuery, useLegacySql: false })
          deletedTables.push(tableName)
          console.log(`✅ テーブル削除完了: ${tableName}`)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          errors.push({ table: tableName, error: errorMsg })
          console.error(`❌ テーブル削除エラー ${tableName}:`, error)
        }
      }

      return NextResponse.json({
        success: true,
        deleted_tables: deletedTables,
        errors: errors,
        timestamp: new Date().toISOString()
      })

    } else if (action === 'cleanup_all') {
      // 全体的なクリーンアップ
      const tablesToDelete = [
        'test_simple_insert',
        'nlp_analysis_results_old',
        'nlp_analysis_results_backup',
        'nlp_analysis_results_v1',
        'nlp_analysis_results_v2',
        'segment_distribution_old',
        'analysis_statistics_old'
      ]

      const deletedTables = []
      const errors = []

      for (const tableName of tablesToDelete) {
        try {
          const dropQuery = `DROP TABLE IF EXISTS \`viewpers.salesguard_alerts.${tableName}\``
          await bigquery.query({ query: dropQuery, useLegacySql: false })
          deletedTables.push(tableName)
          console.log(`✅ テーブル削除完了: ${tableName}`)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          errors.push({ table: tableName, error: errorMsg })
          console.error(`❌ テーブル削除エラー ${tableName}:`, error)
        }
      }

      // 残存テーブルの確認
      const remainingTablesQuery = `
        SELECT table_id, creation_time, row_count, size_bytes 
        FROM \`viewpers.salesguard_alerts.__TABLES__\` 
        ORDER BY table_id
      `
      const [remainingTables] = await bigquery.query({ query: remainingTablesQuery, useLegacySql: false })

      return NextResponse.json({
        success: true,
        deleted_tables: deletedTables,
        remaining_tables: remainingTables || [],
        errors: errors,
        timestamp: new Date().toISOString()
      })

    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use list_tables, delete_test_tables, delete_duplicate_tables, or cleanup_all'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ テーブルクリーンアップエラー:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 