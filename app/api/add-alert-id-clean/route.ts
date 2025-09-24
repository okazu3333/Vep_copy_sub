import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST() {
  try {
    // クリーンテーブルにALT-xxx形式のアラートIDを追加
    const addAlertIdQuery = `
      ALTER TABLE \`viewpers.salesguard_alerts.alerts_clean_filtered\` 
      ADD COLUMN alert_id_formatted STRING
    `

    await bigquery.query({
      query: addAlertIdQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    // ALT-xxx形式のアラートIDを更新
    const updateAlertIdQuery = `
      UPDATE \`viewpers.salesguard_alerts.alerts_clean_filtered\` 
      SET alert_id_formatted = CONCAT('ALT-', CAST(alert_id AS STRING))
      WHERE alert_id_formatted IS NULL
    `

    await bigquery.query({
      query: updateAlertIdQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    // 更新後の件数を確認
    const countQuery = `
      SELECT COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.alerts_clean_filtered\`
      WHERE alert_id_formatted IS NOT NULL
    `

    const countResult = await bigquery.query({
      query: countQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const updatedCount = countResult[0]?.[0]?.count || 0

    return NextResponse.json({
      success: true,
      message: 'ALT-xxx形式のアラートIDが正常に追加されました',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_filtered',
      updatedRecords: updatedCount,
      alertIdFormat: 'ALT-xxx'
    })

  } catch (error) {
    console.error('Add alert ID error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add alert ID',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5')
    
    // アラートIDが追加されたクリーンテーブルの内容を確認
    const checkQuery = `
      SELECT 
        thread_id,
        alert_id,
        alert_id_formatted,
        subject,
        \`from\`,
        \`to\`,
        date,
        reply_level,
        is_root
      FROM \`viewpers.salesguard_alerts.alerts_clean_filtered\`
      ORDER BY alert_id DESC
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
      message: 'アラートID追加後のクリーンテーブル確認',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_filtered',
      recordCount: records.length,
      records: records
    })

  } catch (error) {
    console.error('Check alert ID error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check alert ID',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 