import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET() {
  try {
    // 1. テーブルの基本情報を取得
    const basicQuery = `
      SELECT COUNT(*) as total_records
      FROM \`viewpers.salesguard_alerts.alerts_clean\`
    `

    // 2. 最初の1件を取得してスキーマを確認
    const sampleQuery = `
      SELECT *
      FROM \`viewpers.salesguard_alerts.alerts_clean\`
      LIMIT 1
    `

    // 3. スレッド数を確認
    const threadQuery = `
      SELECT COUNT(DISTINCT thread_id) as thread_count
      FROM \`viewpers.salesguard_alerts.alerts_clean\`
      WHERE thread_id IS NOT NULL
    `

    const [basicResult, sampleResult, threadResult] = await Promise.all([
      bigquery.query({
        query: basicQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: sampleQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: threadQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
    ])

    const totalRecords = basicResult[0]?.[0]?.total_records || 0
    const sampleData = sampleResult[0]?.[0] || {}
    const availableFields = Object.keys(sampleData)
    const threadCount = threadResult[0]?.[0]?.thread_count || 0

    return NextResponse.json({
      success: true,
      data: {
        total_records: totalRecords,
        unique_threads: threadCount,
        available_fields: availableFields,
        sample_data: sampleData,
        analysis: {
          table_exists: totalRecords > 0,
          field_count: availableFields.length,
          has_data: Object.keys(sampleData).length > 0
        }
      }
    })

  } catch (error) {
    console.error('Check alerts clean API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check alerts clean table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 