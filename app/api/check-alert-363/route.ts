import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 ALT-363のメッセージ内容とFrom/To表示問題確認開始')

    // ALT-363の詳細情報を確認するクエリ
    const queries = [
      {
        name: 'alert_363_details',
        query: `
          SELECT 
            thread_id,
            message_id,
            subject,
            \`from\`,
            \`to\`,
            customer_email,
            body,
            date,
            reply_level,
            is_root,
            source_file,
            alert_id,
            is_forwarding_service,
            original_recipient
          FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
          WHERE alert_id = 363
          ORDER BY reply_level, date
        `,
        description: 'ALT-363の詳細情報'
      },
      {
        name: 'alert_363_thread_messages',
        query: `
          SELECT 
            thread_id,
            message_id,
            subject,
            \`from\`,
            \`to\`,
            customer_email,
            SUBSTRING(body, 1, 200) as body_preview,
            date,
            reply_level,
            is_root,
            -- From/To表示用の分類
            CASE 
              WHEN \`from\` LIKE '%@cross-m.co.jp%' THEN 'company'
              ELSE 'client'
            END as sender_type,
            CASE 
              WHEN \`to\` LIKE '%@cross-m.co.jp%' THEN 'company'
              ELSE 'client'
            END as recipient_type
          FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
          WHERE alert_id = 363
          ORDER BY reply_level, date
        `,
        description: 'ALT-363のスレッドメッセージとFrom/To分類'
      },
      {
        name: 'similar_from_to_issues',
        query: `
          SELECT 
            alert_id,
            thread_id,
            subject,
            \`from\`,
            \`to\`,
            customer_email,
            reply_level,
            is_root,
            -- From/To表示の問題パターンを特定
            CASE 
              WHEN \`from\` LIKE '%@cross-m.co.jp%' AND \`to\` LIKE '%@cross-m.co.jp%' THEN 'company_to_company'
              WHEN \`from\` NOT LIKE '%@cross-m.co.jp%' AND \`to\` NOT LIKE '%@cross-m.co.jp%' THEN 'client_to_client'
              WHEN \`from\` LIKE '%@cross-m.co.jp%' AND \`to\` NOT LIKE '%@cross-m.co.jp%' THEN 'company_to_client'
              WHEN \`from\` NOT LIKE '%@cross-m.co.jp%' AND \`to\` LIKE '%@cross-m.co.jp%' THEN 'client_to_company'
              ELSE 'other'
            END as communication_pattern
          FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
          WHERE (
            -- From/To表示に問題がある可能性のあるパターン
            (\`from\` LIKE '%@cross-m.co.jp%' AND \`to\` LIKE '%@cross-m.co.jp%') OR
            (\`from\` NOT LIKE '%@cross-m.co.jp%' AND \`to\` NOT LIKE '%@cross-m.co.jp%') OR
            customer_email = 'customer@example.com'
          )
          ORDER BY alert_id, reply_level
          LIMIT 50
        `,
        description: 'From/To表示に問題がある可能性のある類似ケース'
      },
      {
        name: 'forwarding_service_from_to_analysis',
        query: `
          SELECT 
            alert_id,
            thread_id,
            subject,
            \`from\`,
            \`to\`,
            customer_email,
            original_recipient,
            is_forwarding_service,
            reply_level,
            is_root,
            -- 転送サービス経由のFrom/To表示の問題を特定
            CASE 
              WHEN is_forwarding_service = true AND customer_email != 'customer@example.com' THEN 'improved'
              WHEN is_forwarding_service = true AND customer_email = 'customer@example.com' THEN 'needs_improvement'
              ELSE 'normal'
            END as forwarding_status
          FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
          WHERE is_forwarding_service = true
          ORDER BY alert_id, reply_level
          LIMIT 30
        `,
        description: '転送サービス経由のFrom/To表示分析'
      }
    ]

    const results = []
    
    for (const queryInfo of queries) {
      try {
        const result = await bigquery.query({
          query: queryInfo.query,
          useLegacySql: false,
          maximumBytesBilled: '1000000000'
        })
        
        results.push({
          query_name: queryInfo.name,
          description: queryInfo.description,
          data: result[0],
          rowCount: result.length
        })
      } catch (error) {
        console.error(`Error executing query for ${queryInfo.name}:`, error)
        results.push({
          query_name: queryInfo.name,
          description: queryInfo.description,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'ALT-363のメッセージ内容とFrom/To表示問題確認完了',
      results: results
    })

  } catch (error) {
    console.error('❌ ALT-363確認エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'ALT-363確認に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 