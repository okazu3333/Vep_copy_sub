import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('message_id') || '687125e198c3b@ml.cross-m.co.jp'

    // 1. 指定されたメッセージIDの詳細分析
    const messageDetailQuery = `
      SELECT 
        alert_id,
        message_id,
        thread_id,
        subject,
        sender,
        body,
        created_at,
        is_root,
        reply_level,
        source_file
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      WHERE message_id = ?
      ORDER BY created_at ASC
      LIMIT 10
    `

    // 2. 本文の類似性チェック（最初の100文字で比較）
    const bodySimilarityQuery = `
      SELECT 
        alert_id,
        message_id,
        LEFT(body, 100) as body_preview,
        LENGTH(body) as body_length,
        created_at
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      WHERE message_id = ?
      ORDER BY created_at ASC
      LIMIT 5
    `

    // 3. 送信者情報の分析
    const senderAnalysisQuery = `
      SELECT 
        sender,
        COUNT(*) as count,
        MIN(created_at) as first_sent,
        MAX(created_at) as last_sent
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      WHERE message_id = ?
      GROUP BY sender
      ORDER BY count DESC
    `

    // 4. スレッド内の他のメッセージ
    const threadMessagesQuery = `
      SELECT 
        alert_id,
        message_id,
        subject,
        sender,
        created_at,
        is_root,
        reply_level
      FROM \`viewpers.salesguard_alerts.alerts_v2\`
      WHERE thread_id = (
        SELECT DISTINCT thread_id 
        FROM \`viewpers.salesguard_alerts.alerts_v2\` 
        WHERE message_id = ?
        LIMIT 1
      )
      ORDER BY created_at ASC
    `

    const [messageDetail, bodySimilarity, senderAnalysis, threadMessages] = await Promise.all([
      bigquery.query({
        query: messageDetailQuery,
        params: [messageId],
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: bodySimilarityQuery,
        params: [messageId],
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: senderAnalysisQuery,
        params: [messageId],
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: threadMessagesQuery,
        params: [messageId],
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
    ])

    const messageDetails = messageDetail[0] || []
    const bodySimilarities = bodySimilarity[0] || []
    const senderAnalyses = senderAnalysis[0] || []
    const threadMessageList = threadMessages[0] || []

    // 本文の類似性分析
    const bodyAnalysis = {
      total_messages: bodySimilarities.length,
      unique_bodies: new Set(bodySimilarities.map((item: any) => item.body_preview)).size,
      body_variations: bodySimilarities.map((item: any) => ({
        alert_id: item.alert_id,
        body_preview: item.body_preview,
        body_length: item.body_length,
        created_at: item.created_at
      }))
    }

    return NextResponse.json({
      success: true,
      data: {
        message_id: messageId,
        analysis: {
          message_details: messageDetails,
          body_similarity: bodyAnalysis,
          sender_analysis: senderAnalyses,
          thread_messages: threadMessageList
        },
        summary: {
          total_duplicates: messageDetails.length,
          unique_senders: senderAnalyses.length,
          unique_bodies: bodyAnalysis.unique_bodies,
          thread_message_count: threadMessageList.length
        }
      }
    })

  } catch (error) {
    console.error('Mailing list analysis API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to analyze mailing list' },
      { status: 500 }
    )
  }
} 