import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET() {
  try {
    console.log('🔍 広告・プロモーション系メール確認開始')

    // 広告・プロモーション関連のデータを検索
    const queries = [
      {
        name: 'promotion_emails',
        query: `
          SELECT 
            COUNT(*) as count,
            '広告・プロモーション系メール' as description
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE (
            subject LIKE '%注目%' OR
            subject LIKE '%ゲーム%' OR
            subject LIKE '%メダル%' OR
            subject LIKE '%ポイント%' OR
            subject LIKE '%dジョブ%' OR
            subject LIKE '%スマホワーク%' OR
            subject LIKE '%広告%' OR
            subject LIKE '%プロモーション%' OR
            subject LIKE '%キャンペーン%' OR
            subject LIKE '%セール%' OR
            subject LIKE '%割引%' OR
            subject LIKE '%無料%' OR
            subject LIKE '%限定%' OR
            subject LIKE '%お得%' OR
            subject LIKE '%特典%'
          )
        `,
        description: '広告・プロモーション系メール総数'
      },
      {
        name: 'promotion_specific_subjects',
        query: `
          SELECT 
            subject,
            \`from\`,
            \`to\`,
            date,
            COUNT(*) as count
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE (
            subject LIKE '%注目%' OR
            subject LIKE '%ゲーム%' OR
            subject LIKE '%メダル%' OR
            subject LIKE '%ポイント%' OR
            subject LIKE '%dジョブ%' OR
            subject LIKE '%スマホワーク%' OR
            subject LIKE '%広告%' OR
            subject LIKE '%プロモーション%' OR
            subject LIKE '%キャンペーン%' OR
            subject LIKE '%セール%' OR
            subject LIKE '%割引%' OR
            subject LIKE '%無料%' OR
            subject LIKE '%限定%' OR
            subject LIKE '%お得%' OR
            subject LIKE '%特典%'
          )
          GROUP BY subject, \`from\`, \`to\`, date
          ORDER BY count DESC
          LIMIT 20
        `,
        description: '広告・プロモーション系メールの件名詳細'
      },
      {
        name: 'promotion_senders',
        query: `
          SELECT 
            \`from\`,
            COUNT(*) as count
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE (
            subject LIKE '%注目%' OR
            subject LIKE '%ゲーム%' OR
            subject LIKE '%メダル%' OR
            subject LIKE '%ポイント%' OR
            subject LIKE '%dジョブ%' OR
            subject LIKE '%スマホワーク%' OR
            subject LIKE '%広告%' OR
            subject LIKE '%プロモーション%' OR
            subject LIKE '%キャンペーン%' OR
            subject LIKE '%セール%' OR
            subject LIKE '%割引%' OR
            subject LIKE '%無料%' OR
            subject LIKE '%限定%' OR
            subject LIKE '%お得%' OR
            subject LIKE '%特典%'
          )
          GROUP BY \`from\`
          ORDER BY count DESC
          LIMIT 15
        `,
        description: '広告・プロモーション系メールの送信者'
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
      message: '広告・プロモーション系メール確認完了',
      results: results
    })

  } catch (error) {
    console.error('❌ 広告・プロモーションデータ確認エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '広告・プロモーションデータ確認に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 