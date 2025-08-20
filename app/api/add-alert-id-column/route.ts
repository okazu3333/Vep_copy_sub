import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    // 1. alert_idカラムを追加
    const addColumnQuery = `
      ALTER TABLE \`viewpers.salesguard_alerts.email_messages\`
      ADD COLUMN alert_id INT64
    `

    await bigquery.query({
      query: addColumnQuery,
      useLegacySql: false
    })

    // 2. 文字化けしていないデータのみを対象に、thread_idごとに連番を設定
    const updateQuery = `
      UPDATE \`viewpers.salesguard_alerts.email_messages\`
      SET alert_id = (
        SELECT alert_id
        FROM (
          SELECT 
            message_id,
            thread_id,
            ROW_NUMBER() OVER (ORDER BY MIN(date)) as alert_id
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE 
            subject NOT LIKE '%%' AND 
            body NOT LIKE '%%' AND 
            \`from\` NOT LIKE '%%' AND 
            \`to\` NOT LIKE '%%'
          GROUP BY message_id, thread_id
        ) ranked
        WHERE ranked.message_id = \`viewpers.salesguard_alerts.email_messages\`.message_id
      )
      WHERE 
        subject NOT LIKE '%%' AND 
        body NOT LIKE '%%' AND 
        \`from\` NOT LIKE '%%' AND 
        \`to\` NOT LIKE '%%'
    `

    await bigquery.query({
      query: updateQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      message: 'alert_idカラムの追加と連番設定が完了しました'
    })

  } catch (error) {
    console.error('Add alert_id column API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add alert_id column',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // 現在のテーブル構造とalert_idの設定状況を確認
    const checkQuery = `
      SELECT 
        message_id,
        thread_id,
        alert_id,
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
      ORDER BY alert_id ASC
      LIMIT 10
    `

    const results = await bigquery.query({
      query: checkQuery,
      useLegacySql: false
    })

    // alert_idが設定されている件数を確認
    const countQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(alert_id) as alert_id_set_count,
        MIN(alert_id) as min_alert_id,
        MAX(alert_id) as max_alert_id
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE 
        subject NOT LIKE '%%' AND 
        body NOT LIKE '%%' AND 
        \`from\` NOT LIKE '%%' AND 
        \`to\` NOT LIKE '%%'
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
        message: 'alert_idカラムの確認が完了しました'
      }
    })

  } catch (error) {
    console.error('Check alert_id column API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check alert_id column',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 