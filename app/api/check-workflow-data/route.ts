import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 ワークフロー承認依頼データ確認開始')

    // ワークフロー関連のデータを検索
    const queries = [
      {
        name: 'workflow_approval_requests',
        query: `
          SELECT 
            COUNT(*) as count,
            'ワークフロー承認依頼' as description
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE (
            subject LIKE '%ワークフロー%' OR
            subject LIKE '%承認%' OR
            subject LIKE '%依頼%' OR
            body LIKE '%ワークフロー%' OR
            body LIKE '%承認%' OR
            body LIKE '%依頼%'
          )
        `,
        description: 'ワークフロー承認依頼関連'
      },
      {
        name: 'workflow_specific_subjects',
        query: `
          SELECT 
            subject,
            \`from\`,
            \`to\`,
            date,
            COUNT(*) as count
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE (
            subject LIKE '%ワークフロー%' OR
            subject LIKE '%承認%' OR
            subject LIKE '%依頼%'
          )
          GROUP BY subject, \`from\`, \`to\`, date
          ORDER BY count DESC
          LIMIT 20
        `,
        description: 'ワークフロー関連の件名詳細'
      },
      {
        name: 'workflow_body_content',
        query: `
          SELECT 
            subject,
            \`from\`,
            \`to\`,
            date,
            SUBSTRING(body, 1, 200) as body_preview
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE (
            body LIKE '%ワークフロー%' OR
            body LIKE '%承認%' OR
            body LIKE '%依頼%'
          )
          LIMIT 10
        `,
        description: 'ワークフロー関連の本文内容'
      },
      {
        name: 'total_workflow_emails',
        query: `
          SELECT 
            COUNT(*) as count
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE (
            subject LIKE '%ワークフロー%' OR
            subject LIKE '%承認%' OR
            subject LIKE '%依頼%' OR
            body LIKE '%ワークフロー%' OR
            body LIKE '%承認%' OR
            body LIKE '%依頼%'
          )
        `,
        description: 'ワークフロー関連メール総数'
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
      message: 'ワークフロー承認依頼データ確認完了',
      results: results
    })

  } catch (error) {
    console.error('❌ ワークフローデータ確認エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'ワークフローデータ確認に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 