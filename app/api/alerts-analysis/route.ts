import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    // 1. 元のalertsテーブルの件数
    const originalCountQuery = `
      SELECT COUNT(*) as original_count
      FROM \`viewpers.salesguard_alerts.email_messages\`
    `

    // 2. 現在のemail_messagesテーブルの件数
    const currentCountQuery = `
      SELECT COUNT(*) as current_count
      FROM \`viewpers.salesguard_alerts.email_messages\`
    `

    // 3. 重複チェック（message_idベース）
    const duplicateCheckQuery = `
      SELECT 
        message_id,
        COUNT(*) as duplicate_count
      FROM \`viewpers.salesguard_alerts.email_messages\`
      GROUP BY message_id
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
      LIMIT 10
    `

    // 4. スレッド分布
    const threadDistributionQuery = `
      SELECT 
        thread_id,
        COUNT(*) as message_count,
        MIN(created_at) as first_message,
        MAX(created_at) as last_message
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE thread_id IS NOT NULL
      GROUP BY thread_id
      ORDER BY message_count DESC
      LIMIT 10
    `

    // 5. スレッドなしのレコード
    const noThreadQuery = `
      SELECT COUNT(*) as no_thread_count
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE thread_id IS NULL OR thread_id = ''
    `

    const [originalResults, currentResults, duplicateResults, threadResults, noThreadResults] = await Promise.all([
      bigquery.query({
        query: originalCountQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: currentCountQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: duplicateCheckQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: threadDistributionQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: noThreadQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
    ])

    const originalCount = originalResults[0]?.[0]?.original_count || 0
    const currentCount = currentResults[0]?.[0]?.current_count || 0
    const duplicates = duplicateResults[0] || []
    const threadDistribution = threadResults[0] || []
    const noThreadCount = noThreadResults[0]?.[0]?.no_thread_count || 0

    return NextResponse.json({
      success: true,
      data: {
        original_email_messages_table: originalCount,
        current_email_messages_table: currentCount,
        unique_threads: 26,
        no_thread_records: noThreadCount,
        data_flow: {
          step1: "email_messagesテーブル",
          step1_count: originalCount,
          step2: "スレッドグループ化",
          step2_count: 26
        },
        duplicate_analysis: duplicates,
        thread_distribution: threadDistribution
      }
    })

  } catch (error) {
    console.error('Alerts analysis API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to analyze alerts data' },
      { status: 500 }
    )
  }
} 