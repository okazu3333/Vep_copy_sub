/**
 * 高度なスコアリングシステム
 * キーワードと感情スコアの重み付けを最適化
 */

export interface ScoringWeights {
  keywordWeight: number;      // キーワードの重み (0.0-1.0)
  sentimentWeight: number;    // 感情スコアの重み (0.0-1.0)
  synergyMultiplier: number;  // 相乗効果の倍率 (1.0-2.0)
  urgencyBoost: number;       // 緊急度によるブースト (1.0-1.5)
}

export interface KeywordAnalysis {
  keyword: string;
  weight: number;
  category: string;
  sentiment: 'positive' | 'negative' | 'urgent' | 'neutral';
  priority: 'critical' | 'high' | 'medium' | 'low';
  baseScore: number;
}

export interface SentimentAnalysis {
  score: number;              // -1.0 to 1.0
  magnitude: number;          // 0.0 to 1.0
  dominant: 'positive' | 'negative' | 'urgent' | 'neutral';
  confidence: number;         // 0.0 to 1.0
}

export interface AdvancedScoreResult {
  finalScore: number;         // 0-100
  keywordScore: number;       // キーワードによるスコア
  sentimentScore: number;     // 感情によるスコア
  synergyScore: number;       // 相乗効果によるスコア
  urgencyBoost: number;       // 緊急度ブースト
  breakdown: {
    keywords: KeywordAnalysis[];
    sentiment: SentimentAnalysis;
    weights: ScoringWeights;
  };
  explanation: string[];      // スコアの説明
}

// デフォルトの重み付け設定
export const DEFAULT_WEIGHTS: ScoringWeights = {
  keywordWeight: 0.6,         // キーワード60%
  sentimentWeight: 0.4,       // 感情40%
  synergyMultiplier: 1.3,     // 相乗効果30%増
  urgencyBoost: 1.2           // 緊急度20%増
};

// キーワードカテゴリの重み付け
export const CATEGORY_WEIGHTS: Record<string, number> = {
  'クレーム・苦情': 1.2,
  '緊急対応': 1.5,
  'キャンセル・解約': 1.3,
  '価格・料金': 0.8,
  '品質・品質問題': 1.4,
  '競合・他社': 0.9,
  '営業・提案': 0.7,
  '感謝・満足': 0.3
};

// 感情タイプの重み付け
export const SENTIMENT_WEIGHTS: Record<string, number> = {
  'urgent': 1.5,
  'negative': 1.2,
  'neutral': 0.8,
  'positive': 0.5
};

/**
 * 高度なスコア計算
 */
export function calculateAdvancedScore(
  keywords: KeywordAnalysis[],
  sentiment: SentimentAnalysis,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): AdvancedScoreResult {
  
  // 1. キーワードスコアの計算
  const keywordScore = calculateKeywordScore(keywords, weights);
  
  // 2. 感情スコアの計算
  const sentimentScore = calculateSentimentScore(sentiment, weights);
  
  // 3. 相乗効果の計算
  const synergyScore = calculateSynergyScore(keywords, sentiment, weights);
  
  // 4. 緊急度ブーストの計算
  const urgencyBoost = calculateUrgencyBoost(keywords, sentiment);
  
  // 5. 最終スコアの計算
  const baseScore = (keywordScore * weights.keywordWeight) + 
                   (sentimentScore * weights.sentimentWeight);
  
  const finalScore = Math.min(100, Math.max(0, 
    (baseScore + synergyScore) * urgencyBoost
  ));
  
  // 6. 説明の生成
  const explanation = generateExplanation(
    keywords, sentiment, keywordScore, sentimentScore, 
    synergyScore, urgencyBoost, finalScore
  );
  
  return {
    finalScore: Math.round(finalScore),
    keywordScore: Math.round(keywordScore),
    sentimentScore: Math.round(sentimentScore),
    synergyScore: Math.round(synergyScore),
    urgencyBoost: Math.round(urgencyBoost * 100) / 100,
    breakdown: {
      keywords,
      sentiment,
      weights
    },
    explanation
  };
}

/**
 * キーワードスコアの計算
 */
function calculateKeywordScore(
  keywords: KeywordAnalysis[], 
  weights: ScoringWeights
): number {
  if (keywords.length === 0) return 0;
  
  let totalScore = 0;
  let maxCategoryWeight = 0;
  
  keywords.forEach(keyword => {
    const categoryWeight = CATEGORY_WEIGHTS[keyword.category] || 1.0;
    const sentimentWeight = SENTIMENT_WEIGHTS[keyword.sentiment] || 1.0;
    const priorityWeight = getPriorityWeight(keyword.priority);
    
    const keywordScore = keyword.baseScore * categoryWeight * sentimentWeight * priorityWeight;
    totalScore += keywordScore;
    maxCategoryWeight = Math.max(maxCategoryWeight, categoryWeight);
  });
  
  // カテゴリの多様性ボーナス
  const uniqueCategories = new Set(keywords.map(k => k.category)).size;
  const diversityBonus = Math.min(0.2, uniqueCategories * 0.05);
  
  return Math.min(100, totalScore * (1 + diversityBonus));
}

/**
 * 感情スコアの計算
 */
function calculateSentimentScore(
  sentiment: SentimentAnalysis, 
  weights: ScoringWeights
): number {
  if (sentiment.score === 0) return 50; // 中性
  
  const sentimentWeight = SENTIMENT_WEIGHTS[sentiment.dominant] || 1.0;
  const magnitudeMultiplier = 0.5 + (sentiment.magnitude * 0.5);
  const confidenceMultiplier = 0.7 + (sentiment.confidence * 0.3);
  
  // ネガティブ感情は高スコア、ポジティブ感情は低スコア
  const baseScore = sentiment.score < 0 ? 
    Math.abs(sentiment.score) * 100 : 
    (1 - sentiment.score) * 50;
  
  return Math.min(100, 
    baseScore * sentimentWeight * magnitudeMultiplier * confidenceMultiplier
  );
}

/**
 * 相乗効果スコアの計算
 */
function calculateSynergyScore(
  keywords: KeywordAnalysis[],
  sentiment: SentimentAnalysis,
  weights: ScoringWeights
): number {
  if (keywords.length === 0 || sentiment.score === 0) return 0;
  
  // キーワードと感情の方向性が一致している場合の相乗効果
  const hasNegativeKeywords = keywords.some(k => 
    k.sentiment === 'negative' || k.sentiment === 'urgent'
  );
  const isNegativeSentiment = sentiment.score < -0.1;
  
  if (hasNegativeKeywords && isNegativeSentiment) {
    const keywordIntensity = keywords.reduce((sum, k) => sum + k.baseScore, 0);
    const sentimentIntensity = Math.abs(sentiment.score) * sentiment.magnitude;
    return (keywordIntensity * sentimentIntensity * 10) * (weights.synergyMultiplier - 1);
  }
  
  return 0;
}

/**
 * 緊急度ブーストの計算
 */
function calculateUrgencyBoost(
  keywords: KeywordAnalysis[],
  sentiment: SentimentAnalysis
): number {
  let boost = 1.0;
  
  // 緊急キーワードの存在
  const urgentKeywords = keywords.filter(k => k.priority === 'critical' || k.sentiment === 'urgent');
  if (urgentKeywords.length > 0) {
    boost += 0.2;
  }
  
  // 強いネガティブ感情
  if (sentiment.score < -0.5 && sentiment.magnitude > 0.7) {
    boost += 0.15;
  }
  
  // 複数の高優先度キーワード
  const highPriorityKeywords = keywords.filter(k => k.priority === 'high' || k.priority === 'critical');
  if (highPriorityKeywords.length >= 2) {
    boost += 0.1;
  }
  
  return Math.min(1.5, boost);
}

/**
 * 優先度の重み付け
 */
function getPriorityWeight(priority: string): number {
  const weights = {
    'critical': 2.0,
    'high': 1.5,
    'medium': 1.0,
    'low': 0.7
  };
  return weights[priority as keyof typeof weights] || 1.0;
}

/**
 * 説明の生成
 */
function generateExplanation(
  keywords: KeywordAnalysis[],
  sentiment: SentimentAnalysis,
  keywordScore: number,
  sentimentScore: number,
  synergyScore: number,
  urgencyBoost: number,
  finalScore: number
): string[] {
  const explanations: string[] = [];
  
  // キーワードの説明
  if (keywords.length > 0) {
    const topKeywords = keywords
      .sort((a, b) => b.baseScore - a.baseScore)
      .slice(0, 3)
      .map(k => k.keyword);
    explanations.push(`キーワード「${topKeywords.join('」「')}」により${Math.round(keywordScore)}点`);
  }
  
  // 感情の説明
  if (Math.abs(sentiment.score) > 0.1) {
    const sentimentDesc = sentiment.score < 0 ? 'ネガティブ' : 'ポジティブ';
    explanations.push(`感情分析（${sentimentDesc}）により${Math.round(sentimentScore)}点`);
  }
  
  // 相乗効果の説明
  if (synergyScore > 0) {
    explanations.push(`キーワードと感情の相乗効果で+${Math.round(synergyScore)}点`);
  }
  
  // 緊急度ブーストの説明
  if (urgencyBoost > 1.0) {
    explanations.push(`緊急度により${Math.round((urgencyBoost - 1) * 100)}%ブースト`);
  }
  
  return explanations;
}

/**
 * 重み付けの調整機能
 */
export function adjustWeights(
  currentWeights: ScoringWeights,
  adjustment: Partial<ScoringWeights>
): ScoringWeights {
  return {
    ...currentWeights,
    ...adjustment,
    keywordWeight: Math.max(0, Math.min(1, adjustment.keywordWeight ?? currentWeights.keywordWeight)),
    sentimentWeight: Math.max(0, Math.min(1, adjustment.sentimentWeight ?? currentWeights.sentimentWeight)),
    synergyMultiplier: Math.max(1, Math.min(2, adjustment.synergyMultiplier ?? currentWeights.synergyMultiplier)),
    urgencyBoost: Math.max(1, Math.min(1.5, adjustment.urgencyBoost ?? currentWeights.urgencyBoost))
  };
}

/**
 * 重み付けのバリデーション
 */
export function validateWeights(weights: ScoringWeights): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (weights.keywordWeight + weights.sentimentWeight !== 1.0) {
    errors.push('キーワードと感情の重みの合計は1.0である必要があります');
  }
  
  if (weights.keywordWeight < 0 || weights.keywordWeight > 1) {
    errors.push('キーワードの重みは0.0-1.0の範囲である必要があります');
  }
  
  if (weights.sentimentWeight < 0 || weights.sentimentWeight > 1) {
    errors.push('感情の重みは0.0-1.0の範囲である必要があります');
  }
  
  if (weights.synergyMultiplier < 1 || weights.synergyMultiplier > 2) {
    errors.push('相乗効果の倍率は1.0-2.0の範囲である必要があります');
  }
  
  if (weights.urgencyBoost < 1 || weights.urgencyBoost > 1.5) {
    errors.push('緊急度ブーストは1.0-1.5の範囲である必要があります');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
