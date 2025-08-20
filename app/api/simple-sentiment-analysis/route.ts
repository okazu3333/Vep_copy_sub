import { NextRequest, NextResponse } from 'next/server'

// 拡張キーワードパターン（感情分析付き）
const ENHANCED_KEYWORD_PATTERNS = {
  'クレーム・苦情': {
    keywords: ['クレーム', '苦情', '不満', '問題', 'トラブル', '困った', '困っています', '改善', '対応', '解決', '謝罪', '申し訳', 'すみません', 'ご迷惑'],
    sentiment: 'negative',
    priority: 'high',
    score: 1.0,
    category: 'customer_service'
  },
  '緊急対応': {
    keywords: ['緊急', '至急', '急ぎ', '早急', 'すぐ', '今すぐ', '即座', '即時', '期限', '締切', '納期', '間に合わない', '遅れる', '遅延'],
    sentiment: 'urgent',
    priority: 'critical',
    score: 1.5,
    category: 'urgent'
  },
  'キャンセル・解約': {
    keywords: ['キャンセル', '解約', '中止', '停止', '終了', '破棄', '取り消し', 'やめたい', 'やめる', '辞退', '断る', 'お断り'],
    sentiment: 'negative',
    priority: 'high',
    score: 1.2,
    category: 'business_risk'
  },
  '価格・料金': {
    keywords: ['高い', '高額', '料金', '価格', '費用', 'コスト', '予算', '割引', '値引き', '安く', '安価', '無料', 'タダ'],
    sentiment: 'neutral',
    priority: 'medium',
    score: 0.8,
    category: 'pricing'
  },
  '品質・品質問題': {
    keywords: ['品質', '質', '悪い', '粗悪', '不良', '不具合', '故障', 'エラー', 'バグ', '問題', '欠陥', '劣化'],
    sentiment: 'negative',
    priority: 'high',
    score: 1.3,
    category: 'quality'
  },
  '競合・他社': {
    keywords: ['他社', '競合', 'ライバル', '比較', '検討', '見積もり', '相見積もり', '他社の方が', '他社なら'],
    sentiment: 'neutral',
    priority: 'medium',
    score: 0.9,
    category: 'competition'
  },
  '営業・提案': {
    keywords: ['提案', '営業', '商談', '打ち合わせ', 'ミーティング', 'プレゼン', 'デモ', '見積もり', '契約', '導入'],
    sentiment: 'positive',
    priority: 'medium',
    score: 0.7,
    category: 'sales'
  },
  '感謝・満足': {
    keywords: ['ありがとう', '感謝', '素晴らしい', '良い', '優秀', '完璧', '満足', '喜び', '嬉しい', '楽しい', '期待', '希望', '成功', '達成', '完了'],
    sentiment: 'positive',
    priority: 'low',
    score: 0.5,
    category: 'satisfaction'
  }
}

export async function POST(request: NextRequest) {
  try {
    const { limit = 10 } = await request.json()
    
    console.log(`🔍 シンプル感情分析開始: ${limit}件のアラートを分析`)

    // 1. 既存のアラートデータを取得
    const alerts = await fetchAlerts(limit)
    console.log(`📊 取得したアラート数: ${alerts.length}件`)

    // 2. 各アラートに感情分析を適用
    const analysisResults = await analyzeAlerts(alerts)
    console.log(`✅ 感情分析完了: ${analysisResults.length}件`)

    // 3. 統計情報を計算
    const statistics = calculateStatistics(analysisResults)
    
    return NextResponse.json({
      success: true,
      message: 'シンプル感情分析が完了しました',
      total_alerts: alerts.length,
      analyzed_alerts: analysisResults.length,
      statistics: statistics,
      sample_results: analysisResults.slice(0, 5) // 上位5件の結果
    })

  } catch (error) {
    console.error('❌ シンプル感情分析エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '感情分析適用中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function fetchAlerts(limit: number): Promise<any[]> {
  try {
    // 既存のアラートデータを取得
    const response = await fetch(`http://localhost:3000/api/alerts-threaded?page=1&limit=${limit}`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('admin-user:your-secure-password').toString('base64')
      }
    })

    if (!response.ok) {
      throw new Error(`アラート取得エラー: ${response.status}`)
    }

    const data = await response.json()
    return data.alerts || []
  } catch (error) {
    console.error('アラート取得エラー:', error)
    throw error
  }
}

async function analyzeAlerts(alerts: any[]): Promise<any[]> {
  const results = []

  for (const alert of alerts) {
    try {
      // テキストを結合（件名 + 本文）
      const text = `${alert.subject || ''} ${alert.body || ''}`
      
      // 感情分析を実行
      const analysis = performSentimentAnalysis(text)
      
      // 結果を統合
      const result = {
        alert_id: alert.id,
        thread_id: alert.thread_id,
        subject: alert.subject?.substring(0, 100) + '...',
        sentiment: analysis.dominant_sentiment,
        priority: analysis.highest_priority,
        priority_score: analysis.priority_score,
        detected_categories: analysis.detected_categories,
        detected_categories_english: analysis.detected_categories_english,
        keywords_found: analysis.keywords_found,
        analysis_timestamp: new Date().toISOString()
      }
      
      results.push(result)
      
      // 進捗表示
      if (results.length % 5 === 0) {
        console.log(`📈 分析進捗: ${results.length}/${alerts.length}件完了`)
      }
      
    } catch (error) {
      console.error(`アラート分析エラー (ID: ${alert.id}):`, error)
      // エラーが発生しても処理を継続
      results.push({
        alert_id: alert.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        analysis_timestamp: new Date().toISOString()
      })
    }
  }

  return results
}

function performSentimentAnalysis(text: string): any {
  const detectedCategories: string[] = []
  const keywordsFound: string[] = []
  const sentimentScores: { [key: string]: number } = { positive: 0, negative: 0, urgent: 0, neutral: 0 }
  let totalPriorityScore = 0
  let highestPriority = 'low'

  // 各パターンをチェック
  Object.entries(ENHANCED_KEYWORD_PATTERNS).forEach(([category, pattern]) => {
    const matches = pattern.keywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    )

    if (matches.length > 0) {
      detectedCategories.push(category)
      keywordsFound.push(...matches)

      // 感情スコアを累積
      sentimentScores[pattern.sentiment] += pattern.score * matches.length
      
      // 優先度スコアを累積
      totalPriorityScore += pattern.score * matches.length
      
      // 最高優先度を更新
      if (getPriorityWeight(pattern.priority) > getPriorityWeight(highestPriority)) {
        highestPriority = pattern.priority
      }
    }
  })

  // 感情分析の結果を計算
  const totalScore = Object.values(sentimentScores).reduce((a, b) => a + b, 0)
  let dominantSentiment = 'neutral'

  if (totalScore > 0) {
    const maxScore = Math.max(...Object.values(sentimentScores))
    dominantSentiment = Object.keys(sentimentScores).find(key => 
      sentimentScores[key] === maxScore
    ) || 'neutral'
  }

  // 英語カテゴリ名を生成
  const detectedCategoriesEnglish = detectedCategories.map(category => {
    const categoryMapping: { [key: string]: string } = {
      'クレーム・苦情': 'customer_service',
      '緊急対応': 'urgent',
      'キャンセル・解約': 'business_risk',
      '価格・料金': 'pricing',
      '品質・品質問題': 'quality',
      '競合・他社': 'competition',
      '営業・提案': 'sales',
      '感謝・満足': 'satisfaction'
    }
    return categoryMapping[category] || category
  })

  return {
    dominant_sentiment: dominantSentiment,
    highest_priority: highestPriority,
    priority_score: Math.round(totalPriorityScore * 100) / 100,
    detected_categories: detectedCategories,
    detected_categories_english: detectedCategoriesEnglish,
    keywords_found: keywordsFound
  }
}

function getPriorityWeight(priority: string): number {
  const weights: { [key: string]: number } = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 }
  return weights[priority] || 1
}

function calculateStatistics(analysisResults: any[]): any {
  const stats = {
    total_alerts: analysisResults.length,
    sentiment_distribution: { positive: 0, negative: 0, urgent: 0, neutral: 0 },
    priority_distribution: { low: 0, medium: 0, high: 0, critical: 0 },
    category_count: 0,
    average_priority_score: 0,
    total_priority_score: 0,
    error_count: 0
  }

  analysisResults.forEach(result => {
    if (result.error) {
      stats.error_count++
      return
    }

    // 感情分布
    if (result.sentiment) {
      stats.sentiment_distribution[result.sentiment]++
    }

    // 優先度分布
    if (result.priority) {
      stats.priority_distribution[result.priority]++
    }

    // 優先度スコア
    if (result.priority_score) {
      stats.total_priority_score += result.priority_score
    }

    // カテゴリ数
    if (result.detected_categories) {
      stats.category_count += result.detected_categories.length
    }
  })

  // 平均スコアを計算
  const validResults = analysisResults.filter(r => !r.error)
  if (validResults.length > 0) {
    stats.average_priority_score = Math.round(stats.total_priority_score / validResults.length * 100) / 100
  }

  return stats
}

// GET メソッドで統計情報を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    console.log(`📊 シンプル感情分析統計情報取得: ${limit}件`)

    // アラートデータを取得して分析
    const alerts = await fetchAlerts(limit)
    const analysisResults = await analyzeAlerts(alerts)
    const statistics = calculateStatistics(analysisResults)

    return NextResponse.json({
      success: true,
      statistics: statistics,
      total_alerts: alerts.length,
      analyzed_alerts: analysisResults.length
    })

  } catch (error) {
    console.error('❌ 統計情報取得エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '統計情報取得中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 