import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    // 文字化けしているデータを確認
    const checkQuery = `
      SELECT 
        message_id,
        thread_id,
        alert_id,
        subject,
        \`from\`,
        \`to\`,
        date,
        body
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE 
        subject LIKE '%%' OR 
        body LIKE '%%' OR
        \`from\` LIKE '%%' OR
        \`to\` LIKE '%%'
      LIMIT 10
    `

    const results = await bigquery.query({
      query: checkQuery,
      useLegacySql: false
    })

    // 文字化けデータの総数を確認
    const countQuery = `
      SELECT COUNT(*) as corrupted_count
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE 
        subject LIKE '%%' OR 
        body LIKE '%%' OR
        \`from\` LIKE '%%' OR
        \`to\` LIKE '%%'
    `

    const countResults = await bigquery.query({
      query: countQuery,
      useLegacySql: false
    })

    // 全データ数も確認
    const totalQuery = `
      SELECT COUNT(*) as total_count
      FROM \`viewpers.salesguard_alerts.email_messages\`
    `

    const totalResults = await bigquery.query({
      query: totalQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      data: {
        corruptedData: results[0] || [],
        corruptedCount: countResults[0]?.[0]?.corrupted_count || 0,
        totalCount: totalResults[0]?.[0]?.total_count || 0,
        message: '文字化けデータの確認が完了しました'
      }
    })

  } catch (error) {
    console.error('Check corrupted data API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check corrupted data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 