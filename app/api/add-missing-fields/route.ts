import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST() {
  try {
    // 不足しているフィールドを追加
    const addFieldsQueries = [
      `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN detected_keyword STRING`,
      `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN priority STRING`,
      `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN status STRING`,
      `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN score FLOAT64`,
      `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN department STRING`,
      `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN customer_email STRING`
    ]

    // 各フィールドを順次追加
    for (const query of addFieldsQueries) {
      await bigquery.query({
        query,
        useLegacySql: false
      })
    }

    // デフォルト値を設定
    const updateDefaultsQuery = `
      UPDATE \`viewpers.salesguard_alerts.email_messages\`
      SET 
        detected_keyword = 'キーワード未設定',
        priority = '中',
        status = '新規',
        score = 50.0,
        department = '営業部',
        customer_email = COALESCE(to, 'customer@example.com')
      WHERE detected_keyword IS NULL
    `

    await bigquery.query({
      query: updateDefaultsQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      message: '不足しているフィールドを追加し、デフォルト値を設定しました'
    })

  } catch (error) {
    console.error('Add missing fields API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add missing fields',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // 現在のテーブル構造を確認
    const checkQuery = `
      SELECT 
        detected_keyword,
        priority,
        status,
        score,
        department,
        customer_email
      FROM \`viewpers.salesguard_alerts.email_messages\`
      LIMIT 3
    `

    const results = await bigquery.query({
      query: checkQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      data: {
        sampleData: results[0] || [],
        message: '追加されたフィールドのサンプルデータを取得しました'
      }
    })

  } catch (error) {
    console.error('Check missing fields API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check missing fields',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 