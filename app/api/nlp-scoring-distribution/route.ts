import { NextRequest, NextResponse } from 'next/server'
import { NLPAnalyzerV2, NLPAnalysisResult } from '@/lib/nlp-analyzer-v2'
import { PatternMatcherV2 } from '@/lib/pattern-matcher-v2'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()
const nlpAnalyzer = new NLPAnalyzerV2()

// パターンマッチング結果の型定義（nlp-analyzer-v2.tsからインポート）
import { PatternMatchResult } from '@/lib/nlp-analyzer-v2'

export async function POST(request: NextRequest) {
  try {
    const { action, limit = 100, saveResults = true } = await request.json()

    console.log(`🚀 NLP分析・スコアリング・振り分け開始: ${action}`)

    switch (action) {
      case 'analyze_and_score':
        return await analyzeAndScoreEmails(limit, saveResults)
      case 'distribute_to_segments':
        return await distributeToSegments()
      case 'get_analysis_summary':
        return await getAnalysisSummary()
      case 'get_segment_distribution':
        return await getSegmentDistribution()
      default:
        return NextResponse.json({
          success: false,
          error: '無効なアクションです'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('NLP分析・スコアリング・振り分けエラー:', error)
    console.error('エラー詳細:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.constructor.name : 'Unknown'
    })
    return NextResponse.json({
      success: false,
      error: '処理中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown'
    }, { status: 500 })
  }
}

// メールの分析とスコアリング
async function analyzeAndScoreEmails(limit: number, saveResults: boolean) {
  const startTime = Date.now()
  console.log(`🚀 ${limit}件のメール分析・スコアリング開始...`)

  try {
    // BigQueryからメールデータを取得
    const query = `
      SELECT message_id, thread_id, \`from\` as sender_email, subject, body, date
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
      WHERE (
        body NOT LIKE '$B%' AND body NOT LIKE '%$B%' AND
        body NOT LIKE '%以下のとおり配信依頼送信完了しました%' AND
        subject NOT LIKE '%配信管理システム配信完了報告%' AND
        \`from\` NOT LIKE '%info@%' AND \`from\` NOT LIKE '%noreply@%' AND
        \`from\` NOT LIKE '%support@%' AND \`from\` NOT LIKE '%magazine@%'
      )
      ORDER BY date DESC
      LIMIT ${limit}
    `

    console.log('📊 BigQueryクエリ実行中...')
    const [rows] = await bigquery.query({ query, useLegacySql: false })
    console.log(`✅ ${rows.length}件のメールデータを取得`)

    if (rows.length === 0) {
      return {
        success: true,
        message: '分析対象のメールがありません',
        data: {
          total_processed: 0,
          successful_analyses: 0,
          failed_analyses: 0,
          analysis_results: []
        },
        summary: {
          total_messages: 0,
          risk_score_distribution: {},
          urgency_level_distribution: {},
          business_impact_distribution: {},
          segment_distribution: {},
          top_patterns: []
        },
        processing_time_ms: Date.now() - startTime
      }
    }

    const analysisResults: Array<{
      message_id: string
      thread_id: string
      sender_email: string
      subject: string
      body: string
      date: string
      nlp_analysis?: any
      pattern_matches?: PatternMatchResult[]
      top_pattern?: PatternMatchResult | null
      final_risk_score?: number
      final_urgency_level?: string
      final_business_impact?: string
      assigned_segments?: string[]
      error?: {
        message: string
        type: string
        stack?: string
      }
      analysis_timestamp: string
    }> = []

    let successful = 0
    let failed = 0

    for (const row of rows) {
      try {
        console.log(`🔍 分析中: ${row.subject || '件名なし'}`)

        // 前処理付きNLP分析を実行
        let nlpResult: NLPAnalysisResult | null = null
        try {
          nlpResult = await nlpAnalyzer.analyzeTextWithPreprocessing(row.body)
          console.log(`✅ NLP分析完了: ${nlpResult ? '成功' : '失敗'}`)
        } catch (error) {
          console.warn(`⚠️ NLP分析エラー:`, error)
          nlpResult = null
        }

        // パターンマッチング実行
        let patternMatches: PatternMatchResult[] = []
        try {
          if (nlpResult) {
            patternMatches = PatternMatcherV2.matchPatterns(
              row.subject || '',
              row.body,
              nlpResult
            )
          } else {
            // NLP分析が失敗した場合は基本的なキーワードマッチングのみ実行
            patternMatches = PatternMatcherV2.matchPatterns(
              row.subject || '',
              row.body,
              null
            )
          }
          console.log(`✅ パターンマッチング完了: ${patternMatches.length}件のパターンを検出`)
        } catch (error) {
          console.warn(`⚠️ パターンマッチングエラー:`, error)
          patternMatches = []
        }

        // トップパターンの決定
        const topPattern = patternMatches.length > 0 ? patternMatches[0] : null

        // 最終スコアの計算
        const finalRiskScore = topPattern ? topPattern.risk_score : 0
        const finalUrgencyLevel = topPattern ? topPattern.urgency_level : 'low'
        const finalBusinessImpact = topPattern ? topPattern.business_impact : 'low'

        // セグメントの割り当て
        const assignedSegments = patternMatches.map(match => match.pattern_name)

        const result = {
          message_id: row.message_id,
          thread_id: row.thread_id,
          sender_email: row.sender_email,
          subject: row.subject || '',
          body: row.body,
          date: row.date,
          nlp_analysis: nlpResult,
          pattern_matches: patternMatches,
          top_pattern: topPattern,
          final_risk_score: finalRiskScore,
          final_urgency_level: finalUrgencyLevel,
          final_business_impact: finalBusinessImpact,
          assigned_segments: assignedSegments,
          analysis_timestamp: new Date().toISOString()
        }

        analysisResults.push(result)
        successful++

        // 進捗表示
        if (successful % 10 === 0) {
          console.log(`✅ ${successful}/${rows.length}件完了`)
        }

      } catch (error) {
        console.error(`❌ メール分析エラー (${row.message_id}):`, error)
        console.error('エラー詳細:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          row: {
            message_id: row.message_id,
            body_length: row.body?.length || 0,
            subject: row.subject
          }
        })
        
        // エラー情報を結果に含める
        const errorResult = {
          message_id: row.message_id,
          thread_id: row.thread_id,
          sender_email: row.sender_email,
          subject: row.subject || '',
          body: row.body,
          date: row.date,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            type: error instanceof Error ? error.constructor.name : 'Unknown',
            stack: error instanceof Error ? error.stack : undefined
          },
          analysis_timestamp: new Date().toISOString()
        }
        
        analysisResults.push(errorResult)
        failed++
      }
    }

    // 結果をBigQueryに保存
    if (saveResults && analysisResults.length > 0) {
          console.log('💾 BigQuery保存開始...')
    console.log('📊 保存対象データ数:', analysisResults.length)
    console.log('📝 最初のデータサンプル:', JSON.stringify(analysisResults[0], null, 2))
    console.log('🔍 pattern_matchesの型:', typeof analysisResults[0].pattern_matches)
    console.log('🔍 pattern_matchesの内容:', analysisResults[0].pattern_matches)
      await saveAnalysisResultsToBigQuery(analysisResults)
    }

    // サマリー統計の計算
    const summary = calculateAnalysisSummary(analysisResults)

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'メールの分析・スコアリングが完了しました',
      data: {
        total_processed: rows.length,
        successful_analyses: successful,
        failed_analyses: failed,
        analysis_results: analysisResults,
        summary,
        processing_time_ms: processingTime
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('メール分析・スコアリングエラー:', error)
    console.error('エラー詳細:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.constructor.name : 'Unknown'
    })
    throw error
  }
}

// セグメントへの振り分け
async function distributeToSegments() {
  try {
    console.log('🔄 セグメントへの振り分け開始')

    // 分析結果テーブルからデータを取得
    const query = `
      SELECT 
        message_id,
        thread_id,
        sender_email,
        subject,
        body,
        date,
        final_risk_score,
        final_urgency_level,
        final_business_impact,
        assigned_segments,
        analysis_timestamp
      FROM \`viewpers.salesguard_alerts.nlp_analysis_results\`
      WHERE final_risk_score > 0
      ORDER BY final_risk_score DESC, analysis_timestamp DESC
    `

    const [rows] = await bigquery.query({ query })
    console.log(`📊 ${rows.length}件の分析結果を取得しました`)

    // セグメント別にグループ化
    const segmentGroups: Record<string, any[]> = {}
    
    rows.forEach(row => {
      const segments = Array.isArray(row.assigned_segments) ? row.assigned_segments : []
      segments.forEach((segment: string) => {
        if (!segmentGroups[segment]) {
          segmentGroups[segment] = []
        }
        segmentGroups[segment].push(row)
      })
    })

    // セグメント別統計の計算
    const segmentStats = Object.entries(segmentGroups).map(([segmentName, messages]) => {
      const riskScores = messages.map(m => m.final_risk_score)
      const urgencyLevels = messages.map(m => m.final_urgency_level)
      const businessImpacts = messages.map(m => m.final_business_impact)

      return {
        segment_name: segmentName,
        message_count: messages.length,
        avg_risk_score: riskScores.length > 0 ? 
          Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length) : 0,
        max_risk_score: Math.max(...riskScores),
        urgency_distribution: urgencyLevels.reduce((acc, level) => {
          acc[level] = (acc[level] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        business_impact_distribution: businessImpacts.reduce((acc, impact) => {
          acc[impact] = (acc[impact] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        messages: messages.slice(0, 10) // 最新10件のみ
      }
    })

    // セグメント別結果テーブルに保存
    await saveSegmentDistributionToBigQuery(segmentStats)

    return NextResponse.json({
      success: true,
      message: 'セグメントへの振り分けが完了しました',
      data: {
        total_messages: rows.length,
        segment_count: segmentStats.length,
        segment_distribution: segmentStats
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('セグメント振り分けエラー:', error)
    throw error
  }
}

// 分析サマリーの取得
async function getAnalysisSummary() {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_analyzed,
        COUNT(CASE WHEN final_risk_score >= 80 THEN 1 END) as high_risk_count,
        COUNT(CASE WHEN final_risk_score >= 60 AND final_risk_score < 80 THEN 1 END) as medium_risk_count,
        COUNT(CASE WHEN final_risk_score < 60 THEN 1 END) as low_risk_count,
        AVG(final_risk_score) as avg_risk_score,
        COUNT(DISTINCT TO_JSON_STRING(assigned_segments)) as unique_segments
      FROM \`viewpers.salesguard_alerts.nlp_analysis_results\`
      WHERE final_risk_score > 0
    `

    const [rows] = await bigquery.query({ query })
    const summary = rows[0]

    return NextResponse.json({
      success: true,
      message: '分析サマリーを取得しました',
      data: summary,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('分析サマリー取得エラー:', error)
    throw error
  }
}

// セグメント分布の取得
async function getSegmentDistribution() {
  try {
    const query = `
      SELECT 
        segment_name,
        message_count,
        avg_risk_score,
        max_risk_score,
        urgency_distribution,
        business_impact_distribution
      FROM \`viewpers.salesguard_alerts.segment_distribution\`
      ORDER BY message_count DESC
    `

    const [rows] = await bigquery.query({ query })

    return NextResponse.json({
      success: true,
      message: 'セグメント分布を取得しました',
      data: rows,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('セグメント分布取得エラー:', error)
    throw error
  }
}

// 分析結果をBigQueryに保存
async function saveAnalysisResultsToBigQuery(results: any[]) {
  try {
    const dataset = bigquery.dataset('salesguard_alerts')
    const table = dataset.table('nlp_analysis_results')

    // テーブルが存在しない場合は作成
    const [exists] = await table.exists()
    if (!exists) {
      const schema = [
        { name: 'message_id', type: 'STRING' },
        { name: 'thread_id', type: 'STRING' },
        { name: 'sender_email', type: 'STRING' },
        { name: 'subject', type: 'STRING' },
        { name: 'body', type: 'STRING' },
        { name: 'date', type: 'STRING' },
        { name: 'nlp_analysis', type: 'STRING' },
        { name: 'pattern_matches', type: 'ARRAY<STRUCT<pattern_id STRING, pattern_name STRING, confidence FLOAT64, matched_conditions ARRAY<STRING>, risk_score FLOAT64, urgency_level STRING, business_impact STRING, recommended_actions ARRAY<STRING>>>' },
        { name: 'top_pattern', type: 'STRING' },
        { name: 'final_risk_score', type: 'INT64' },
        { name: 'final_urgency_level', type: 'STRING' },
        { name: 'final_business_impact', type: 'STRING' },
        { name: 'assigned_segments', type: 'ARRAY<STRING>' },
        { name: 'analysis_timestamp', type: 'TIMESTAMP' }
      ]

      await table.create({ schema })
      console.log('NLP分析結果テーブルを作成しました')
    }

    // データを挿入（シンプルなテーブル用）
    const rows = results.map(result => ({
      message_id: result.message_id,
      thread_id: result.thread_id,
      sender_email: result.sender_email,
      subject: result.subject,
      body: result.body,
      date: result.date,
      nlp_sentiment_score: result.nlp_analysis?.sentiment?.score || 0,
      nlp_sentiment_magnitude: result.nlp_analysis?.sentiment?.magnitude || 0,
      nlp_language: result.nlp_analysis?.syntax?.language || 'unknown',
      pattern_matches_count: result.pattern_matches?.length || 0,
      top_pattern_name: result.top_pattern?.pattern_name || 'none',
      top_pattern_confidence: result.top_pattern?.confidence || 0,
      final_risk_score: result.final_risk_score || 0,
      final_urgency_level: result.final_urgency_level || 'low',
      final_business_impact: result.final_business_impact || 'low',
      assigned_segments_count: result.assigned_segments?.length || 0,
      error_message: result.error?.message || null,
      analysis_timestamp: result.analysis_timestamp
    }))

    console.log('📝 挿入データの型確認:', rows.map(row => ({
      message_id: typeof row.message_id,
      thread_id: typeof row.thread_id,
      pattern_matches_count: typeof row.pattern_matches_count,
      assigned_segments_count: typeof row.assigned_segments_count
    })))
    
    console.log('🔍 最初の行の詳細:', {
      pattern_matches_count: rows[0].pattern_matches_count,
      assigned_segments_count: rows[0].assigned_segments_count,
      top_pattern_name: rows[0].top_pattern_name
    })
    
    await table.insert(rows)
    console.log(`${rows.length}件の分析結果を保存しました`)

  } catch (error) {
    console.error('分析結果の保存エラー:', error)
    throw error
  }
}

// セグメント分布をBigQueryに保存
async function saveSegmentDistributionToBigQuery(segmentStats: any[]) {
  try {
    const dataset = bigquery.dataset('salesguard_alerts')
    const table = dataset.table('segment_distribution')

    // テーブルが存在しない場合は作成
    const [exists] = await table.exists()
    if (!exists) {
      const schema = [
        { name: 'segment_name', type: 'STRING' },
        { name: 'message_count', type: 'INT64' },
        { name: 'avg_risk_score', type: 'INT64' },
        { name: 'max_risk_score', type: 'INT64' },
        { name: 'urgency_distribution', type: 'STRING' },
        { name: 'business_impact_distribution', type: 'STRING' },
        { name: 'messages', type: 'STRING' },
        { name: 'created_at', type: 'TIMESTAMP' }
      ]

      await table.create({ schema })
      console.log('セグメント分布テーブルを作成しました')
    }

    // 既存データを削除
    await table.delete()

    // データを挿入
    const rows = segmentStats.map(stat => ({
      segment_name: stat.segment_name,
      message_count: stat.message_count,
      avg_risk_score: stat.avg_risk_score,
      max_risk_score: stat.max_risk_score,
      urgency_distribution: JSON.stringify(stat.urgency_distribution),
      business_impact_distribution: JSON.stringify(stat.business_impact_distribution),
      messages: JSON.stringify(stat.messages),
      created_at: new Date().toISOString()
    }))

    await table.insert(rows)
    console.log(`${rows.length}件のセグメント分布を保存しました`)

  } catch (error) {
    console.error('セグメント分布の保存エラー:', error)
    throw error
  }
}

// 分析サマリーの計算
function calculateAnalysisSummary(results: any[]) {
  if (results.length === 0) {
    return {
      total_messages: 0,
      risk_score_distribution: {},
      urgency_level_distribution: {},
      business_impact_distribution: {},
      segment_distribution: {},
      top_patterns: []
    }
  }

  // リスクスコア分布
  const riskScoreDistribution = results.reduce((acc, result) => {
    const score = result.final_risk_score
    if (score >= 80) acc['80-100'] = (acc['80-100'] || 0) + 1
    else if (score >= 60) acc['60-79'] = (acc['60-79'] || 0) + 1
    else if (score >= 40) acc['40-59'] = (acc['40-59'] || 0) + 1
    else acc['0-39'] = (acc['0-39'] || 0) + 1
    return acc
  }, {})

  // 緊急度レベル分布
  const urgencyLevelDistribution = results.reduce((acc, result) => {
    const level = result.final_urgency_level
    acc[level] = (acc[level] || 0) + 1
    return acc
  }, {})

  // ビジネスインパクト分布
  const businessImpactDistribution = results.reduce((acc, result) => {
    const impact = result.final_business_impact
    acc[impact] = (acc[impact] || 0) + 1
    return acc
  }, {})

  // セグメント分布
  const segmentDistribution = results.reduce((acc, result) => {
    result.assigned_segments.forEach((segment: string) => {
      acc[segment] = (acc[segment] || 0) + 1
    })
    return acc
  }, {})

  // トップパターン
  const patternCounts: Record<string, number> = {}
  results.forEach(result => {
    if (result.top_pattern) {
      const patternName = result.top_pattern.pattern_name
      patternCounts[patternName] = (patternCounts[patternName] || 0) + 1
    }
  })

  const topPatterns = Object.entries(patternCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  return {
    total_messages: results.length,
    risk_score_distribution: riskScoreDistribution,
    urgency_level_distribution: urgencyLevelDistribution,
    business_impact_distribution: businessImpactDistribution,
    segment_distribution: segmentDistribution,
    top_patterns: topPatterns
  }
} 