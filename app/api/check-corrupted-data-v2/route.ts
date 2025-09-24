import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET() {
  try {
    // より適切な文字化け判定条件でデータを確認
    const checkQuery = `
      SELECT 
        message_id,
        thread_id,
        subject,
        \`from\`,
        \`to\`,
        date,
        CASE 
          WHEN subject LIKE '%%' THEN 'subject_corrupted'
          WHEN body LIKE '%%' THEN 'body_corrupted'
          WHEN \`from\` LIKE '%%' THEN 'from_corrupted'
          WHEN \`to\` LIKE '%%' THEN 'to_corrupted'
          ELSE 'clean'
        END as corruption_type
      FROM \`viewpers.salesguard_alerts.email_messages\`
      LIMIT 20
    `

    const results = await bigquery.query({
      query: checkQuery,
      useLegacySql: false
    })

    // 文字化けの種類別件数を確認
    const countQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN subject LIKE '%%' THEN 1 END) as subject_corrupted,
        COUNT(CASE WHEN body LIKE '%%' THEN 1 END) as body_corrupted,
        COUNT(CASE WHEN \`from\` LIKE '%%' THEN 1 END) as from_corrupted,
        COUNT(CASE WHEN \`to\` LIKE '%%' THEN 1 END) as to_corrupted,
        COUNT(CASE WHEN 
          subject NOT LIKE '%%' AND 
          body NOT LIKE '%%' AND 
          \`from\` NOT LIKE '%%' AND 
          \`to\` NOT LIKE '%%' 
        THEN 1 END) as clean_records
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
        summary: countResults[0]?.[0] || {},
        message: '文字化けデータの詳細確認が完了しました'
      }
    })

  } catch (error) {
    console.error('Check corrupted data v2 API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check corrupted data v2',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 