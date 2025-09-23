import { NLPAnalysisResult, PatternMatchResult } from './nlp-analyzer-v2'

// 検知パターンの型定義
export interface DetectionPattern {
  id: string
  name: string
  description: string
  category: 'critical' | 'high' | 'medium' | 'low' | 'opportunity'
  keywords: string[]
  nlpConditions: {
    sentiment?: {
      min?: number
      max?: number
      required?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
    }
    magnitude?: {
      min?: number
      max?: number
    }
    entities?: {
      required?: string[]
      excluded?: string[]
    }
    categories?: {
      required?: string[]
      excluded?: string[]
    }
    textLength?: {
      min?: number
      max?: number
    }
    urgency?: {
      indicators: string[]
      required?: number
    }
  }
  riskScore: number
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low'
  businessImpact: 'high' | 'medium' | 'low'
  recommendedActions: string[]
  examples: string[]
  useCase: string
}

// 検知パターンの定義
export const DETECTION_PATTERNS: DetectionPattern[] = [
  {
    id: 'complaint_urgent',
    name: 'クレーム・苦情系',
    description: '顧客からの強い不満や苦情の検出',
    category: 'critical',
    keywords: ['クレーム', '不具合', 'トラブル', 'おかしい', '問題', '故障', 'エラー', '動かない', '困っている', '対応して', '改善して', '修正して'],
    nlpConditions: {
      sentiment: { max: -0.3, required: 'NEGATIVE' },
      magnitude: { min: 1.2 },
      urgency: { indicators: ['緊急', '至急', '早急', 'すぐに', '今すぐ'], required: 1 }
    },
    riskScore: 95,
    urgencyLevel: 'critical',
    businessImpact: 'high',
    recommendedActions: [
      '即座に担当者に連絡',
      '1時間以内に顧客と直接通話',
      '問題の詳細調査',
      '顧客への謝罪',
      '解決策の即座提案',
      '上長への緊急報告'
    ],
    examples: [
      '「●●が動かないのですが。早急に対応願います」',
      '「システムに重大な問題があります」',
      '「サービスが使えなくて困っています」'
    ],
    useCase: '顧客からの強い不満や苦情の検出'
  },
  {
    id: 'follow_up_dissatisfaction',
    name: '催促・未対応の不満',
    description: '対応の遅れや催促への不満の検出',
    category: 'high',
    keywords: ['まだですか', 'いつまで', '対応して', '返事がない', '待っています', '遅い', '早く', '急いで', '催促', '連絡がない', '返信待ち'],
    nlpConditions: {
      sentiment: { max: -0.2, required: 'NEGATIVE' },
      magnitude: { min: 1.0 },
      urgency: { indicators: ['待っています', '催促', '早く'], required: 1 }
    },
    riskScore: 80,
    urgencyLevel: 'high',
    businessImpact: 'medium',
    recommendedActions: [
      '即座に顧客に連絡',
      '対応状況の説明',
      '具体的な対応スケジュール提示',
      '担当者の明確化',
      '定期的な進捗報告'
    ],
    examples: [
      '「まだ対応いただけていないでしょうか」',
      '「いつまでお待ちすればよいでしょうか」',
      '「返事を待っています」'
    ],
    useCase: '対応の遅れや催促への不満の検出'
  },
  {
    id: 'anxiety_passive_tendency',
    name: '不安・消極的傾向',
    description: '顧客の不安感や消極的な態度の検出',
    category: 'medium',
    keywords: ['不安', '心配', '大丈夫でしょうか', '問題ないでしょうか', '確認したい', '検討中', '考え中', '迷っています', '慎重に'],
    nlpConditions: {
      sentiment: { max: 0.1 },
      magnitude: { min: 0.8 },
      entities: { required: ['不安', '心配', '確認'] }
    },
    riskScore: 60,
    urgencyLevel: 'medium',
    businessImpact: 'medium',
    recommendedActions: [
      '不安点の詳細ヒアリング',
      '具体的な説明資料の提供',
      '成功事例の紹介',
      '段階的な導入提案',
      '定期的なフォローアップ'
    ],
    examples: [
      '「本当に大丈夫でしょうか」',
      '「不安な点があります」',
      '「慎重に検討したいと思います」'
    ],
    useCase: '顧客の不安感や消極的な態度の検出'
  },
  {
    id: 'positive_engagement',
    name: '積極的関与',
    description: '顧客の積極的な関与や興味の検出',
    category: 'opportunity',
    keywords: ['興味があります', '詳しく教えて', '導入したい', '検討したい', '進めたい', '良いですね', '素晴らしい', '期待しています'],
    nlpConditions: {
      sentiment: { min: 0.3, required: 'POSITIVE' },
      magnitude: { min: 1.0 },
      entities: { required: ['興味', '導入', '検討'] }
    },
    riskScore: 20,
    urgencyLevel: 'low',
    businessImpact: 'high',
    recommendedActions: [
      '詳細資料の提供',
      'デモンストレーションの提案',
      '導入スケジュールの検討',
      '担当者の紹介',
      '次のステップの提案'
    ],
    examples: [
      '「とても興味があります」',
      '「詳しく教えてください」',
      '「導入を検討したいと思います」'
    ],
    useCase: '顧客の積極的な関与や興味の検出'
  },
  {
    id: 'tone_change_negative',
    name: 'トーン急変（ネガへ）',
    description: '会話のトーンが急激にネガティブに変化',
    category: 'critical',
    keywords: ['しかし', 'でも', '問題は', '気になる点', '懸念', '心配', '不安', '難しい', '厳しい'],
    nlpConditions: {
      sentiment: { max: -0.4, required: 'NEGATIVE' },
      magnitude: { min: 1.5 },
      urgency: { indicators: ['問題', '懸念', '心配'], required: 1 }
    },
    riskScore: 90,
    urgencyLevel: 'critical',
    businessImpact: 'high',
    recommendedActions: [
      '即座に状況確認',
      '顧客の懸念点の詳細把握',
      '解決策の即座提案',
      '上長への報告',
      '緊急会議の開催'
    ],
    examples: [
      '「しかし、いくつか気になる点があります」',
      '「問題は、コストが高すぎることです」',
      '「懸念があります」'
    ],
    useCase: '会話のトーンが急激にネガティブに変化'
  },
  {
    id: 'cancellation_termination',
    name: 'キャンセル・取引終了系',
    description: '取引のキャンセルや終了の意向の検出',
    category: 'critical',
    keywords: ['キャンセル', '解約', '終了', 'やめたい', '見送り', '検討し直し', '他社に', '競合', '解約したい'],
    nlpConditions: {
      sentiment: { max: -0.5, required: 'NEGATIVE' },
      magnitude: { min: 1.3 },
      urgency: { indicators: ['キャンセル', '解約', '終了'], required: 1 }
    },
    riskScore: 100,
    urgencyLevel: 'critical',
    businessImpact: 'high',
    recommendedActions: [
      '即座に顧客と直接通話',
      '解約理由の詳細ヒアリング',
      '代替案の提案',
      '上長への緊急報告',
      '顧客維持のための特別提案'
    ],
    examples: [
      '「契約を解約したいと思います」',
      '「キャンセルをお願いします」',
      '「他社に変更したいと思います」'
    ],
    useCase: '取引のキャンセルや終了の意向の検出'
  },
  {
    id: 'upsell_opportunity',
    name: 'アップセルチャンス',
    description: '追加サービスやアップグレードの機会',
    category: 'opportunity',
    keywords: ['追加', 'アップグレード', '拡張', '機能', 'サービス', 'プラン', '上位プラン', 'より良い', '改善'],
    nlpConditions: {
      sentiment: { min: 0.2 },
      magnitude: { min: 0.8 },
      entities: { required: ['追加', 'アップグレード', '拡張'] }
    },
    riskScore: 15,
    urgencyLevel: 'low',
    businessImpact: 'high',
    recommendedActions: [
      '追加サービスの提案',
      'アップグレードプランの紹介',
      'ROIの説明',
      '段階的な導入提案',
      '特別価格の提示'
    ],
    examples: [
      '「追加の機能はありますか」',
      '「アップグレードを検討したい」',
      '「より良いプランはありますか」'
    ],
    useCase: '追加サービスやアップグレードの機会'
  },
  {
    id: 'cold_rejection_polite',
    name: '冷たい拒絶・塩対応',
    description: '顧客からの冷たい拒絶や塩対応の検出',
    category: 'high',
    keywords: ['検討します', '考えます', '連絡します', '後で', '時間がない', '忙しい', '検討中', '保留'],
    nlpConditions: {
      sentiment: { max: 0.1 },
      magnitude: { min: 0.5 },
      urgency: { indicators: ['検討', '考え', '後で'], required: 2 }
    },
    riskScore: 70,
    urgencyLevel: 'medium',
    businessImpact: 'medium',
    recommendedActions: [
      '価値提案の再構築',
      '顧客の課題の深掘り',
      '成功事例の紹介',
      '段階的なアプローチ',
      '定期的なフォローアップ'
    ],
    examples: [
      '「検討させていただきます」',
      '「時間がないので後で」',
      '「考えておきます」'
    ],
    useCase: '顧客からの冷たい拒絶や塩対応の検出'
  },
  {
    id: 'internal_crisis_report',
    name: '社内向け危機通報',
    description: '社内での危機的な状況の通報',
    category: 'critical',
    keywords: ['緊急', '問題', 'トラブル', '障害', 'エラー', 'システムダウン', 'セキュリティ', 'インシデント', '報告'],
    nlpConditions: {
      sentiment: { max: -0.3, required: 'NEGATIVE' },
      magnitude: { min: 1.5 },
      urgency: { indicators: ['緊急', '問題', 'トラブル'], required: 1 }
    },
    riskScore: 95,
    urgencyLevel: 'critical',
    businessImpact: 'high',
    recommendedActions: [
      '即座に技術チームに連絡',
      '状況の詳細把握',
      '影響範囲の確認',
      '顧客への通知準備',
      '上長への緊急報告'
    ],
    examples: [
      '「システムに緊急の問題が発生しています」',
      '「セキュリティインシデントが発生しました」',
      '「重大な障害が発生しています」'
    ],
    useCase: '社内での危機的な状況の通報'
  },
  {
    id: 'unresponded_important_inquiry',
    name: '未返信重要問い合わせ',
    description: '顧客からの重要な問い合わせで未返信のもの',
    category: 'high',
    keywords: ['問い合わせ', 'お問い合わせ', 'ご質問', '相談', 'お願い', '依頼', '検討', '提案', '見積もり', 'お見積もり', '導入', '導入したい', '興味', '詳しく', '教えて'],
    nlpConditions: {
      sentiment: { min: -0.1, max: 0.5 },
      magnitude: { min: 0.8 },
      urgency: { indicators: ['問い合わせ', '相談', '依頼', '検討'], required: 1 }
    },
    riskScore: 75,
    urgencyLevel: 'high',
    businessImpact: 'high',
    recommendedActions: [
      '24時間以内の返信',
      '担当者の明確化',
      '具体的な回答内容の準備',
      'フォローアップのスケジュール',
      '顧客の期待値の確認'
    ],
    examples: [
      '「サービスについて問い合わせがあります」',
      '「導入を検討したいと思います」',
      '「詳しく教えていただけますか」'
    ],
    useCase: '顧客からの重要な問い合わせで未返信のもの'
  },
  {
    id: 'urgent_business_request',
    name: '緊急業務依頼',
    description: '緊急度の高い業務依頼や対応要求',
    category: 'critical',
    keywords: ['至急', '緊急', '早急', 'すぐに', '今すぐ', '急ぎ', '急いで', '優先', '最優先', '重要', '大切', '大事', '対応', '対応して', '処理', '処理して'],
    nlpConditions: {
      sentiment: { min: -0.2, max: 0.3 },
      magnitude: { min: 1.2 },
      urgency: { indicators: ['至急', '緊急', '早急', 'すぐに', '今すぐ'], required: 1 }
    },
    riskScore: 90,
    urgencyLevel: 'critical',
    businessImpact: 'high',
    recommendedActions: [
      '即座に担当者に連絡',
      '1時間以内の対応',
      '優先度の確認',
      '上長への報告',
      '顧客への対応状況連絡'
    ],
    examples: [
      '「至急対応をお願いします」',
      '「緊急の件でご相談があります」',
      '「早急に処理していただけますか」'
    ],
    useCase: '緊急度の高い業務依頼や対応要求'
  }
]

export class PatternMatcherV2 {
  // パターンマッチングの実行
  static matchPatterns(
    subject: string,
    body: string,
    nlpResult: NLPAnalysisResult | null
  ): PatternMatchResult[] {
    const matches: PatternMatchResult[] = []
    const lowerSubject = subject.toLowerCase()
    const lowerBody = body.toLowerCase()
    const combinedText = `${lowerSubject} ${lowerBody}`

    // nlpResultのnullチェック
    if (!nlpResult) {
      console.warn('⚠️ nlpResultがundefinedです。基本的なキーワードマッチングのみ実行します。')
      // 基本的なキーワードマッチングのみ実行
      for (const pattern of DETECTION_PATTERNS) {
        const matchResult = this.evaluatePatternBasic(pattern, combinedText)
        if (matchResult.confidence > 0.3) {
          matches.push(matchResult)
        }
      }
      return matches.sort((a, b) => b.confidence - a.confidence)
    }

    for (const pattern of DETECTION_PATTERNS) {
      const matchResult = this.evaluatePattern(pattern, combinedText, nlpResult)
      if (matchResult.confidence > 0.3) { // 信頼度30%以上の場合のみ
        matches.push(matchResult)
      }
    }

    // 信頼度順にソート
    return matches.sort((a, b) => b.confidence - a.confidence)
  }

  // 基本的なパターン評価（NLP結果なし）
  private static evaluatePatternBasic(
    pattern: DetectionPattern,
    text: string
  ): PatternMatchResult {
    let confidence = 0
    const matchedConditions: string[] = []

    // キーワードマッチングのみ
    const keywordMatches = pattern.keywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    )
    if (keywordMatches.length > 0) {
      confidence += Math.min(keywordMatches.length * 0.2, 0.6)
      matchedConditions.push(`キーワード: ${keywordMatches.join(', ')}`)
    }

    return {
      pattern_id: pattern.id,
      pattern_name: pattern.name,
      confidence: Math.min(confidence, 1.0),
      matched_conditions: matchedConditions,
      risk_score: pattern.riskScore * confidence,
      urgency_level: confidence > 0.6 ? pattern.urgencyLevel : 'low',
      business_impact: confidence > 0.6 ? pattern.businessImpact : 'low',
      recommended_actions: pattern.recommendedActions
    }
  }

  // 個別パターンの評価
  private static evaluatePattern(
    pattern: DetectionPattern,
    text: string,
    nlpResult: NLPAnalysisResult
  ): PatternMatchResult {
    let confidence = 0
    const matchedConditions: string[] = []

    // キーワードマッチング
    const keywordMatches = pattern.keywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    )
    if (keywordMatches.length > 0) {
      confidence += Math.min(keywordMatches.length * 0.2, 0.6) // 最大60%
      matchedConditions.push(`キーワード: ${keywordMatches.join(', ')}`)
    }

    // NLP条件の評価
    const nlpScore = this.evaluateNLPConditions(pattern.nlpConditions, nlpResult)
    confidence += nlpScore.score * 0.4 // 最大40%
    if (nlpScore.matchedConditions.length > 0) {
      matchedConditions.push(...nlpScore.matchedConditions)
    }

    // リスクスコアの計算
    const riskScore = this.calculateRiskScore(pattern, confidence, nlpResult)
    
    // 緊急度レベルの決定
    const urgencyLevel = this.determineUrgencyLevel(pattern, confidence, nlpResult)
    
    // ビジネスインパクトの評価
    const businessImpact = this.evaluateBusinessImpact(pattern, confidence, nlpResult)
    
    // 推奨アクションの生成
    const recommendedActions = this.generateRecommendedActions(pattern, urgencyLevel, businessImpact)

    return {
      pattern_id: pattern.id,
      pattern_name: pattern.name,
      confidence: Math.min(confidence, 1.0),
      matched_conditions: matchedConditions,
      risk_score: riskScore,
      urgency_level: urgencyLevel,
      business_impact: businessImpact,
      recommended_actions: recommendedActions
    }
  }

  // NLP条件の評価
  private static evaluateNLPConditions(
    conditions: DetectionPattern['nlpConditions'],
    nlpResult: NLPAnalysisResult
  ): { score: number; matchedConditions: string[] } {
    let score = 0
    const matchedConditions: string[] = []

    // 感情分析の評価
    if (conditions.sentiment) {
      const sentiment = conditions.sentiment
      const currentSentiment = nlpResult.sentiment.score
      const currentLabel = nlpResult.sentiment.label

      if (sentiment.required && currentLabel === sentiment.required) {
        score += 0.3
        matchedConditions.push(`感情: ${currentLabel}`)
      } else if (sentiment.min !== undefined && currentSentiment >= sentiment.min) {
        score += 0.2
        matchedConditions.push(`感情スコア: ${currentSentiment.toFixed(2)}`)
      } else if (sentiment.max !== undefined && currentSentiment <= sentiment.max) {
        score += 0.2
        matchedConditions.push(`感情スコア: ${currentSentiment.toFixed(2)}`)
      }
    }

    // 感情の強度の評価
    if (conditions.magnitude) {
      const magnitude = conditions.magnitude
      const currentMagnitude = nlpResult.sentiment.magnitude

      if (magnitude.min !== undefined && currentMagnitude >= magnitude.min) {
        score += 0.2
        matchedConditions.push(`感情強度: ${currentMagnitude.toFixed(2)}`)
      } else if (magnitude.max !== undefined && currentMagnitude <= magnitude.max) {
        score += 0.2
        matchedConditions.push(`感情強度: ${currentMagnitude.toFixed(2)}`)
      }
    }

    // エンティティの評価
    if (conditions.entities) {
      const entities = conditions.entities
      const currentEntities = nlpResult.entities.map(e => e.name.toLowerCase())

      if (entities.required) {
        const requiredMatches = entities.required.filter(req => 
          currentEntities.some(current => current.includes(req.toLowerCase()))
        )
        if (requiredMatches.length > 0) {
          score += 0.2
          matchedConditions.push(`エンティティ: ${requiredMatches.join(', ')}`)
        }
      }

      if (entities.excluded) {
        const excludedMatches = entities.excluded.filter(exc => 
          currentEntities.some(current => current.includes(exc.toLowerCase()))
        )
        if (excludedMatches.length === 0) {
          score += 0.1
        }
      }
    }

    // カテゴリの評価
    if (conditions.categories) {
      const categories = conditions.categories
      const currentCategories = nlpResult.categories.map(c => c.name.toLowerCase())

      if (categories.required) {
        const requiredMatches = categories.required.filter(req => 
          currentCategories.some(current => current.includes(req.toLowerCase()))
        )
        if (requiredMatches.length > 0) {
          score += 0.2
          matchedConditions.push(`カテゴリ: ${requiredMatches.join(', ')}`)
        }
      }
    }

    // テキスト長の評価
    if (conditions.textLength) {
      const textLength = conditions.textLength
      const currentLength = nlpResult.body.length

      if (textLength.min !== undefined && currentLength >= textLength.min) {
        score += 0.1
        matchedConditions.push(`テキスト長: ${currentLength}文字`)
      } else if (textLength.max !== undefined && currentLength <= textLength.max) {
        score += 0.1
        matchedConditions.push(`テキスト長: ${currentLength}文字`)
      }
    }

    // 緊急度指標の評価
    if (conditions.urgency) {
      const urgency = conditions.urgency
      const currentText = nlpResult.body.toLowerCase()
      const urgencyMatches = urgency.indicators.filter(indicator => 
        currentText.includes(indicator.toLowerCase())
      )
      
      if (urgencyMatches.length > 0) {
        const urgencyScore = Math.min(urgencyMatches.length * 0.1, 0.3)
        score += urgencyScore
        matchedConditions.push(`緊急度指標: ${urgencyMatches.join(', ')}`)
      }
    }

    return { score: Math.min(score, 1.0), matchedConditions }
  }

  // リスクスコアの計算
  private static calculateRiskScore(
    pattern: DetectionPattern,
    confidence: number,
    nlpResult: NLPAnalysisResult
  ): number {
    const baseScore = pattern.riskScore
    
    // 信頼度による調整
    const confidenceMultiplier = 0.5 + (confidence * 0.5)
    
    // 感情の強度による調整
    const magnitudeMultiplier = 1.0 + (nlpResult.sentiment.magnitude * 0.2)
    
    // 最終スコアの計算
    const finalScore = baseScore * confidenceMultiplier * magnitudeMultiplier
    
    return Math.min(Math.round(finalScore), 100)
  }

  // 緊急度レベルの決定
  private static determineUrgencyLevel(
    pattern: DetectionPattern,
    confidence: number,
    nlpResult: NLPAnalysisResult
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (confidence >= 0.8 && nlpResult.sentiment.magnitude >= 1.5) {
      return 'critical'
    } else if (confidence >= 0.6 && nlpResult.sentiment.magnitude >= 1.0) {
      return 'high'
    } else if (confidence >= 0.4 && nlpResult.sentiment.magnitude >= 0.5) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  // ビジネスインパクトの評価
  private static evaluateBusinessImpact(
    pattern: DetectionPattern,
    confidence: number,
    nlpResult: NLPAnalysisResult
  ): 'high' | 'medium' | 'low' {
    if (confidence >= 0.7 && pattern.businessImpact === 'high') {
      return 'high'
    } else if (confidence >= 0.5 && pattern.businessImpact === 'medium') {
      return 'medium'
    } else {
      return 'low'
    }
  }

  // 推奨アクションの生成
  private static generateRecommendedActions(
    pattern: DetectionPattern,
    urgencyLevel: string,
    businessImpact: string
  ): string[] {
    const actions = [...pattern.recommendedActions]
    
    // 緊急度に応じたアクションの追加
    if (urgencyLevel === 'critical') {
      actions.unshift('🚨 緊急対応が必要です')
      actions.push('上長への即座の報告')
    } else if (urgencyLevel === 'high') {
      actions.unshift('⚠️ 優先対応が必要です')
    }
    
    // ビジネスインパクトに応じたアクションの追加
    if (businessImpact === 'high') {
      actions.push('顧客との直接通話')
      actions.push('詳細な影響度調査')
    }
    
    return actions.slice(0, 8) // 最大8件まで
  }

  // パターンの取得
  static getPatternsByCategory(category: string): DetectionPattern[] {
    return DETECTION_PATTERNS.filter(pattern => pattern.category === category)
  }

  static getPatternById(id: string): DetectionPattern | undefined {
    return DETECTION_PATTERNS.find(pattern => pattern.id === id)
  }

  static getAllPatterns(): DetectionPattern[] {
    return [...DETECTION_PATTERNS]
  }
} 