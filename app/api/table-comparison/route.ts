import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    // 1. alertsテーブルの確認
    const alertsQuery = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(DISTINCT thread_id) as unique_threads
      FROM \`viewpers.salesguard_alerts.alerts\`
    `

    // 2. alerts_v2テーブルの確認
    const alertsV2Query = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(DISTINCT thread_id) as unique_threads
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
    `

    // 3. email_messagesテーブルの確認
    const emailMessagesQuery = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(DISTINCT thread_id) as unique_threads
      FROM \`viewpers.salesguard_alerts.email_messages\`
    `

    // 4. 各テーブルのスキーマ確認（最初の数行）
    const alertsSampleQuery = `
      SELECT * FROM \`viewpers.salesguard_alerts.alerts\`
      LIMIT 1
    `

    const alertsV2SampleQuery = `
      SELECT * FROM \`viewpers.salesguard_alerts.alerts_v2\`
      LIMIT 1
    `

    const emailMessagesSampleQuery = `
      SELECT * FROM \`viewpers.salesguard_alerts.email_messages\`
      LIMIT 1
    `

    const [alertsResults, alertsV2Results, emailMessagesResults, 
          alertsSample, alertsV2Sample, emailMessagesSample] = await Promise.all([
      bigquery.query({
        query: alertsQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: alertsV2Query,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: emailMessagesQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: alertsSampleQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: alertsV2SampleQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: emailMessagesSampleQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
    ])

    const alertsCount = alertsResults[0]?.[0] || { total_count: 0, unique_threads: 0 }
    const alertsV2Count = alertsV2Results[0]?.[0] || { total_count: 0, unique_threads: 0 }
    const emailMessagesCount = emailMessagesResults[0]?.[0] || { total_count: 0, unique_threads: 0 }

    return NextResponse.json({
      success: true,
      data: {
        tables: {
          alerts: {
            total_count: alertsCount.total_count,
            unique_threads: alertsCount.unique_threads,
            sample: alertsSample[0]?.[0] || null
          },
          alerts_v2: {
            total_count: alertsV2Count.total_count,
            unique_threads: alertsV2Count.unique_threads,
            sample: alertsV2Sample[0]?.[0] || null
          },
          email_messages: {
            total_count: emailMessagesCount.total_count,
            unique_threads: emailMessagesCount.unique_threads,
            sample: emailMessagesSample[0]?.[0] || null
          }
        },
        summary: {
          total_records: alertsCount.total_count + alertsV2Count.total_count + emailMessagesCount.total_count,
          table_count: 3
        }
      }
    })

  } catch (error) {
    console.error('Table comparison API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to compare tables' },
      { status: 500 }
    )
  }
} 