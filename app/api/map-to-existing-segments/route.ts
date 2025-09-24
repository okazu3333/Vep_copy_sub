import { NextRequest, NextResponse } from 'next/server'

// 既存セグメントシステムとのマッピング定義
const EXISTING_SEGMENT_MAPPING = {
  // 感情分析結果 → 既存セグメントへのマッピング
  'negative': {
    'customer_service': 'complaint-urgent', // クレーム・苦情系
    'business_risk': 'internal-crisis-report', // 社内向け危機通報
    'quality': 'complaint-urgent', // クレーム・苦情系
    'urgent': 'internal-crisis-report' // 社内向け危機通報
  },
  'urgent': {
    'urgent': 'internal-crisis-report', // 社内向け危機通報
    'customer_service': 'complaint-urgent', // クレーム・苦情系
    'business_risk': 'internal-crisis-report' // 社内向け危機通報
  },
  'positive': {
    'sales': 'contract-negotiation', // 契約・商談
    'satisfaction': 'customer-support' // 顧客サポート
  },
  'neutral': {
    'pricing': 'sales-process', // 営業プロセス
    'competition': 'sales-process', // 営業プロセス
    'sales': 'sales-process' // 営業プロセス
  }
}

// 既存セグメントの詳細定義
const EXISTING_SEGMENTS = {
  'complaint-urgent': {
    id: 'complaint-urgent',
    name: 'クレーム・苦情系',
    description: '顧客からの強い不満や苦情の検出',
    color: 'bg-red-100 text-red-800',
    priority: 'high'
  },
  'follow-up-dissatisfaction': {
    id: 'follow-up-dissatisfaction',
    name: '催促・未対応の不満',
    description: '対応の遅れや催促への不満の検出',
    color: 'bg-orange-100 text-orange-800',
    priority: 'medium'
  },
  'internal-crisis-report': {
    id: 'internal-crisis-report',
    name: '社内向け危機通報',
    description: '社内での危機的な状況の通報',
    color: 'bg-indigo-100 text-indigo-800',
    priority: 'high'
  },
  'contract-negotiation': {
    id: 'contract-negotiation',
    name: '契約・商談',
    description: '契約や商談に関するアラート',
    color: 'bg-green-100 text-green-800',
    priority: 'medium'
  },
  'sales-process': {
    id: 'sales-process',
    name: '営業プロセス',
    description: '営業プロセスに関するアラート',
    color: 'bg-blue-100 text-blue-800',
    priority: 'medium'
  },
  'customer-support': {
    id: 'customer-support',
    name: '顧客サポート',
    description: '顧客サポートに関するアラート',
    color: 'bg-purple-100 text-purple-800',
    priority: 'low'
  }
}

export async function POST(request: NextRequest) {
  try {
    const { limit = 50 } = await request.json()
    
    console.log(`🔗 既存セグメントへのマッピング開始: ${limit}件のアラート`)

    // 1. 感情分析結果を取得
    const sentimentResults = await fetchSentimentAnalysis(limit)
    console.log(`📊 感情分析結果取得: ${sentimentResults.length}件`)

    // 2. 既存セグメントへのマッピング
    const mappedResults = await mapToExistingSegments(sentimentResults)
    console.log(`✅ マッピング完了: ${mappedResults.length}件`)

    // 3. 統計情報を計算
    const statistics = calculateMappingStatistics(mappedResults)
    
    return NextResponse.json({
      success: true,
      message: '既存セグメントへのマッピングが完了しました',
      total_alerts: sentimentResults.length,
      mapped_alerts: mappedResults.length,
      statistics: statistics,
      sample_results: mappedResults.slice(0, 5), // 上位5件の結果
      existing_segments: EXISTING_SEGMENTS
    })

  } catch (error) {
    console.error('❌ 既存セグメントマッピングエラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '既存セグメントマッピング中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function fetchSentimentAnalysis(limit: number): Promise<any[]> {
  try {
    // 感情分析APIから結果を取得
    const response = await fetch(`http://localhost:3000/api/simple-sentiment-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ limit })
    })

    if (!response.ok) {
      throw new Error(`感情分析取得エラー: ${response.status}`)
    }

    const data = await response.json()
    return data.sample_results || []
  } catch (error) {
    console.error('感情分析取得エラー:', error)
    throw error
  }
}

async function mapToExistingSegments(sentimentResults: any[]): Promise<any[]> {
  const mappedResults = []

  for (const result of sentimentResults) {
    try {
      // 感情分析結果から既存セグメントを決定
      const existingSegment = determineExistingSegment(result)
      
      const mappedResult = {
        alert_id: result.alert_id,
        thread_id: result.thread_id,
        subject: result.subject,
        // 感情分析結果
        sentiment: result.sentiment,
        priority: result.priority,
        priority_score: result.priority_score,
        detected_categories: result.detected_categories,
        keywords_found: result.keywords_found,
        // 既存セグメントへのマッピング
        existing_segment_id: existingSegment.id,
        existing_segment_name: existingSegment.name,
        existing_segment_description: existingSegment.description,
        existing_segment_color: existingSegment.color,
        existing_segment_priority: existingSegment.priority,
        // マッピング理由
        mapping_confidence: existingSegment.confidence,
        analysis_timestamp: new Date().toISOString()
      }
      
      mappedResults.push(mappedResult)
      
      // 進捗表示
      if (mappedResults.length % 10 === 0) {
        console.log(`📈 マッピング進捗: ${mappedResults.length}/${sentimentResults.length}件完了`)
      }
      
    } catch (error) {
      console.error(`マッピングエラー (ID: ${result.alert_id}):`, error)
      // エラーが発生しても処理を継続
      mappedResults.push({
        alert_id: result.alert_id,
        error: error instanceof Error ? error.message : 'Unknown error',
        analysis_timestamp: new Date().toISOString()
      })
    }
  }

  return mappedResults
}

function determineExistingSegment(result: any): any {
  const sentiment: string = result.sentiment
  const mapping: Record<string, string> = (EXISTING_SEGMENT_MAPPING as any)[sentiment] || {}
  
  // 感情とカテゴリに基づいて既存セグメントを決定
  let bestMatch: any = null
  let highestConfidence = 0
  for (const [category, segmentId] of Object.entries(mapping)) {
    // 英語カテゴリ名を使用
    if (result.detected_categories_english && result.detected_categories_english.includes(category)) {
      const confidence = calculateConfidence(sentiment, category, result.priority_score)
      if (confidence > highestConfidence) {
        highestConfidence = confidence
        const seg = (EXISTING_SEGMENTS as any)[segmentId]
        bestMatch = {
          id: segmentId,
          name: seg.name,
          description: seg.description,
          color: seg.color,
          priority: seg.priority,
          reason: `${sentiment}感情 + ${category}カテゴリ → ${seg.name}`,
          confidence: confidence
        }
      }
    }
  }

  // デフォルトセグメント（マッチしない場合）
  if (!bestMatch) {
    bestMatch = {
      id: 'customer-support',
      name: '顧客サポート',
      description: '顧客サポートに関するアラート',
      color: 'bg-gray-100 text-gray-800',
      priority: 'low',
      reason: 'デフォルトセグメント（感情分析結果とマッチしませんでした）',
      confidence: 0.1
    }
  }

  return bestMatch
}

function calculateConfidence(sentiment: string, category: string, priorityScore: number): number {
  let confidence = 0.5 // ベース信頼度

  // 感情による調整
  if (sentiment === 'urgent') confidence += 0.3
  if (sentiment === 'negative') confidence += 0.2
  if (sentiment === 'positive') confidence += 0.1

  // 優先度スコアによる調整
  if (priorityScore > 8) confidence += 0.2
  if (priorityScore > 5) confidence += 0.1

  // カテゴリによる調整
  if (category === 'urgent') confidence += 0.2
  if (category === 'customer_service') confidence += 0.1

  return Math.min(confidence, 1.0) // 最大1.0
}

function calculateMappingStatistics(mappedResults: any[]): any {
  const stats = {
    total_alerts: mappedResults.length,
    existing_segment_distribution: {} as Record<string, number>,
    mapping_confidence: {
      high: 0,    // 0.8以上
      medium: 0,  // 0.5-0.8
      low: 0      // 0.5未満
    },
    error_count: 0,
    unmapped_count: 0
  }

  mappedResults.forEach(result => {
    if (result.error) {
      stats.error_count++
      return
    }

    // 既存セグメント分布
    const segmentId = result.existing_segment_id as string
    if (!stats.existing_segment_distribution[segmentId]) {
      stats.existing_segment_distribution[segmentId] = 0
    }
    stats.existing_segment_distribution[segmentId]++

    // マッピング信頼度
    const confidence = result.mapping_confidence || 0
    if (confidence >= 0.8) stats.mapping_confidence.high++
    else if (confidence >= 0.5) stats.mapping_confidence.medium++
    else stats.mapping_confidence.low++

    // マッピングされていない件数
    if (result.existing_segment_id === 'customer-support' && confidence < 0.3) {
      stats.unmapped_count++
    }
  })

  return stats
}

// GET メソッドで既存セグメント一覧を取得
export async function GET() {
  return NextResponse.json({
    success: true,
    existing_segments: EXISTING_SEGMENTS,
    segment_mapping: EXISTING_SEGMENT_MAPPING,
    message: '既存セグメントシステムの情報を取得しました'
  })
} 