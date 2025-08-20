import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    // 総件数を取得
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
    `

    // スレッド件数を取得
    const threadQuery = `
      SELECT COUNT(DISTINCT thread_id) as thread_count
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      WHERE thread_id IS NOT NULL
    `

    // サンプルデータを取得
    const sampleQuery = `
      SELECT 
        alert_id,
        thread_id,
        subject,
        sender,
        created_at,
        is_root
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      ORDER BY created_at DESC
      LIMIT 5
    `

    const [totalResults, threadResults, sampleResults] = await Promise.all([
      bigquery.query({
        query: totalQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: threadQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: sampleQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
    ])

    const total = totalResults[0]?.[0]?.total || 0
    const threadCount = threadResults[0]?.[0]?.thread_count || 0
    const samples = sampleResults[0] || []

    return NextResponse.json({
      success: true,
      data: {
        total_records: total,
        unique_threads: threadCount,
        samples
      }
    })

  } catch (error) {
    console.error('Alerts count API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch alerts count' },
      { status: 500 }
    )
  }
} 