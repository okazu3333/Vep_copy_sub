import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'overview'

    console.log(`🔍 BigQueryデータ分析開始: ${action}`)

    switch (action) {
      case 'overview':
        return await getDataOverview()
      case 'sample':
        return await getSampleData()
      case 'table-structure':
        return await getTableStructure()
      case 'data-quality':
        return await analyzeDataQuality()
      default:
        return NextResponse.json({
          success: false,
          error: '無効なアクションです'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('BigQueryデータ分析エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'データ分析中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// データ概要の取得
async function getDataOverview() {
  try {
    const queries = [
      {
        name: 'email_messages_overview',
        query: `
          SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT thread_id) as unique_threads,
            COUNT(DISTINCT \`from\`) as unique_senders,
            MIN(date) as earliest_date,
            MAX(date) as latest_date,
            AVG(LENGTH(body)) as avg_body_length,
            COUNT(CASE WHEN LENGTH(body) > 1000 THEN 1 END) as long_messages,
            COUNT(CASE WHEN LENGTH(body) < 100 THEN 1 END) as short_messages
          FROM \`viewpers.salesguard_alerts.email_messages\`
        `,
        description: 'email_messagesテーブルの概要'
      },
      {
        name: 'alerts_clean_overview',
        query: `
          SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT thread_id) as unique_threads,
            COUNT(DISTINCT \`from\`) as unique_senders,
            MIN(date) as earliest_created,
            MAX(date) as latest_created
          FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
        `,
        description: 'alerts_clean_v7_dedupテーブルの概要'
      }
    ]

    const results: any = {}
    
    for (const queryInfo of queries) {
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

    return NextResponse.json({
      success: true,
      message: 'データ概要の取得が完了しました',
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    throw error
  }
}

// サンプルデータの取得
async function getSampleData() {
  try {
    const queries = [
      {
        name: 'email_messages_sample',
        query: `
          SELECT 
            message_id,
            thread_id,
            \`from\` as sender_email,
            subject,
            SUBSTR(body, 1, 200) as body_preview,
            date,
            LENGTH(body) as body_length
          FROM \`viewpers.salesguard_alerts.email_messages\`
          ORDER BY date DESC
          LIMIT 10
        `,
        description: 'email_messagesの最新10件'
      },
      {
        name: 'alerts_clean_sample',
        query: `
          SELECT 
            alert_id as id,
            thread_id,
            \`from\` as sender_email,
            subject,
            SUBSTR(body, 1, 200) as body_preview,
            date as created_at,
            LENGTH(body) as body_length
          FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
          ORDER BY date DESC
          LIMIT 10
        `,
        description: 'alerts_clean_v7_dedupの最新10件'
      }
    ]

    const results: any = {}
    
    for (const queryInfo of queries) {
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
      message: 'サンプルデータの取得が完了しました',
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    throw error
  }
}

// テーブル構造の取得
async function getTableStructure() {
  try {
    const queries = [
      {
        name: 'email_messages_schema',
        query: `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            is_repeated
          FROM \`viewpers.salesguard_alerts.INFORMATION_SCHEMA.COLUMNS\`
          WHERE table_name = 'email_messages'
          ORDER BY ordinal_position
        `,
        description: 'email_messagesテーブルのスキーマ'
      },
      {
        name: 'alerts_clean_schema',
        query: `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            is_repeated
          FROM \`viewpers.salesguard_alerts.INFORMATION_SCHEMA.COLUMNS\`
          WHERE table_name = 'alerts_clean_v7_dedup'
          ORDER BY ordinal_position
        `,
        description: 'alerts_clean_v7_dedupテーブルのスキーマ'
      }
    ]

    const results: any = {}
    
    for (const queryInfo of queries) {
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
      message: 'テーブル構造の取得が完了しました',
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    throw error
  }
}

// データ品質の分析
async function analyzeDataQuality() {
  try {
    const queries = [
      {
        name: 'email_messages_quality',
        query: `
          SELECT 
            'total_messages' as metric,
            COUNT(*) as value
          FROM \`viewpers.salesguard_alerts.email_messages\`
          
          UNION ALL
          
          SELECT 
            'messages_with_subject' as metric,
            COUNT(*) as value
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE subject IS NOT NULL AND LENGTH(TRIM(subject)) > 0
          
          UNION ALL
          
          SELECT 
            'messages_with_body' as metric,
            COUNT(*) as value
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body IS NOT NULL AND LENGTH(TRIM(body)) > 0
          
          UNION ALL
          
          SELECT 
            'messages_with_sender' as metric,
            COUNT(*) as value
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE sender_email IS NOT NULL AND LENGTH(TRIM(sender_email)) > 0
          
          UNION ALL
          
          SELECT 
            'messages_with_thread_id' as metric,
            COUNT(*) as value
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE thread_id IS NOT NULL AND LENGTH(TRIM(thread_id)) > 0
          
          UNION ALL
          
          SELECT 
            'avg_body_length' as metric,
            ROUND(AVG(LENGTH(body)), 0) as value
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body IS NOT NULL
          
          UNION ALL
          
          SELECT 
            'messages_longer_than_500' as metric,
            COUNT(*) as value
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE LENGTH(body) > 500
        `,
        description: 'email_messagesのデータ品質分析'
      }
    ]

    const results: any = {}
    
    for (const queryInfo of queries) {
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
      message: 'データ品質分析が完了しました',
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    throw error
  }
} 