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
  },
  '催促・未対応': {
    keywords: ['まだですか', 'いつまで', '対応して', '返事がない', '待っています', '遅い', '早く', '急いで', '期限', '締切', '納期', '間に合わない', '遅れる', '遅延', 'お待ち', 'ご連絡', 'ご返事'],
    sentiment: 'negative',
    priority: 'medium',
    score: 1.1,
    category: 'follow_up'
  }
}

// 既存セグメントシステムとのマッピング定義
const EXISTING_SEGMENT_MAPPING = {
  'negative': {
    'customer_service': 'complaint-urgent',
    'business_risk': 'internal-crisis-report',
    'quality': 'complaint-urgent',
    'urgent': 'internal-crisis-report',
    'pricing': 'follow-up-dissatisfaction', // 価格不満 → 催促・未対応の不満
    'competition': 'follow-up-dissatisfaction', // 競合不満 → 催促・未対応の不満
    'follow_up': 'follow-up-dissatisfaction' // 催促・未対応 → 催促・未対応の不満
  },
  'urgent': {
    'urgent': 'internal-crisis-report',
    'customer_service': 'complaint-urgent',
    'business_risk': 'internal-crisis-report'
  },
  'positive': {
    'sales': 'contract-negotiation',
    'satisfaction': 'customer-support'
  },
  'neutral': {
    'pricing': 'sales-process',
    'competition': 'sales-process',
    'sales': 'sales-process',
    'customer_service': 'follow-up-dissatisfaction' // 中立的な顧客サービス → 催促・未対応の不満
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const level = searchParams.get('level') || ''
    
    const offset = (page - 1) * limit

    // 検索条件の構築
    let whereClause = '1=1'
    const params: any[] = []
    
    // 文字化けデータ、配信管理システム関連メール、各種自動メールアドレスを除外
    whereClause += ` AND (
      body NOT LIKE '$B%' AND
      body NOT LIKE '%$B%' AND
      body NOT LIKE '%以下のとおり配信依頼送信完了しました%' AND
      subject NOT LIKE '%配信管理システム配信完了報告%' AND
      \`from\` NOT LIKE '%info@%' AND
      \`from\` NOT LIKE '%noreply@%' AND
      \`from\` NOT LIKE '%support@%' AND
      \`from\` NOT LIKE '%magazine@%'
    )`
    
    if (search) {
      whereClause += ' AND (LOWER(subject) LIKE LOWER(?) OR LOWER(body) LIKE LOWER(?) OR LOWER(\`from\`) LIKE LOWER(?) OR CAST(alert_id AS STRING) = ?)'
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm, search)
    }
    
    if (status && status !== 'all') {
      whereClause += ' AND status = ?'
      params.push(status)
    }
    
    if (level && level !== 'all') {
      whereClause += ' AND priority = ?'
      params.push(level)
    }
    
    // スレッドごとにグループ化されたアラートを取得
    const query = `
      WITH ThreadedAlerts AS (
        SELECT
          thread_id,
          MIN(date) as thread_start_time,
          MAX(date) as thread_last_activity,
          COUNT(*) as message_count,
          COALESCE(
            MAX(CASE WHEN is_root = true THEN alert_id END),
            MAX(alert_id)
          ) as alert_id,
          COALESCE(
            MAX(CASE WHEN is_root = true THEN message_id END),
            MIN(message_id)
          ) as root_message_id,
          COALESCE(
            MAX(CASE WHEN is_root = true THEN subject END),
            MAX(CASE WHEN subject IS NOT NULL AND subject != '' THEN subject END),
            '件名なし'
          ) as root_subject,
          COALESCE(
            MAX(CASE WHEN is_root = true THEN \`from\` END),
            MAX(CASE WHEN \`from\` IS NOT NULL AND \`from\` != '' THEN \`from\` END),
            '送信者不明'
          ) as root_from,
          COALESCE(
            MAX(CASE WHEN is_root = true THEN body END),
            MAX(CASE WHEN body IS NOT NULL AND body != '' THEN body END)
          ) as root_body,
          COALESCE(
            MAX(CASE WHEN \`to\` NOT LIKE '%@cross-m.co.jp%' THEN \`to\` END),
            'customer@example.com'
          ) as customer_email
        FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
        WHERE ${whereClause}
        GROUP BY thread_id
        HAVING thread_id IS NOT NULL
      ),
      ThreadMessages AS (
        SELECT 
          ta.*,
          ARRAY_AGG(
            STRUCT(
              a.message_id,
              COALESCE(a.subject, '件名なし') as message_subject,
              COALESCE(a.\`from\`, '送信者不明') as \`from\`,
              COALESCE(a.\`to\`, '宛先不明') as \`to\`,
              COALESCE(a.body, '本文なし') as body,
              a.date,
              a.reply_level,
              a.is_root,
              a.source_file
            ) ORDER BY a.reply_level ASC, a.date ASC
          ) as messages
        FROM ThreadedAlerts ta
        LEFT JOIN \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\` a ON ta.thread_id = a.thread_id
        GROUP BY ta.thread_id, ta.thread_start_time, ta.thread_last_activity, ta.message_count, 
                 ta.alert_id, ta.root_message_id, ta.root_subject, ta.root_from, ta.root_body, ta.customer_email
      )
      SELECT 
        thread_id,
        CONCAT('ALT-', CAST(alert_id AS STRING)) as id,
        COALESCE(root_subject, '件名なし') as subject,
        root_from as sender,
        'キーワード未設定' as keyword,
        '中' as priority,
        '新規' as status,
        50 as score,
        '営業部' as department,
        customer_email,
        thread_start_time as created_at,
        thread_last_activity as updated_at,
        message_count,
        COALESCE(root_body, '本文なし') as body,
        messages
      FROM ThreadMessages tm
      ORDER BY thread_last_activity DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    // 総件数を取得
    const countQuery = `
      SELECT COUNT(DISTINCT thread_id) as total
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
      WHERE ${whereClause} AND thread_id IS NOT NULL
    `

    const [results, countResults] = await Promise.all([
      bigquery.query({
        query,
        params,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      }),
      bigquery.query({
        query: countQuery,
        params,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
    ])

    const alerts = results[0] || []
    const total = countResults[0]?.[0]?.total || 0
    const totalPages = Math.ceil(total / limit)

    // 各アラートに感情分析とマッピング結果を追加
    const enrichedAlerts = await enrichAlertsWithSentimentMapping(alerts)

    // レスポンスヘッダーにキャッシュ設定を追加
    const headers = {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'CDN-Cache-Control': 'public, max-age=300',
      'Vercel-CDN-Cache-Control': 'public, max-age=300'
    }

    return NextResponse.json({
      success: true,
      alerts: enrichedAlerts,
      pagination: {
        page,
        limit,
        offset,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      searchInfo: search ? { searchTerm: search, resultsCount: enrichedAlerts.length, totalResults: total } : null
    }, { headers })

  } catch (error) {
    console.error('Threaded alerts API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch threaded alerts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// 感情分析を実行する関数
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

// 既存セグメントを決定する関数
function determineExistingSegment(result: any): any {
  const sentiment = result.dominant_sentiment
  const detectedCategoriesEnglish = result.detected_categories_english || []
  
  // 感情とカテゴリに基づいて既存セグメントを決定
  let bestMatch = null
  let highestConfidence = 0

  // 感情別のマッピングルール
  if (EXISTING_SEGMENT_MAPPING[sentiment as keyof typeof EXISTING_SEGMENT_MAPPING]) {
    const mappingRules = EXISTING_SEGMENT_MAPPING[sentiment as keyof typeof EXISTING_SEGMENT_MAPPING]
    for (const [category, segmentId] of Object.entries(mappingRules)) {
      if (detectedCategoriesEnglish.includes(category)) {
        const confidence = calculateConfidence(sentiment, category, result.priority_score)
        if (confidence > highestConfidence) {
          highestConfidence = confidence
          const segment = EXISTING_SEGMENTS[segmentId as keyof typeof EXISTING_SEGMENTS]
          bestMatch = {
            id: segmentId,
            name: segment.name,
            description: segment.description,
            color: segment.color,
            priority: segment.priority,
            reason: `${sentiment}感情 + ${category}カテゴリ → ${segment.name}`,
            confidence: confidence
          }
        }
      }
    }
  }

  // 追加のマッピングルール：特定の組み合わせで「催促・未対応の不満」に分類
  if (!bestMatch || bestMatch.confidence < 0.5) {
    // neutral + customer_service + pricing/competition の組み合わせ
    if (sentiment === 'neutral' && 
        detectedCategoriesEnglish.includes('customer_service') && 
        (detectedCategoriesEnglish.includes('pricing') || detectedCategoriesEnglish.includes('competition'))) {
      const segment = EXISTING_SEGMENTS['follow-up-dissatisfaction']
      bestMatch = {
        id: 'follow-up-dissatisfaction',
        name: segment.name,
        description: segment.description,
        color: segment.color,
        priority: segment.priority,
        reason: `${sentiment}感情 + customer_service + pricing/competition → ${segment.name}`,
        confidence: 0.7
      }
    }
    // negative + pricing/competition の組み合わせ（クレーム・苦情系以外）
    else if (sentiment === 'negative' && 
             (detectedCategoriesEnglish.includes('pricing') || detectedCategoriesEnglish.includes('competition')) &&
             !detectedCategoriesEnglish.includes('customer_service')) {
      const segment = EXISTING_SEGMENTS['follow-up-dissatisfaction']
      bestMatch = {
        id: 'follow-up-dissatisfaction',
        name: segment.name,
        description: segment.description,
        color: segment.color,
        priority: segment.priority,
        reason: `${sentiment}感情 + pricing/competition → ${segment.name}`,
        confidence: 0.8
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

// アラートに感情分析とマッピング結果を追加する関数
async function enrichAlertsWithSentimentMapping(alerts: any[]): Promise<any[]> {
  return alerts.map(alert => {
    try {
      // テキストを結合（件名 + 本文）
      const text = `${alert.subject || ''} ${alert.body || ''}`
      
      // 感情分析を実行
      const analysis = performSentimentAnalysis(text)
      
      // 既存セグメントを決定
      const existingSegment = determineExistingSegment(analysis)
      
      // アラートデータに感情分析とマッピング結果を追加
      return {
        ...alert,
        // 感情分析結果
        sentiment: analysis.dominant_sentiment,
        priority_score: analysis.priority_score,
        detected_categories: analysis.detected_categories,
        detected_categories_english: analysis.detected_categories_english,
        keywords_found: analysis.keywords_found,
        // 既存セグメントマッピング結果
        existing_segment_id: existingSegment.id,
        existing_segment_name: existingSegment.name,
        existing_segment_description: existingSegment.description,
        existing_segment_color: existingSegment.color,
        existing_segment_priority: existingSegment.priority,
        mapping_reason: existingSegment.reason,
        mapping_confidence: existingSegment.confidence,
        // キーワード設定を更新
        keyword: analysis.keywords_found.length > 0 ? analysis.keywords_found.slice(0, 3).join(', ') : 'キーワード未設定',
        // 優先度を感情分析結果で更新
        priority: analysis.highest_priority === 'critical' ? '緊急' :
                 analysis.highest_priority === 'high' ? '高' :
                 analysis.highest_priority === 'medium' ? '中' : '低'
      }
    } catch (error) {
      console.error(`アラート分析エラー (ID: ${alert.id}):`, error)
      // エラーが発生した場合はオリジナルのアラートデータを返す
      return alert
    }
  })
} 