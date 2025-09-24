import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET() {
  try {
    console.log('🔍 スレッド表示確認開始')

    // スレッド表示の動作を確認するクエリ
    const queries = [
      {
        name: 'thread_count_analysis',
        query: `
          SELECT 
            COUNT(DISTINCT thread_id) as total_threads,
            COUNT(*) as total_messages,
            AVG(message_count) as avg_messages_per_thread,
            MAX(message_count) as max_messages_in_thread,
            MIN(message_count) as min_messages_in_thread
          FROM (
            SELECT 
              thread_id,
              COUNT(*) as message_count
            FROM \`viewpers.salesguard_alerts.alerts_clean_v5\`
            GROUP BY thread_id
          )
        `,
        description: 'スレッド数とメッセージ数の分析'
      },
      {
        name: 'multi_message_threads',
        query: `
          SELECT 
            thread_id,
            COUNT(*) as message_count,
            MIN(subject) as thread_subject,
            MIN(\`from\`) as thread_from,
            MIN(date) as thread_start,
            MAX(date) as thread_end
          FROM \`viewpers.salesguard_alerts.alerts_clean_v5\`
          GROUP BY thread_id
          HAVING COUNT(*) > 1
          ORDER BY message_count DESC
          LIMIT 10
        `,
        description: '複数メッセージを含むスレッド（上位10件）'
      },
      {
        name: 'thread_message_details',
        query: `
          SELECT 
            thread_id,
            message_id,
            subject,
            \`from\`,
            \`to\`,
            reply_level,
            is_root,
            date,
            SUBSTRING(body, 1, 100) as body_preview
          FROM \`viewpers.salesguard_alerts.alerts_clean_v5\`
          WHERE thread_id IN (
            SELECT thread_id
            FROM \`viewpers.salesguard_alerts.alerts_clean_v5\`
            GROUP BY thread_id
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
            LIMIT 3
          )
          ORDER BY thread_id, reply_level, date
        `,
        description: '複数メッセージスレッドの詳細（上位3スレッド）'
      },
      {
        name: 'forwarding_service_improvement_check',
        query: `
          SELECT 
            thread_id,
            message_id,
            subject,
            \`from\`,
            \`to\`,
            customer_email,
            reply_level,
            is_root,
            date
          FROM \`viewpers.salesguard_alerts.alerts_clean_v5\`
          WHERE \`to\` LIKE '%ml.cross-m.co.jp%'
          ORDER BY thread_id, reply_level, date
          LIMIT 20
        `,
        description: '転送サービス改善の確認（ml.cross-m.co.jp経由）'
      },
      {
        name: 'thread_structure_validation',
        query: `
          SELECT 
            thread_id,
            COUNT(*) as total_messages,
            COUNT(CASE WHEN is_root = true THEN 1 END) as root_messages,
            COUNT(CASE WHEN is_root = false THEN 1 END) as reply_messages,
            MAX(reply_level) as max_reply_level,
            MIN(date) as first_message_date,
            MAX(date) as last_message_date
          FROM \`viewpers.salesguard_alerts.alerts_clean_v5\`
          GROUP BY thread_id
          HAVING COUNT(*) > 1
          ORDER BY COUNT(*) DESC
          LIMIT 15
        `,
        description: 'スレッド構造の検証（複数メッセージスレッド）'
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
      message: 'スレッド表示確認完了',
      results: results
    })

  } catch (error) {
    console.error('❌ スレッド表示確認エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'スレッド表示確認に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 