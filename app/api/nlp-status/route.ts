import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      messageId, 
      analysisType, 
      completed, 
      confidenceScore, 
      quality, 
      notes, 
      error,
      version = '1.0.0'
    } = body

    if (!messageId || !analysisType) {
      return NextResponse.json({
        success: false,
        error: 'messageId and analysisType are required'
      }, { status: 400 })
    }

    // 分析タイプに応じて更新するフィールドを決定
    let updateFields = ''
    let updateParams: any = { messageId }

    if (analysisType === 'all') {
      // 全分析完了の場合
      updateFields = `
        nlp_analysis_completed = @completed,
        nlp_analysis_timestamp = CURRENT_TIMESTAMP(),
        nlp_analysis_version = @version,
        keyword_analysis_completed = @completed,
        pattern_analysis_completed = @completed,
        sentiment_analysis_completed = @completed,
        thread_analysis_completed = @completed,
        nlp_confidence_score = @confidenceScore,
        nlp_analysis_quality = @quality
      `
      updateParams = {
        ...updateParams,
        completed,
        version,
        confidenceScore: confidenceScore || 0.0,
        quality: quality || 'medium'
      }
    } else {
      // 特定の分析タイプの場合
      const analysisField = `${analysisType}_analysis_completed`
      updateFields = `
        ${analysisField} = @completed,
        nlp_analysis_timestamp = CURRENT_TIMESTAMP(),
        nlp_analysis_version = @version
      `
      updateParams = {
        ...updateParams,
        completed,
        version
      }

      // 信頼度スコアと品質も更新
      if (confidenceScore !== undefined) {
        updateFields += `, nlp_confidence_score = @confidenceScore`
        updateParams.confidenceScore = confidenceScore
      }
      if (quality) {
        updateFields += `, nlp_analysis_quality = @quality`
        updateParams.quality = quality
      }
    }

    // エラー情報がある場合は更新
    if (error) {
      updateFields += `, nlp_analysis_error = @error`
      updateParams.error = error
    }

    // メモがある場合は更新
    if (notes) {
      updateFields += `, nlp_analysis_notes = @notes`
      updateParams.notes = notes
    }

    // 全分析が完了しているかチェック
    if (analysisType === 'all' || analysisType === 'individual') {
      const checkQuery = `
        SELECT 
          keyword_analysis_completed,
          pattern_analysis_completed,
          sentiment_analysis_completed,
          thread_analysis_completed
        FROM \`salesguard_alerts.alerts_clean_v7_dedup\`
        WHERE message_id = @messageId
      `
      const [checkRows] = await bigquery.query({
        query: checkQuery,
        params: { messageId }
      })

      if (checkRows.length > 0) {
        const row = checkRows[0]
        const allCompleted = row.keyword_analysis_completed && 
                           row.pattern_analysis_completed && 
                           row.sentiment_analysis_completed && 
                           row.thread_analysis_completed

        if (allCompleted) {
          updateFields += `, nlp_analysis_completed = TRUE`
        }
      }
    }

    const updateQuery = `
      UPDATE \`salesguard_alerts.alerts_clean_v7_dedup\`
      SET ${updateFields}
      WHERE message_id = @messageId
    `

    await bigquery.query({
      query: updateQuery,
      params: updateParams
    })

    return NextResponse.json({
      success: true,
      message: `NLP analysis status updated for message ${messageId}`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('NLP status update error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')

    if (!messageId) {
      return NextResponse.json({
        success: false,
        error: 'messageId is required'
      }, { status: 400 })
    }

    const query = `
      SELECT 
        message_id,
        nlp_analysis_completed,
        nlp_analysis_timestamp,
        nlp_analysis_version,
        keyword_analysis_completed,
        pattern_analysis_completed,
        sentiment_analysis_completed,
        thread_analysis_completed,
        nlp_confidence_score,
        nlp_analysis_quality,
        nlp_analysis_notes,
        nlp_analysis_error,
        nlp_analysis_retry_count
      FROM \`salesguard_alerts.alerts_clean_v7_dedup\`
      WHERE message_id = @messageId
    `

    const [rows] = await bigquery.query({
      query,
      params: { messageId }
    })

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Message not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: rows[0]
    })

  } catch (error) {
    console.error('NLP status fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 