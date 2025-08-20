import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    // 1. 重複を削除したクリーンなテーブルを作成
    const createCleanTableQuery = `
      CREATE OR REPLACE TABLE \`viewpers.salesguard_alerts.alerts_clean\` AS
      SELECT 
        ROW_NUMBER() OVER (ORDER BY MIN(created_at)) as alert_id,
        message_id,
        thread_id,
        subject,
        sender,
        body,
        created_at,
        updated_at,
        is_root,
        reply_level,
        source_file,
        detected_keyword,
        priority,
        status,
        score,
        department,
        customer_email
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      GROUP BY 
        message_id, thread_id, subject, sender, body, created_at, updated_at,
        is_root, reply_level, source_file, detected_keyword, priority, status,
        score, department, customer_email
      ORDER BY MIN(created_at)
    `

    // 2. 新しいテーブルの件数を確認
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM \`viewpers.salesguard_alerts.alerts_clean\`
    `

    // 3. スレッド数を確認
    const threadCountQuery = `
      SELECT COUNT(DISTINCT thread_id) as thread_count
      FROM \`viewpers.salesguard_alerts.alerts_clean\`
      WHERE thread_id IS NOT NULL
    `

    const [createResult, countResult, threadResult] = await Promise.all([
      bigquery.query({
        query: createCleanTableQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: countQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: threadCountQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
    ])

    const totalCount = countResult[0]?.[0]?.total_count || 0
    const threadCount = threadResult[0]?.[0]?.thread_count || 0

    return NextResponse.json({
      success: true,
      message: 'クリーンなアラートテーブルを作成しました',
      data: {
        new_table: 'viewpers.salesguard_alerts.alerts_clean',
        total_records: totalCount,
        unique_threads: threadCount,
        improvement: {
          before: {
            total_records: 917,
            unique_threads: 26
          },
          after: {
            total_records: totalCount,
            unique_threads: threadCount
          }
        }
      }
    })

  } catch (error) {
    console.error('Create clean alerts API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create clean alerts table' },
      { status: 500 }
    )
  }
}

// GETメソッドで現在の状況を確認
export async function GET(request: NextRequest) {
  try {
    const countQuery = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(DISTINCT thread_id) as unique_threads,
        COUNT(DISTINCT message_id) as unique_messages
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
    `

    const result = await bigquery.query({
      query: countQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const data = result[0]?.[0] || {}

    return NextResponse.json({
      success: true,
      message: '現在のアラートデータの状況',
      data: {
        current_table: 'viewpers.salesguard_alerts.alerts_v2',
        total_records: data.total_count || 0,
        unique_threads: data.unique_threads || 0,
        unique_messages: data.unique_messages || 0,
        duplicate_rate: data.total_count > 0 ? 
          ((data.total_count - data.unique_messages) / data.total_count * 100).toFixed(1) + '%' : '0%'
      }
    })

  } catch (error) {
    console.error('Check alerts status API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check alerts status' },
      { status: 500 }
    )
  }
} 