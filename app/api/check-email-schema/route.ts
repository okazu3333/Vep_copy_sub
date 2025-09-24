import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET() {
  try {
    // 全フィールドのサンプルデータを取得
    const sampleQuery = `
      SELECT *
      FROM \`viewpers.salesguard_alerts.email_messages\`
      LIMIT 1
    `

    const results = await bigquery.query({
      query: sampleQuery,
      useLegacySql: false
    })

    // スレッド数とメッセージ数を確認
    const countQuery = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT thread_id) as total_threads,
        COUNT(DISTINCT alert_id) as total_alerts
      FROM \`viewpers.salesguard_alerts.email_messages\`
    `

    const countResults = await bigquery.query({
      query: countQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      data: {
        sampleData: results[0] || [],
        availableFields: results[0] ? Object.keys(results[0]) : [],
        counts: countResults[0]?.[0] || {},
        message: 'email_messagesテーブルの詳細情報を取得しました'
      }
    })

  } catch (error) {
    console.error('Check email schema API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check email schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 