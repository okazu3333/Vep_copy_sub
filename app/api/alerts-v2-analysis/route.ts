import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    // 1. 総件数とユニーク件数
    const totalQuery = `
      SELECT COUNT(*) as total_count
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
    `

    // 2. message_idベースの重複分析
    const duplicateQuery = `
      SELECT 
        message_id,
        COUNT(*) as duplicate_count,
        COUNT(DISTINCT thread_id) as unique_threads,
        COUNT(DISTINCT alert_id) as unique_alerts
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      GROUP BY message_id
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
    `

    // 3. thread_idベースのスレッド分析
    const threadQuery = `
      SELECT 
        thread_id,
        COUNT(*) as message_count,
        COUNT(DISTINCT message_id) as unique_messages,
        COUNT(DISTINCT alert_id) as unique_alerts,
        MIN(created_at) as first_message,
        MAX(created_at) as last_message
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      WHERE thread_id IS NOT NULL
      GROUP BY thread_id
      ORDER BY message_count DESC
    `

    // 4. 重複なしのレコード数
    const noDuplicateQuery = `
      SELECT COUNT(*) as no_duplicate_count
      FROM (
        SELECT message_id
        FROM \`viewpers.salesguard_alerts.alerts_v2\`
        GROUP BY message_id
        HAVING COUNT(*) = 1
      )
    `

    // 5. 重複ありのレコード数
    const withDuplicateQuery = `
      SELECT COUNT(*) as with_duplicate_count
      FROM (
        SELECT message_id
        FROM \`viewpers.salesguard_alerts.alerts_v2\`
        GROUP BY message_id
        HAVING COUNT(*) > 1
      )
    `

    const [totalResults, duplicateResults, threadResults, noDuplicateResults, withDuplicateResults] = await Promise.all([
      bigquery.query({
        query: totalQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: duplicateQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: threadQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: noDuplicateQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: withDuplicateQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
    ])

    const total = totalResults[0]?.[0]?.total_count || 0
    const duplicates = duplicateResults[0] || []
    const threads = threadResults[0] || []
    const noDuplicateCount = noDuplicateResults[0]?.[0]?.no_duplicate_count || 0
    const withDuplicateCount = withDuplicateResults[0]?.[0]?.with_duplicate_count || 0

    // 重複の詳細分析
    const duplicateSummary = {
      total_duplicate_records: duplicates.reduce((sum: number, item: any) => sum + item.duplicate_count, 0),
      unique_duplicate_messages: duplicates.length,
      duplicate_breakdown: duplicates.map((item: any) => ({
        message_id: item.message_id,
        duplicate_count: item.duplicate_count,
        unique_threads: item.unique_threads,
        unique_alerts: item.unique_alerts
      }))
    }

    // スレッドの詳細分析
    const threadSummary = {
      total_threads: threads.length,
      total_messages_in_threads: threads.reduce((sum: number, item: any) => sum + item.message_count, 0),
      thread_distribution: threads.map((item: any) => ({
        thread_id: item.thread_id,
        message_count: item.message_count,
        unique_messages: item.unique_messages,
        unique_alerts: item.unique_alerts,
        first_message: item.first_message,
        last_message: item.last_message
      }))
    }

    return NextResponse.json({
      success: true,
      data: {
        total_records: total,
        duplicate_analysis: duplicateSummary,
        thread_analysis: threadSummary,
        summary: {
          no_duplicate_records: noDuplicateCount,
          with_duplicate_records: withDuplicateCount,
          total_unique_messages: noDuplicateCount + withDuplicateCount
        }
      }
    })

  } catch (error) {
    console.error('Alerts v2 analysis API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to analyze alerts v2' },
      { status: 500 }
    )
  }
} 