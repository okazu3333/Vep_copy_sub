import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

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
    const { text, analysisType = 'all' } = await request.json()
    
    if (!text) {
      return NextResponse.json(
        { success: false, error: 'テキストが提供されていません' },
        { status: 400 }
      )
    }

    console.log(`🔍 拡張キーワード分析開始: ${analysisType}`)
    console.log(`📝 分析対象テキスト: ${text.substring(0, 100)}...`)

    // 感情分析とキーワード検知を実行
    const analysisResult = await performEnhancedAnalysis(text, analysisType)
    
    return NextResponse.json({
      success: true,
      text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      analysis: analysisResult,
      message: '拡張キーワード分析が完了しました'
    })

  } catch (error) {
    console.error('❌ 拡張キーワード分析エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '分析中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function performEnhancedAnalysis(text: string, analysisType: string): Promise<any> {
  const result: any = {
    detected_keywords: [],
    sentiment_analysis: {
      dominant_sentiment: 'neutral',
      confidence: 0,
      scores: { positive: 0, negative: 0, urgent: 0, neutral: 0 }
    },
    priority_analysis: {
      overall_priority: 'low',
      highest_priority: 'low',
      priority_score: 0
    },
    category_breakdown: {},
    statistical_features: {},
    recommendations: []
  }

  // 1. キーワード検知と感情分析
  const keywordResults = detectKeywordsWithSentiment(text)
  result.detected_keywords = keywordResults.detected_keywords
  result.sentiment_analysis = keywordResults.sentiment_analysis
  result.priority_analysis = keywordResults.priority_analysis

  // 2. 統計的特徴の分析
  if (analysisType === 'all' || analysisType === 'statistics') {
    result.statistical_features = analyzeTextStatistics(text)
  }

  // 3. カテゴリ別分析
  result.category_breakdown = analyzeByCategory(keywordResults.detected_keywords)

  // 4. 推奨事項の生成
  result.recommendations = generateRecommendations(result)

  return result
}

function detectKeywordsWithSentiment(text: string): any {
  const detectedKeywords: any[] = []
  const sentimentScores = { positive: 0, negative: 0, urgent: 0, neutral: 0 }
  let totalPriorityScore = 0
  let highestPriority = 'low'

  // 各パターンをチェック
  Object.entries(ENHANCED_KEYWORD_PATTERNS).forEach(([category, pattern]) => {
    const matches = pattern.keywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    )

    if (matches.length > 0) {
      const keywordResult = {
        category: category,
        keywords: matches,
        sentiment: pattern.sentiment,
        priority: pattern.priority,
        score: pattern.score * matches.length,
        category_type: pattern.category
      }

      detectedKeywords.push(keywordResult)

      // 感情スコアを累積
      sentimentScores[pattern.sentiment as keyof typeof sentimentScores] += pattern.score * matches.length
      
      // 優先度スコアを累積
      totalPriorityScore += keywordResult.score
      
      // 最高優先度を更新
      if (getPriorityWeight(pattern.priority) > getPriorityWeight(highestPriority)) {
        highestPriority = pattern.priority
      }
    }
  })

  // 感情分析の結果を計算
  const totalScore = Object.values(sentimentScores).reduce((a, b) => a + b, 0)
  let dominantSentiment = 'neutral'
  let confidence = 0

  if (totalScore > 0) {
    const maxScore = Math.max(...Object.values(sentimentScores))
    dominantSentiment = Object.keys(sentimentScores).find(key => 
      sentimentScores[key as keyof typeof sentimentScores] === maxScore
    ) || 'neutral'
    confidence = maxScore / totalScore
  }

  return {
    detected_keywords: detectedKeywords,
    sentiment_analysis: {
      dominant_sentiment: dominantSentiment,
      confidence: Math.round(confidence * 100) / 100,
      scores: sentimentScores
    },
    priority_analysis: {
      overall_priority: highestPriority,
      highest_priority: highestPriority,
      priority_score: Math.round(totalPriorityScore * 100) / 100
    }
  }
}

function getPriorityWeight(priority: string): number {
  const weights = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 }
  return weights[priority as keyof typeof weights] || 1
}

function analyzeTextStatistics(text: string): any {
  return {
    length: text.length,
    word_count: text.split(/\s+/).length,
    exclamation_count: (text.match(/!/g) || []).length,
    question_count: (text.match(/\?/g) || []).length,
    capital_letter_count: (text.match(/[A-Z]/g) || []).length,
    number_count: (text.match(/\d/g) || []).length,
    url_count: (text.match(/https?:\/\/[^\s]+/g) || []).length,
    email_count: (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).length
  }
}

function analyzeByCategory(detectedKeywords: any[]): any {
  const categoryBreakdown: any = {}
  
  detectedKeywords.forEach(keyword => {
    const category = keyword.category_type
    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = {
        count: 0,
        total_score: 0,
        keywords: []
      }
    }
    
    categoryBreakdown[category].count++
    categoryBreakdown[category].total_score += keyword.score
    categoryBreakdown[category].keywords.push(...keyword.keywords)
  })

  return categoryBreakdown
}

function generateRecommendations(analysisResult: any): string[] {
  const recommendations: string[] = []

  // 感情に基づく推奨事項
  if (analysisResult.sentiment_analysis.dominant_sentiment === 'negative') {
    recommendations.push('ネガティブな感情が検出されました。迅速な対応が推奨されます。')
  }
  
  if (analysisResult.sentiment_analysis.dominant_sentiment === 'urgent') {
    recommendations.push('緊急度が高い内容です。最優先での対応が必要です。')
  }

  // 優先度に基づく推奨事項
  if (analysisResult.priority_analysis.highest_priority === 'critical') {
    recommendations.push('クリティカルな優先度です。即座の対応が必要です。')
  }

  // カテゴリに基づく推奨事項
  if (analysisResult.category_breakdown.customer_service) {
    recommendations.push('カスタマーサービス関連の内容です。専門チームへの引き継ぎを検討してください。')
  }

  if (analysisResult.category_breakdown.business_risk) {
    recommendations.push('ビジネスリスクが含まれています。経営陣への報告を検討してください。')
  }

  return recommendations
}

// GET メソッドで利用可能なパターン一覧を取得
export async function GET() {
  return NextResponse.json({
    success: true,
    available_patterns: Object.keys(ENHANCED_KEYWORD_PATTERNS),
    patterns: ENHANCED_KEYWORD_PATTERNS,
    analysis_types: ['all', 'keywords', 'sentiment', 'statistics'],
    features: {
      sentiment_analysis: true,
      priority_analysis: true,
      category_breakdown: true,
      statistical_features: true,
      recommendations: true
    }
  })
} 