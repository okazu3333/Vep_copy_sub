import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET() {
  try {
    console.log('🔍 文字化けデータ分析開始')

    const results: any = {}

    // 文字化けパターンの分析
    const encodingQueries = [
      {
        name: 'base64_encoded',
        query: `
          SELECT 
            COUNT(*) as count,
            'Base64エンコード' as pattern_type
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body LIKE '%$B%' AND body LIKE '%(B%'
        `,
        description: 'Base64エンコードされたデータの件数'
      },
      {
        name: 'mime_encoded',
        query: `
          SELECT 
            COUNT(*) as count,
            'MIMEエンコード' as pattern_type
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body LIKE '%=?%' AND body LIKE '%?=%'
        `,
        description: 'MIMEエンコードされたデータの件数'
      },
      {
        name: 'hex_encoded',
        query: `
          SELECT 
            COUNT(*) as count,
            '16進数エンコード' as pattern_type
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body LIKE '%\\x%' OR body LIKE '%\\u%'
        `,
        description: '16進数エンコードされたデータの件数'
      },
      {
        name: 'url_encoded',
        query: `
          SELECT 
            COUNT(*) as count,
            'URLエンコード' as pattern_type
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body LIKE '%%%' AND body NOT LIKE '%$B%'
        `,
        description: 'URLエンコードされたデータの件数'
      },
      {
        name: 'clean_text',
        query: `
          SELECT 
            COUNT(*) as count,
            'クリーンテキスト' as pattern_type
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body NOT LIKE '%$B%' 
            AND body NOT LIKE '%=?%' 
            AND body NOT LIKE '%\\x%'
            AND body NOT LIKE '%\\u%'
            AND body NOT LIKE '%%%'
        `,
        description: 'エンコードされていないクリーンテキストの件数'
      }
    ]

    for (const queryInfo of encodingQueries) {
      try {
        const [rows] = await bigquery.query({ query: queryInfo.query })
        results[queryInfo.name] = {
          success: true,
          data: rows[0],
          description: queryInfo.description
        }
      } catch (error) {
        results[queryInfo.name] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          description: queryInfo.description
        }
      }
    }

    // 文字化けデータのサンプル取得
    const sampleQueries = [
      {
        name: 'base64_samples',
        query: `
          SELECT 
            message_id,
            subject,
            SUBSTR(body, 1, 200) as body_preview,
            LENGTH(body) as body_length
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body LIKE '%$B%' AND body LIKE '%(B%'
          LIMIT 5
        `,
        description: 'Base64エンコードされたデータのサンプル'
      },
      {
        name: 'mime_samples',
        query: `
          SELECT 
            message_id,
            subject,
            SUBSTR(body, 1, 200) as body_preview,
            LENGTH(body) as body_length
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body LIKE '%=?%' AND body LIKE '%?=%'
          LIMIT 5
        `,
        description: 'MIMEエンコードされたデータのサンプル'
      },
      {
        name: 'clean_samples',
        query: `
          SELECT 
            message_id,
            subject,
            SUBSTR(body, 1, 200) as body_preview,
            LENGTH(body) as body_length
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body NOT LIKE '%$B%' 
            AND body NOT LIKE '%=?%' 
            AND body NOT LIKE '%\\x%'
            AND body NOT LIKE '%\\u%'
            AND body NOT LIKE '%%%'
          LIMIT 5
        `,
        description: 'クリーンテキストのサンプル'
      }
    ]

    for (const queryInfo of sampleQueries) {
      try {
        const [rows] = await bigquery.query({ query: queryInfo.query })
        results[queryInfo.name] = {
          success: true,
          data: rows,
          description: queryInfo.description
        }
      } catch (error) {
        results[queryInfo.name] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          description: queryInfo.description
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '文字化けデータ分析が完了しました',
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('文字化けデータ分析エラー:', error)
    return NextResponse.json({
      success: false,
      error: '文字化けデータ分析中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 