import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const analysisType = searchParams.get('type') || 'summary'
    
    let query = ''
    let description = ''
    
    switch (analysisType) {
      case 'summary':
        // 基本統計
        query = `
          SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT thread_id) as unique_threads,
            COUNT(DISTINCT \`from\`) as unique_senders,
            COUNT(DISTINCT \`to\`) as unique_recipients
          FROM \`viewpers.salesguard_alerts.email_messages\`
        `
        description = '基本統計'
        break
        
      case 'corruption':
        // 文字化けデータの詳細分析
        query = `
          SELECT 
            'body LIKE $B%' as pattern,
            COUNT(*) as count,
            '文字化けパターン1' as description
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body LIKE '$B%'
          
          UNION ALL
          
          SELECT 
            'body LIKE %$B%' as pattern,
            COUNT(*) as count,
            '文字化けパターン2' as description
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body LIKE '%$B%'
          
          UNION ALL
          
          SELECT 
            'body LIKE %%' as pattern,
            COUNT(*) as count,
            '文字化けパターン3' as description
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body LIKE '%%'
          
          UNION ALL
          
          SELECT 
            'body LIKE %?%' as pattern,
            COUNT(*) as count,
            '文字化けパターン4' as description
          FROM \`viewpers.salesguard_alerts.email_messages\`
          WHERE body LIKE '%?%'
        `
        description = '文字化けデータ分析'
        break
        
      case 'senders':
        // 送信者パターンの分析
        query = `
          SELECT 
            CASE 
              WHEN \`from\` LIKE '%info@%' THEN 'info@'
              WHEN \`from\` LIKE '%noreply@%' THEN 'noreply@'
              WHEN \`from\` LIKE '%support@%' THEN 'support@'
              WHEN \`from\` LIKE '%magazine@%' THEN 'magazine@'
              WHEN \`from\` LIKE '%learn@%' THEN 'learn@'
              WHEN \`from\` LIKE '%root@%' THEN 'root@'
              WHEN \`from\` LIKE '%kintai@%' THEN 'kintai@'
              WHEN \`from\` LIKE '%md_sys_admin@%' THEN 'md_sys_admin@'
              WHEN \`from\` LIKE '%facebookmail.com%' THEN 'facebookmail.com'
              WHEN \`from\` LIKE '%ns.chatwork.com%' THEN 'ns.chatwork.com'
              WHEN \`from\` LIKE '%ml.cross-m.co.jp%' THEN 'ml.cross-m.co.jp'
              WHEN \`from\` LIKE '%@cross-m.co.jp%' THEN 'cross-m.co.jp'
              ELSE 'その他'
            END as sender_pattern,
            COUNT(*) as count
          FROM \`viewpers.salesguard_alerts.email_messages\`
          GROUP BY sender_pattern
          ORDER BY count DESC
        `
        description = '送信者パターン分析'
        break
        
      case 'subjects':
        // 件名パターンの分析
        query = `
          SELECT 
            CASE 
              WHEN subject LIKE '%配信管理システム%' THEN '配信管理システム'
              WHEN subject LIKE '%配信完了%' THEN '配信完了'
              WHEN subject LIKE '%システム%' THEN 'システム関連'
              WHEN subject LIKE '%自動送信%' THEN '自動送信'
              WHEN subject LIKE '%ワークフロー%' THEN 'ワークフロー'
              WHEN subject LIKE '%お問い合わせ%' THEN 'お問い合わせ'
              WHEN subject LIKE '%Re:%' THEN 'リプライ'
              ELSE 'その他'
            END as subject_pattern,
            COUNT(*) as count
          FROM \`viewpers.salesguard_alerts.email_messages\`
          GROUP BY subject_pattern
          ORDER BY count DESC
        `
        description = '件名パターン分析'
        break
        
      case 'body_content':
        // 本文内容の分析
        query = `
          SELECT 
            CASE 
              WHEN body LIKE '%以下のとおり配信依頼送信完了しました%' THEN '配信完了メッセージ'
              WHEN body LIKE '%配信依頼%' THEN '配信依頼'
              WHEN body LIKE '%システム%' THEN 'システム関連'
              WHEN body LIKE '%自動%' THEN '自動メッセージ'
              WHEN LENGTH(body) < 100 THEN '短い本文'
              WHEN LENGTH(body) > 1000 THEN '長い本文'
              ELSE '通常の本文'
            END as body_pattern,
            COUNT(*) as count
          FROM \`viewpers.salesguard_alerts.email_messages\`
          GROUP BY body_pattern
          ORDER BY count DESC
        `
        description = '本文内容分析'
        break
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid analysis type',
          availableTypes: ['summary', 'corruption', 'senders', 'subjects', 'body_content']
        })
    }

    const result = await bigquery.query({
      query: query,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const data = result[0] || []

    return NextResponse.json({
      success: true,
      analysisType: analysisType,
      description: description,
      data: data,
      recordCount: data.length
    })

  } catch (error) {
    console.error('Email messages analysis error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze email messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 