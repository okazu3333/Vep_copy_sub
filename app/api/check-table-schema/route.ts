import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 NLP分析結果テーブルのスキーマ確認開始...')

    // テーブルの存在確認
    const tableExistsQuery = `
      SELECT 
        table_id,
        creation_time,
        row_count,
        size_bytes
      FROM \`viewpers.salesguard_alerts.__TABLES__\`
      WHERE table_id = 'nlp_analysis_results'
    `

    const [tableInfo] = await bigquery.query({
      query: tableExistsQuery,
      useLegacySql: false
    })

    if (!tableInfo || tableInfo.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'nlp_analysis_resultsテーブルが見つかりません'
      }, { status: 404 })
    }

    // テーブルのスキーマ確認
    const schemaQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
is_generated
      FROM \`viewpers.salesguard_alerts.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'nlp_analysis_results'
      ORDER BY ordinal_position
    `

    const [schemaInfo] = await bigquery.query({
      query: schemaQuery,
      useLegacySql: false
    })

    // サンプルデータの確認
    const sampleDataQuery = `
      SELECT *
      FROM \`viewpers.salesguard_alerts.nlp_analysis_results\`
      LIMIT 1
    `

    let sampleData = null
    try {
      const [sampleResult] = await bigquery.query({
        query: sampleDataQuery,
        useLegacySql: false
      })
      sampleData = sampleResult[0] || null
    } catch (error) {
      console.log('サンプルデータ取得エラー（テーブルが空の可能性）:', error)
    }

    return NextResponse.json({
      success: true,
      table_info: tableInfo[0],
      schema: schemaInfo || [],
      sample_data: sampleData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ テーブルスキーマ確認エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check table schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 