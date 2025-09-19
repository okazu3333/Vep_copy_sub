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
    const start = searchParams.get('start') || ''
    const end = searchParams.get('end') || ''
    const includeMessagesParam = (searchParams.get('include_messages') || 'false').toLowerCase()
    const includeMessages = includeMessagesParam !== 'false' && includeMessagesParam !== '0'
    
    const offset = (page - 1) * limit

    // 検索条件の構築（フルクエリ: threaded view 用）
    let whereClause = '1=1'
    const params: any[] = []
    
    // 軽量クエリ: scored テーブル用の別 where/params
    let whereClauseScored = '1=1'
    const paramsScored: any[] = []
    
    // 文字化け・自動メール除外は threaded view 側にのみ適用
    whereClause += ` AND (
      body_preview NOT LIKE '$B%' AND
      body_preview NOT LIKE '%$B%' AND
      body_preview NOT LIKE '%以下のとおり配信依頼送信完了しました%' AND
      subject NOT LIKE '%配信管理システム配信完了報告%' AND
      from_email NOT LIKE '%info@%' AND
      from_email NOT LIKE '%noreply@%' AND
      from_email NOT LIKE '%support@%' AND
      from_email NOT LIKE '%magazine@%'
    )`

    if (search) {
      // threaded view
      whereClause += ' AND (LOWER(subject) LIKE LOWER(?) OR LOWER(body_preview) LIKE LOWER(?) OR LOWER(from_email) LIKE LOWER(?))'
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm)
      // scored table
      whereClauseScored += ' AND (LOWER(description) LIKE LOWER(?) OR LOWER(messageBody) LIKE LOWER(?) OR LOWER(person) LIKE LOWER(?))'
      paramsScored.push(searchTerm, searchTerm, searchTerm)
    }

    if (start) {
      // threaded view uses `date` TIMESTAMP
      whereClause += ' AND date >= TIMESTAMP(?)'
      params.push(start)
      // scored table uses `datetime` TIMESTAMP
      whereClauseScored += ' AND datetime >= TIMESTAMP(?)'
      paramsScored.push(start)
    }

    if (end) {
      whereClause += ' AND date < TIMESTAMP(?)'
      params.push(end)
      whereClauseScored += ' AND datetime < TIMESTAMP(?)'
      paramsScored.push(end)
    }
    
    // status/level は後段のエンリッチ結果でフィルタする
    
    // クエリ本体（軽量モードと通常モードを切替）
    const slimQuery = `
      WITH Candidates AS (
        SELECT
          thread_id,
          MAX(datetime) AS thread_last_activity
        FROM \`viewpers.salesguard_alerts.alerts_v2_scored\`
        WHERE ${whereClauseScored} AND thread_id IS NOT NULL
        GROUP BY thread_id
      ),
      TopThreads AS (
        SELECT thread_id, thread_last_activity
        FROM Candidates
        ORDER BY thread_last_activity DESC
        LIMIT ${limit} OFFSET ${offset}
      ),
      Threaded AS (
        SELECT
          s.thread_id,
          MIN(s.datetime) AS thread_start_time,
          MAX(s.datetime) AS thread_last_activity,
          COUNT(*) AS message_count,
          ANY_VALUE(s.id) AS any_id,
          ANY_VALUE(s.message_id) AS any_message_id,
          ANY_VALUE(s.status) AS any_status,
          ANY_VALUE(CASE s.level WHEN 'high' THEN '高' WHEN 'medium' THEN '中' ELSE '低' END) AS any_priority,
          ANY_VALUE(s.score) AS any_score,
          ANY_VALUE(s.keyword) AS any_keyword,
          ANY_VALUE(s.department) AS any_department,
          ANY_VALUE(s.customer_email) AS any_customer_email,
          ANY_VALUE(s.person) AS any_person,
          ANY_VALUE(s.description) AS any_subject,
          ANY_VALUE(s.messageBody) AS any_body,
          ANY_VALUE(s.source_file) AS any_source_file
        FROM \`viewpers.salesguard_alerts.alerts_v2_scored\` s
        JOIN TopThreads t USING (thread_id)
        GROUP BY s.thread_id
      )
      SELECT
        ROW_NUMBER() OVER() AS id,
        thread_id,
        any_message_id AS message_id,
        any_status AS status,
        any_priority AS priority,
        any_score AS score,
        any_keyword AS keyword,
        any_department AS department,
        any_customer_email AS customer_email,
        any_person AS sender,
        thread_last_activity AS date,
        any_subject AS subject,
        any_body AS body,
        any_source_file AS source_file,
        message_count,
        thread_start_time,
        thread_last_activity,
        thread_start_time AS created_at,
        thread_last_activity AS updated_at
      FROM Threaded
      ORDER BY thread_last_activity DESC
    `

    const fullQuery = `
      WITH Candidates AS (
        SELECT
          thread_id,
          MAX(date) AS thread_last_activity
        FROM \`viewpers.salesguard_alerts.email_messages_threaded_v1\`
        WHERE ${whereClause}
        GROUP BY thread_id
      ),
      TopThreads AS (
        SELECT thread_id, thread_last_activity
        FROM Candidates
        ORDER BY thread_last_activity DESC
        LIMIT ${limit} OFFSET ${offset}
      ),
      Threaded AS (
        SELECT
          m.thread_id,
          MIN(m.date) AS thread_start_time,
          MAX(m.date) AS thread_last_activity,
          COUNT(*) AS message_count,
          MAX(IF(m.is_root, m.message_id, NULL)) AS root_message_id,
          COALESCE(
            MAX(IF(m.is_root AND m.subject IS NOT NULL AND m.subject != '', m.subject, NULL)),
            MAX(IF(m.subject IS NOT NULL AND m.subject != '', m.subject, NULL)),
            '件名なし'
          ) AS root_subject,
          COALESCE(
            MAX(IF(m.is_root AND m.body_preview IS NOT NULL AND m.body_preview != '', m.body_preview, NULL)),
            MAX(IF(m.body_preview IS NOT NULL AND m.body_preview != '', m.body_preview, NULL)),
            '本文なし'
          ) AS root_body,
          ANY_VALUE(m.from_email) AS customer_email
        FROM \`viewpers.salesguard_alerts.email_messages_threaded_v1\` m
        JOIN TopThreads t USING (thread_id)
        GROUP BY m.thread_id
      ),
      ThreadMessages AS (
        SELECT
          t.thread_id,
          t.thread_start_time,
          t.thread_last_activity,
          t.message_count,
          t.root_message_id,
          t.root_subject,
          t.root_body,
          t.customer_email,
          ARRAY_AGG(STRUCT(
            m.message_id AS message_id,
            m.subject AS subject,
            m.from_email AS sender,
            ARRAY_TO_STRING(m.to_emails, ', ') AS recipient,
            m.body_preview AS body,
            m.date AS date,
            m.reply_level AS reply_level,
            m.is_root AS is_root,
            m.body_gcs_uri AS source_file
          ) ORDER BY m.reply_level ASC, m.date ASC) AS messages
        FROM Threaded t
        JOIN \`viewpers.salesguard_alerts.email_messages_threaded_v1\` m USING (thread_id)
        GROUP BY t.thread_id, t.thread_start_time, t.thread_last_activity, t.message_count,
                 t.root_message_id, t.root_subject, t.root_body, t.customer_email
      )
      SELECT 
        thread_id,
        COALESCE(root_message_id, (SELECT m.message_id FROM UNNEST(messages) AS m LIMIT 1)) AS id,
        COALESCE(root_subject, '件名なし') AS subject,
        (SELECT m.sender FROM UNNEST(messages) AS m LIMIT 1) AS sender,
        'キーワード未設定' AS keyword,
        '中' AS priority,
        '新規' AS status,
        50 AS score,
        '営業部' AS department,
        customer_email,
        thread_start_time AS created_at,
        thread_last_activity AS updated_at,
        message_count,
        COALESCE(root_body, '本文なし') AS body,
        messages
      FROM ThreadMessages tm
      ORDER BY thread_last_activity DESC
    `

    const query = includeMessages ? fullQuery : slimQuery

    // 総件数を取得（alerts_v2_scored ベースに合わせる）
    const countQuery = `
      SELECT COUNT(DISTINCT thread_id) AS total
      FROM \`viewpers.salesguard_alerts.alerts_v2_scored\`
      WHERE ${whereClauseScored} AND thread_id IS NOT NULL
    `

    const [results, countResults] = await Promise.all([
      bigquery.query({
        query,
        params: includeMessages ? params : paramsScored,
        useLegacySql: false,
        maximumBytesBilled: '20000000000'
      }),
      bigquery.query({
        query: countQuery,
        params: paramsScored,
        useLegacySql: false,
        maximumBytesBilled: '20000000000'
      })
    ])

    let alerts = results[0] || []
    const total = countResults[0]?.[0]?.total || 0
    const totalPages = Math.ceil(total / limit)

    if (!includeMessages) {
      alerts = alerts.map((a: any) => ({ ...a, messages: [] }))
    }

    const enrichedAlerts = await enrichAlertsWithSentimentMapping(alerts)

    const filteredAlerts = enrichedAlerts.filter((a: any) => {
      const statusOk = !status || status === 'all' || a.status === status
      const levelOk = !level || level === 'all' || a.priority === level
      return statusOk && levelOk
    })

    const headers = {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'CDN-Cache-Control': 'public, max-age=300',
      'Vercel-CDN-Cache-Control': 'public, max-age=300'
    }

    return NextResponse.json({
      success: true,
      alerts: filteredAlerts,
      pagination: {
        page,
        limit,
        offset,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      searchInfo: search ? { searchTerm: search, resultsCount: filteredAlerts.length, totalResults: total } : null
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