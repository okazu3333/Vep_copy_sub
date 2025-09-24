import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST() {
  try {
    // email_messagesテーブルにalert_idフィールドを追加
    const addColumnQuery = `
      ALTER TABLE \`viewpers.salesguard_alerts.email_messages\`
      ADD COLUMN alert_id INT64
    `

    await bigquery.query({
      query: addColumnQuery,
      useLegacySql: false
    })

    // スレッドごとに連番のアラートIDを設定
    const updateAlertIdQuery = `
      UPDATE \`viewpers.salesguard_alerts.email_messages\` em
      SET alert_id = ta.alert_id
      FROM (
        SELECT 
          thread_id,
          ROW_NUMBER() OVER (ORDER BY MIN(date)) as alert_id
        FROM \`viewpers.salesguard_alerts.email_messages\`
        GROUP BY thread_id
      ) ta
      WHERE em.thread_id = ta.thread_id
    `

    await bigquery.query({
      query: updateAlertIdQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      message: 'alert_idフィールドを追加し、スレッドごとに連番を設定しました'
    })

  } catch (error) {
    console.error('Add alert_id API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add alert_id field',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // 簡単なクエリでテーブル構造を確認
    const simpleQuery = `
      SELECT 
        thread_id,
        alert_id,
        subject,
        \`from\`,
        date
      FROM \`viewpers.salesguard_alerts.email_messages\`
      LIMIT 3
    `

    const results = await bigquery.query({
      query: simpleQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      data: {
        sampleData: results[0] || [],
        message: 'email_messagesテーブルのサンプルデータを取得しました'
      }
    })

  } catch (error) {
    console.error('Check table structure API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check table structure',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 