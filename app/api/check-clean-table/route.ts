import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5')
    
    // クリーンテーブルの内容を確認
    const checkQuery = `
      SELECT 
        thread_id,
        alert_id,
        subject,
        \`from\`,
        \`to\`,
        date,
        reply_level,
        is_root
      FROM \`viewpers.salesguard_alerts.alerts_clean_filtered\`
      ORDER BY date DESC
      LIMIT ${limit}
    `

    const result = await bigquery.query({
      query: checkQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const records = result[0] || []

    return NextResponse.json({
      success: true,
      message: 'クリーンテーブルの内容確認',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_filtered',
      recordCount: records.length,
      records: records
    })

  } catch (error) {
    console.error('Clean table check error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check clean table content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 