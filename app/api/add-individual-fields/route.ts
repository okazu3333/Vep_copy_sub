import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    const { fieldName } = await request.json()
    
    if (!fieldName) {
      return NextResponse.json({
        success: false,
        error: 'fieldName is required'
      }, { status: 400 })
    }

    let addColumnQuery = ''
    let defaultValue = ''

    // フィールドタイプとデフォルト値を設定
    switch (fieldName) {
      case 'detected_keyword':
        addColumnQuery = `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN detected_keyword STRING`
        defaultValue = 'キーワード未設定'
        break
      case 'priority':
        addColumnQuery = `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN priority STRING`
        defaultValue = '中'
        break
      case 'status':
        addColumnQuery = `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN status STRING`
        defaultValue = '新規'
        break
      case 'score':
        addColumnQuery = `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN score FLOAT64`
        defaultValue = '50.0'
        break
      case 'department':
        addColumnQuery = `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN department STRING`
        defaultValue = '営業部'
        break
      case 'customer_email':
        addColumnQuery = `ALTER TABLE \`viewpers.salesguard_alerts.email_messages\` ADD COLUMN customer_email STRING`
        defaultValue = 'customer@example.com'
        break
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid field name'
        }, { status: 400 })
    }

    // フィールドを追加
    await bigquery.query({
      query: addColumnQuery,
      useLegacySql: false
    })

    // デフォルト値を設定
    const updateQuery = `
      UPDATE \`viewpers.salesguard_alerts.email_messages\`
      SET ${fieldName} = '${defaultValue}'
      WHERE ${fieldName} IS NULL
    `

    await bigquery.query({
      query: updateQuery,
      useLegacySql: false
    })

    return NextResponse.json({
      success: true,
      message: `${fieldName}フィールドを追加し、デフォルト値を設定しました`
    })

  } catch (error) {
    console.error('Add individual field API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add field',
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
        message_id,
        thread_id,
        alert_id,
        subject,
        \`from\`,
        \`to\`,
        date,
        detected_keyword,
        priority,
        status,
        score,
        department,
        customer_email
      FROM \`viewpers.salesguard_alerts.email_messages\`
      LIMIT 1
    `

    const results = await bigquery.query({
      query: checkQuery,
      useLegacySql: false
    })

    // 存在するフィールドと不足フィールドを分析
    const sampleData = results[0]?.[0] || {}
    const existingFields = Object.keys(sampleData).filter(key => sampleData[key] !== undefined)
    const missingFields = []

    const requiredFields = [
      'detected_keyword', 'priority', 'status', 'score', 'department', 'customer_email'
    ]

    for (const field of requiredFields) {
      if (!existingFields.includes(field)) {
        missingFields.push(field)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        existingFields,
        missingFields,
        sampleData,
        message: 'テーブル構造の分析が完了しました'
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