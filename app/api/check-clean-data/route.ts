import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET() {
  try {
    // 文字化けしていないクリーンなデータの件数を確認
    const cleanDataQuery = `
      SELECT 
        COUNT(*) as clean_records,
        COUNT(DISTINCT thread_id) as clean_threads
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE 
        subject NOT LIKE '%%' AND 
        body NOT LIKE '%%' AND 
        \`from\` NOT LIKE '%%' AND 
        \`to\` NOT LIKE '%%'
    `

    const results = await bigquery.query({
      query: cleanDataQuery,
      useLegacySql: false
    })

    // サンプルデータも確認
    const sampleQuery = `
      SELECT 
        message_id,
        thread_id,
        subject,
        \`from\`,
        \`to\`,
        date
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE 
        subject NOT LIKE '%%' AND 
        body NOT LIKE '%%' AND 
        \`from\` NOT LIKE '%%' AND 
        \`to\` NOT LIKE '%%'
      ORDER BY date DESC
      LIMIT 5
    `

    const sampleResults = await bigquery.query({
      query: sampleQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      data: {
        cleanRecords: results[0]?.[0]?.clean_records || 0,
        cleanThreads: results[0]?.[0]?.clean_threads || 0,
        sampleData: sampleResults[0] || [],
        message: 'クリーンデータの確認が完了しました'
      }
    })

  } catch (error) {
    console.error('Check clean data API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check clean data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 