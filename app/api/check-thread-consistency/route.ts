import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET() {
  try {
    console.log('🔍 スレッド整合性確認開始')

    // スレッド件数とメッセージ件数の整合性を確認するクエリ
    const queries = [
      {
        name: 'thread_message_count_analysis',
        query: `
          SELECT 
            COUNT(DISTINCT thread_id) as total_threads,
            COUNT(*) as total_messages,
            AVG(messages_per_thread) as avg_messages_per_thread,
            MAX(messages_per_thread) as max_messages_in_thread,
            MIN(messages_per_thread) as min_messages_in_thread,
            COUNT(CASE WHEN messages_per_thread = 1 THEN 1 END) as single_message_threads,
            COUNT(CASE WHEN messages_per_thread > 1 THEN 1 END) as multi_message_threads
          FROM (
            SELECT 
              thread_id,
              COUNT(*) as messages_per_thread
            FROM \`viewpers.salesguard_alerts.alerts_clean_v6\`
            GROUP BY thread_id
          )
        `,
        description: 'スレッド数とメッセージ数の詳細分析'
      },
      {
        name: 'thread_message_distribution',
        query: `
          SELECT 
            messages_per_thread,
            COUNT(*) as thread_count,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
          FROM (
            SELECT 
              thread_id,
              COUNT(*) as messages_per_thread
            FROM \`viewpers.salesguard_alerts.alerts_clean_v6\`
            GROUP BY thread_id
          )
          GROUP BY messages_per_thread
          ORDER BY messages_per_thread
        `,
        description: 'スレッドあたりのメッセージ数分布'
      },
      {
        name: 'large_thread_details',
        query: `
          SELECT 
            thread_id,
            COUNT(*) as message_count,
            MIN(subject) as thread_subject,
            MIN(\`from\`) as thread_from,
            MIN(date) as thread_start,
            MAX(date) as thread_end,
            STRING_AGG(DISTINCT \`to\`, ', ') as recipients
          FROM \`viewpers.salesguard_alerts.alerts_clean_v6\`
          GROUP BY thread_id
          HAVING COUNT(*) > 5
          ORDER BY COUNT(*) DESC
          LIMIT 10
        `,
        description: '大量メッセージを含むスレッド（5件以上）の詳細'
      },
      {
        name: 'duplicate_message_check',
        query: `
          SELECT 
            thread_id,
            message_id,
            subject,
            \`from\`,
            \`to\`,
            body_hash,
            COUNT(*) as duplicate_count
          FROM (
            SELECT 
              thread_id,
              message_id,
              subject,
              \`from\`,
              \`to\`,
              MD5(body) as body_hash,
              body
            FROM \`viewpers.salesguard_alerts.alerts_clean_v6\`
          )
          GROUP BY thread_id, message_id, subject, \`from\`, \`to\`, body_hash
          HAVING COUNT(*) > 1
          ORDER BY duplicate_count DESC
          LIMIT 20
        `,
        description: '重複メッセージの確認'
      },
      {
        name: 'forwarding_service_thread_analysis',
        query: `
          SELECT 
            thread_id,
            COUNT(*) as message_count,
            MIN(subject) as thread_subject,
            MIN(\`from\`) as thread_from,
            COUNT(DISTINCT \`to\`) as unique_recipients,
            STRING_AGG(DISTINCT \`to\`, ', ') as all_recipients,
            MIN(date) as thread_start,
            MAX(date) as thread_end
          FROM \`viewpers.salesguard_alerts.alerts_clean_v6\`
          WHERE \`to\` LIKE '%ml.cross-m.co.jp%'
          GROUP BY thread_id
          HAVING COUNT(*) > 1
          ORDER BY COUNT(*) DESC
          LIMIT 15
        `,
        description: '転送サービス経由スレッドの分析'
      },
      {
        name: 'api_response_consistency_check',
        query: `
          SELECT 
            'API Response Consistency Check' as check_type,
            COUNT(DISTINCT thread_id) as unique_threads_in_table,
            COUNT(*) as total_messages_in_table,
            ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT thread_id), 2) as avg_messages_per_thread
          FROM \`viewpers.salesguard_alerts.alerts_clean_v6\`
        `,
        description: 'APIレスポンス整合性チェック'
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
      message: 'スレッド整合性確認完了',
      results: results
    })

  } catch (error) {
    console.error('❌ スレッド整合性確認エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'スレッド整合性確認に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 