import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 転送サービス使用状況確認開始')

    // 転送サービス関連のデータを検索
    const queries = [
      {
        name: 'forwarding_service_usage',
        query: `
          SELECT 
            COUNT(*) as count,
            '転送サービス使用メール' as description
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE (
            \`to\` LIKE '%mr2@cross-m.co.jp%' OR
            \`to\` LIKE '%ml.cross-m.co.jp%' OR
            \`to\` LIKE '%via%' OR
            \`to\` LIKE '%forward%' OR
            \`to\` LIKE '%relay%'
          )
        `,
        description: '転送サービス使用メール総数'
      },
      {
        name: 'forwarding_service_details',
        query: `
          SELECT 
            \`to\`,
            \`from\`,
            subject,
            date,
            COUNT(*) as count
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE (
            \`to\` LIKE '%mr2@cross-m.co.jp%' OR
            \`to\` LIKE '%ml.cross-m.co.jp%' OR
            \`to\` LIKE '%via%' OR
            \`to\` LIKE '%forward%' OR
            \`to\` LIKE '%relay%'
          )
          GROUP BY \`to\`, \`from\`, subject, date
          ORDER BY count DESC
          LIMIT 20
        `,
        description: '転送サービス使用メールの詳細'
      },
      {
        name: 'original_recipient_patterns',
        query: `
          SELECT 
            \`to\`,
            \`from\`,
            subject,
            SUBSTRING(body, 1, 300) as body_preview,
            COUNT(*) as count
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE (
            \`to\` LIKE '%mr2@cross-m.co.jp%' OR
            \`to\` LIKE '%ml.cross-m.co.jp%'
          )
          AND body LIKE '%To:%'
          GROUP BY \`to\`, \`from\`, subject, body
          ORDER BY count DESC
          LIMIT 10
        `,
        description: '本文にTo情報がある転送メール'
      },
      {
        name: 'cross_m_domain_analysis',
        query: `
          SELECT 
            \`to\`,
            COUNT(*) as count
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE \`to\` LIKE '%@cross-m.co.jp%'
          GROUP BY \`to\`
          ORDER BY count DESC
          LIMIT 15
        `,
        description: 'cross-m.co.jpドメインの宛先分析'
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
      message: '転送サービス使用状況確認完了',
      results: results
    })

  } catch (error) {
    console.error('❌ 転送サービス確認エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '転送サービス確認に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 