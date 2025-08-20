import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    // 1. 現在のテーブル構造を確認
    const structureQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM \`viewpers.salesguard_alerts.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'email_messages'
      ORDER BY ordinal_position
    `

    const structureResults = await bigquery.query({
      query: structureQuery,
      useLegacySql: false
    })

    // 2. 文字化け判定のテスト
    const testQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN body NOT LIKE '%%' AND body NOT LIKE '$B%' AND body NOT LIKE '%$B%' THEN 1 END) as clean_body_records,
        COUNT(CASE WHEN body LIKE '%%' OR body LIKE '$B%' OR body LIKE '%$B%' THEN 1 END) as corrupted_body_records
      FROM \`viewpers.salesguard_alerts.email_messages\`
    `

    const testResults = await bigquery.query({
      query: testQuery,
      useLegacySql: false
    })

    // 3. サンプルデータで文字化け状況を確認
    const sampleQuery = `
      SELECT 
        message_id,
        thread_id,
        alert_id,
        subject,
        \`from\`,
        \`to\`,
        LEFT(body, 100) as body_preview,
        CASE 
          WHEN body LIKE '%%' THEN 'tab_corrupted'
          WHEN body LIKE '$B%' THEN 'shift_jis_corrupted'
          WHEN body LIKE '%$B%' THEN 'shift_jis_corrupted'
          ELSE 'clean'
        END as corruption_type
      FROM \`viewpers.salesguard_alerts.email_messages\`
      ORDER BY alert_id ASC
      LIMIT 10
    `

    const sampleResults = await bigquery.query({
      query: sampleQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      data: {
        tableStructure: structureResults[0] || [],
        corruptionTest: testResults[0]?.[0] || {},
        sampleData: sampleResults[0] || [],
        message: 'テーブルの詳細確認が完了しました'
      }
    })

  } catch (error) {
    console.error('Debug table API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to debug table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 