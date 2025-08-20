import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'
import { PatternMatcherV2 } from '@/lib/pattern-matcher-v2'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 アラート検知開始...')

    const { action, limit = 50 } = await request.json()

    if (action === 'detect_alerts') {
      return await detectAlerts(limit)
    } else if (action === 'get_detection_summary') {
      return await getDetectionSummary()
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use detect_alerts or get_detection_summary'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ アラート検知エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to detect alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function detectAlerts(limit: number) {
  try {
    console.log(`🔍 ${limit}件のアラート検知開始...`)

    // 日本語NLP分析結果を取得
    const nlpQuery = `
      SELECT 
        message_id,
        thread_id,
        sender_email,
        subject,
        body,
        date,
        japanese_nlp_analysis,
        pattern_matches_count,
        analysis_timestamp
      FROM \`viewpers.salesguard_alerts.japanese_nlp_analysis_results\`
      WHERE pattern_matches_count > 0
      ORDER BY analysis_timestamp DESC
      LIMIT ${limit}
    `

    const [nlpResults] = await bigquery.query({ query: nlpQuery, useLegacySql: false })
    console.log(`📊 NLP分析結果: ${nlpResults?.length || 0}件`)

    // アラート検知結果を格納
    const detectedAlerts = []

          for (const nlpResult of nlpResults || []) {
        try {
          // パターンマッチング結果を再実行
          const patternMatches = PatternMatcherV2.matchPatterns(
            nlpResult.subject || '',
            nlpResult.body || '',
            {
              message_id: nlpResult.message_id,
              thread_id: nlpResult.thread_id,
              subject: nlpResult.subject || '',
              body: nlpResult.body || '',
              sentiment: {
                score: 0,
                magnitude: 0,
                label: 'NEUTRAL'
              },
              entities: nlpResult.japanese_nlp_analysis?.entities || [],
              categories: nlpResult.japanese_nlp_analysis?.categories || [],
              syntax: {
                sentences: 1,
                tokens: (nlpResult.body || '').length,
                avg_sentence_length: (nlpResult.body || '').length
              },
              analysis_timestamp: nlpResult.analysis_timestamp
            }
          )
          
          const topPattern = patternMatches.length > 0 ? patternMatches[0] : null

          if (topPattern) {
          const alertInfo = {
            message_id: nlpResult.message_id,
            thread_id: nlpResult.thread_id,
            sender_email: nlpResult.sender_email,
            subject: nlpResult.subject,
            body: nlpResult.body,
            date: nlpResult.date,
            detection_score: topPattern.confidence || 0,
            detected_pattern: topPattern.pattern_name || 'unknown',
            risk_score: topPattern.risk_score || 0,
            urgency_level: topPattern.urgency_level || 'low',
            business_impact: topPattern.business_impact || 'low',
            matched_keywords: topPattern.matched_conditions || [],
            recommended_actions: topPattern.recommended_actions || [],
            nlp_sentiment_score: nlpResult.japanese_nlp_analysis?.sentiment?.score || 0,
            nlp_sentiment_magnitude: nlpResult.japanese_nlp_analysis?.sentiment?.magnitude || 0,
            analysis_timestamp: nlpResult.analysis_timestamp
          }

          detectedAlerts.push(alertInfo)
        }

      } catch (error) {
        console.error(`❌ アラート解析エラー (${nlpResult.message_id}):`, error)
      }
    }

    // 検知結果をBigQueryに保存
    if (detectedAlerts.length > 0) {
      await saveDetectedAlerts(detectedAlerts)
    }

    console.log(`✅ アラート検知完了: ${detectedAlerts.length}件`)

    return NextResponse.json({
      success: true,
      detected_alerts: detectedAlerts.length,
      alerts: detectedAlerts.slice(0, 10), // 最初の10件を返す
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ アラート検知処理エラー:', error)
    throw error
  }
}

async function saveDetectedAlerts(alerts: any[]) {
  try {
    console.log(`💾 検知されたアラートを保存中: ${alerts.length}件`)

    // 検知結果テーブルを作成（存在しない場合）
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \`viewpers.salesguard_alerts.detected_alerts\` (
        message_id STRING,
        thread_id STRING,
        sender_email STRING,
        subject STRING,
        body STRING,
        date STRING,
        detection_score FLOAT64,
        detected_pattern STRING,
        risk_score FLOAT64,
        urgency_level STRING,
        business_impact STRING,
        matched_keywords ARRAY<STRING>,
        recommended_actions ARRAY<STRING>,
        nlp_sentiment_score FLOAT64,
        nlp_sentiment_magnitude FLOAT64,
        analysis_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      PARTITION BY DATE(analysis_timestamp)
      CLUSTER BY detected_pattern, urgency_level
    `

    await bigquery.query({ query: createTableQuery, useLegacySql: false })

    // データを挿入
    const dataset = bigquery.dataset('salesguard_alerts')
    const table = dataset.table('detected_alerts')

    const rows = alerts.map(alert => ({
      message_id: alert.message_id,
      thread_id: alert.thread_id,
      sender_email: alert.sender_email,
      subject: alert.subject,
      body: alert.body,
      date: alert.date,
      detection_score: alert.detection_score,
      detected_pattern: alert.detected_pattern,
      risk_score: alert.risk_score,
      urgency_level: alert.urgency_level,
      business_impact: alert.business_impact,
      matched_keywords: alert.matched_keywords,
      recommended_actions: alert.recommended_actions,
      nlp_sentiment_score: alert.nlp_sentiment_score,
      nlp_sentiment_magnitude: alert.nlp_sentiment_magnitude,
      analysis_timestamp: alert.analysis_timestamp
    }))

    await table.insert(rows)
    console.log(`✅ 検知されたアラートの保存完了: ${alerts.length}件`)

  } catch (error) {
    console.error('❌ 検知されたアラートの保存エラー:', error)
    throw error
  }
}

async function getDetectionSummary() {
  try {
    console.log('📊 検知サマリー取得開始...')

    // 検知されたアラートの統計を取得
    const summaryQuery = `
      SELECT 
        detected_pattern,
        urgency_level,
        business_impact,
        COUNT(*) as count,
        AVG(detection_score) as avg_score,
        AVG(risk_score) as avg_risk
      FROM \`viewpers.salesguard_alerts.detected_alerts\`
      GROUP BY detected_pattern, urgency_level, business_impact
      ORDER BY count DESC
    `

    const [summaryResults] = await bigquery.query({ query: summaryQuery, useLegacySql: false })

    // 全体の統計
    const totalQuery = `SELECT COUNT(*) as total FROM \`viewpers.salesguard_alerts.detected_alerts\``
    const [totalResult] = await bigquery.query({ query: totalQuery, useLegacySql: false })
    const totalDetected = totalResult?.[0]?.total || 0

    return NextResponse.json({
      success: true,
      summary: {
        total_detected: totalDetected,
        patterns: summaryResults || []
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 検知サマリー取得エラー:', error)
    throw error
  }
} 