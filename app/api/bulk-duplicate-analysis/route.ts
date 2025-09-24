import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET() {
  try {
    // 重複が多いメッセージIDを取得
    const duplicateMessagesQuery = `
      SELECT 
        message_id,
        COUNT(*) as duplicate_count,
        COUNT(DISTINCT sender) as unique_senders,
        COUNT(DISTINCT LEFT(body, 100)) as unique_body_previews,
        MIN(created_at) as first_sent,
        MAX(created_at) as last_sent
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      GROUP BY message_id
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
      LIMIT 10
    `

    const duplicateResults = await bigquery.query({
      query: duplicateMessagesQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const duplicateMessages = duplicateResults[0] || []

    // 各重複メッセージの詳細分析
    const detailedAnalysis = await Promise.all(
      duplicateMessages.map(async (item: any) => {
        const messageId = item.message_id
        
        // 本文のサンプルを取得
        const bodySampleQuery = `
          SELECT 
            alert_id,
            LEFT(body, 100) as body_preview,
            LENGTH(body) as body_length,
            created_at
          FROM \`viewpers.salesguard_alerts.alerts_v2\`
          WHERE message_id = ?
          ORDER BY created_at ASC
          LIMIT 3
        `

        const bodySample = await bigquery.query({
          query: bodySampleQuery,
          params: [messageId],
          useLegacySql: false,
          maximumBytesBilled: '1000000000'
        })

        return {
          message_id: messageId,
          duplicate_count: item.duplicate_count,
          unique_senders: item.unique_senders,
          unique_body_previews: item.unique_body_previews,
          first_sent: item.first_sent,
          last_sent: item.last_sent,
          body_samples: bodySample[0] || []
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        total_duplicate_messages: duplicateMessages.length,
        duplicate_analysis: detailedAnalysis,
        summary: {
          total_duplicate_records: duplicateMessages.reduce((sum: number, item: any) => sum + item.duplicate_count, 0),
          messages_with_duplicates: duplicateMessages.length,
          average_duplicates_per_message: duplicateMessages.reduce((sum: number, item: any) => sum + item.duplicate_count, 0) / duplicateMessages.length
        }
      }
    })

  } catch (error) {
    console.error('Bulk duplicate analysis API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to analyze duplicates' },
      { status: 500 }
    )
  }
} 