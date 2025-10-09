/**
 * 統一されたスコアリングシステム
 * 一覧とモーダルで一貫したスコアと優先度を提供
 */

import { calculateAdvancedScore, KeywordAnalysis, SentimentAnalysis, DEFAULT_WEIGHTS, ScoringWeights } from './advanced-scoring';

export interface UnifiedScoreResult {
  score: number;              // 0-100の統一スコア
  priority: 'critical' | 'high' | 'medium' | 'low';  // 統一優先度
  level: 'A' | 'B' | 'C';    // セバリティレベル
  label: string;              // 表示用ラベル
  color: string;              // 表示用色
  urgency: 'urgent' | 'high' | 'medium' | 'low';  // 緊急度
  category: string;           // カテゴリ
  explanation: string[];      // 説明
  breakdown: {
    keywordScore: number;
    sentimentScore: number;
    synergyScore: number;
    urgencyBoost: number;
  };
}

// 統一された優先度マッピング
export const PRIORITY_MAPPING = {
  critical: { level: 'A' as const, label: 'クリティカル', color: 'bg-red-600 text-white', urgency: 'urgent' as const },
  high: { level: 'B' as const, label: '重要', color: 'bg-orange-600 text-white', urgency: 'high' as const },
  medium: { level: 'C' as const, label: '注意', color: 'bg-yellow-600 text-white', urgency: 'medium' as const },
  low: { level: 'C' as const, label: '健全', color: 'bg-green-600 text-white', urgency: 'low' as const }
};

// スコアから優先度を決定する関数
export function getPriorityFromScore(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

// 統一されたスコア計算
export function calculateUnifiedScore(
  alert: any,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): UnifiedScoreResult {
  const keywords = extractKeywords(alert);

  const keywordAnalysis: KeywordAnalysis[] = keywords.map(keyword => {
    const weight = getKeywordWeight(keyword);
    return {
      keyword,
      weight,
      category: getKeywordCategory(keyword),
      sentiment: getKeywordSentiment(keyword),
      priority: getKeywordPriority(keyword),
      baseScore: weight * 20
    };
  });

  const rawSentimentScore =
    typeof alert.sentiment_score === 'number'
      ? alert.sentiment_score
      : typeof alert.sentimentScore === 'number'
      ? alert.sentimentScore
      : 0;

  const dominantSentiment =
    typeof alert.sentiment_label === 'string'
      ? (alert.sentiment_label as SentimentAnalysis['dominant'])
      : rawSentimentScore < -0.1
      ? 'negative'
      : rawSentimentScore > 0.1
      ? 'positive'
      : 'neutral';

  const sentimentAnalysis: SentimentAnalysis = {
    score: rawSentimentScore,
    magnitude: Math.min(1, Math.abs(rawSentimentScore)),
    dominant: dominantSentiment,
    confidence: 0.8
  };

  const advancedScore = calculateAdvancedScore(keywordAnalysis, sentimentAnalysis, weights);
  const finalScore = advancedScore.finalScore;

  const priority = getPriorityFromScore(finalScore);
  const priorityInfo = PRIORITY_MAPPING[priority];
  const category = determineCategory(keywordAnalysis, sentimentAnalysis);

  const explanationBase = generateUnifiedExplanation(
    keywordAnalysis,
    sentimentAnalysis,
    advancedScore,
    finalScore,
    priority
  );

  const explanation = advancedScore.explanation.length
    ? Array.from(new Set([...advancedScore.explanation, ...explanationBase.slice(-1)]))
    : explanationBase;

  return {
    score: finalScore,
    priority,
    level: priorityInfo.level,
    label: priorityInfo.label,
    color: priorityInfo.color,
    urgency: priorityInfo.urgency,
    category,
    explanation,
    breakdown: {
      keywordScore: advancedScore.keywordScore,
      sentimentScore: advancedScore.sentimentScore,
      synergyScore: advancedScore.synergyScore,
      urgencyBoost: advancedScore.urgencyBoost
    }
  };
}

// シンプルなスコア計算
function calculateSimpleScore(
  keywords: KeywordAnalysis[],
  sentiment: SentimentAnalysis
): number {
  let score = 0;
  
  // 1. キーワードスコア（0-60点）
  if (keywords.length > 0) {
    const keywordScore = keywords.reduce((sum, k) => sum + k.baseScore, 0);
    score += Math.min(60, keywordScore);
  }
  
  // 2. 感情スコア（0-40点）
  if (sentiment.score < 0) {
    // ネガティブ感情は高スコア
    const negativeScore = Math.abs(sentiment.score) * 40;
    score += negativeScore;
  } else if (sentiment.score > 0) {
    // ポジティブ感情は低スコア
    const positiveScore = sentiment.score * 10;
    score += positiveScore;
  }
  
  // 3. 緊急度ブースト
  const urgentKeywords = keywords.filter(k => k.sentiment === 'urgent' || k.priority === 'critical');
  if (urgentKeywords.length > 0) {
    score *= 1.2; // 20%ブースト
  }
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

// キーワード抽出
function extractKeywords(alert: any): string[] {
  const highlightKeywords = alert.highlightKeywords || [];
  const phrases = Array.isArray(alert.phrases) ? alert.phrases : 
                 (typeof alert.phrases === 'string' && alert.phrases) ? 
                 alert.phrases.split(',').map(s => s.trim()).filter(Boolean) : [];
  
  return [...new Set([...highlightKeywords, ...phrases])];
}

// キーワードの重み取得
function getKeywordWeight(keyword: string): number {
  const weights: Record<string, number> = {
    'クレーム': 1.0, '苦情': 1.0, '不満': 1.0,
    '緊急': 1.5, '至急': 1.5, '急ぎ': 1.5,
    'キャンセル': 1.2, '解約': 1.2,
    '高い': 0.8, '料金': 0.8, '価格': 0.8,
    '不良': 1.3, '不具合': 1.3, '故障': 1.3,
    'まだですか': 1.1, '対応して': 1.1, '返事がない': 1.1,
  };
  return weights[keyword] || 1.0;
}

// キーワードのカテゴリ取得
function getKeywordCategory(keyword: string): string {
  const categories: Record<string, string> = {
    'クレーム': 'クレーム・苦情',
    '苦情': 'クレーム・苦情',
    '不満': 'クレーム・苦情',
    '緊急': '緊急対応',
    '至急': '緊急対応',
    '急ぎ': '緊急対応',
    'キャンセル': 'キャンセル・解約',
    '解約': 'キャンセル・解約',
    '高い': '価格・料金',
    '料金': '価格・料金',
    '価格': '価格・料金',
    '不良': '品質・品質問題',
    '不具合': '品質・品質問題',
    '故障': '品質・品質問題',
  };
  return categories[keyword] || 'その他';
}

// キーワードの感情取得
function getKeywordSentiment(keyword: string): 'positive' | 'negative' | 'urgent' | 'neutral' {
  const sentiments: Record<string, 'positive' | 'negative' | 'urgent' | 'neutral'> = {
    'クレーム': 'negative',
    '苦情': 'negative',
    '不満': 'negative',
    '緊急': 'urgent',
    '至急': 'urgent',
    '急ぎ': 'urgent',
    'キャンセル': 'negative',
    '解約': 'negative',
    '高い': 'neutral',
    '料金': 'neutral',
    '価格': 'neutral',
    '不良': 'negative',
    '不具合': 'negative',
    '故障': 'negative',
  };
  return sentiments[keyword] || 'neutral';
}

// キーワードの優先度取得
function getKeywordPriority(keyword: string): 'critical' | 'high' | 'medium' | 'low' {
  const weight = getKeywordWeight(keyword);
  if (weight >= 1.3) return 'critical';
  if (weight >= 1.0) return 'high';
  if (weight >= 0.8) return 'medium';
  return 'low';
}

// カテゴリの決定
function determineCategory(keywordAnalysis: KeywordAnalysis[], sentimentAnalysis: SentimentAnalysis): string {
  if (keywordAnalysis.length === 0) {
    return sentimentAnalysis.score < -0.3 ? '感情分析による検知' : '通常';
  }
  
  // 最も重みの高いキーワードのカテゴリを返す
  const topKeyword = keywordAnalysis.reduce((max, current) => 
    current.weight > max.weight ? current : max
  );
  
  return topKeyword.category;
}

// 統一された説明の生成
function generateUnifiedExplanation(
  keywordAnalysis: KeywordAnalysis[],
  sentimentAnalysis: SentimentAnalysis,
  advancedScore: any,
  unifiedScore: number,
  priority: string
): string[] {
  const explanations: string[] = [];
  
  // キーワードの説明
  if (keywordAnalysis.length > 0) {
    const topKeywords = keywordAnalysis
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(k => k.keyword);
    explanations.push(`キーワード「${topKeywords.join('」「')}」を検知`);
  }
  
  // 感情分析の説明
  if (Math.abs(sentimentAnalysis.score) > 0.1) {
    const sentimentDesc = sentimentAnalysis.score < 0 ? 'ネガティブ' : 'ポジティブ';
    explanations.push(`感情分析で${sentimentDesc}な感情を検知`);
  }
  
  // 相乗効果の説明
  if (advancedScore.synergyScore > 0) {
    explanations.push(`キーワードと感情の相乗効果で+${Math.round(advancedScore.synergyScore)}点`);
  }
  
  // 緊急度の説明
  if (advancedScore.urgencyBoost > 1.0) {
    explanations.push(`緊急度により${Math.round((advancedScore.urgencyBoost - 1) * 100)}%ブースト`);
  }
  
  // 最終判定の説明
  const priorityLabels = {
    critical: 'クリティカル',
    high: '重要',
    medium: '注意',
    low: '健全'
  };
  explanations.push(`総合判定：${priorityLabels[priority as keyof typeof priorityLabels]}レベル`);
  
  return explanations;
}

// レガシー関数との互換性のためのヘルパー
export function getRiskLevel(score: number): { level: string; label: string; color: string } {
  const priority = getPriorityFromScore(score);
  const priorityInfo = PRIORITY_MAPPING[priority];
  
  return {
    level: priorityInfo.level, // toLowerCase()を削除
    label: priorityInfo.label,
    color: priorityInfo.color
  };
}

// スコアの正規化（0-100の範囲に収める）
export function normalizeScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

// 優先度の比較関数
export function comparePriority(a: string, b: string): number {
  const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  return (priorityOrder[b as keyof typeof priorityOrder] || 0) - (priorityOrder[a as keyof typeof priorityOrder] || 0);
}
