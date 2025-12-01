/**
 * 汎用的なセグメント分類システム
 * 
 * 優先順位ベースの分類 + スコアリングで、メール内容から適切なセグメントを自動判定
 */

import type { SegmentKey, SegmentCategoryKey } from './segments';
import { getSegmentRules } from './segment-rules';

export interface DetectionMetrics {
  // 感情・トーン
  sentiment_score: number;
  sentiment_drop?: number;
  sentiment_trend?: 'up' | 'down' | 'stable';
  
  // 時間軸
  hours_since_last_activity?: number;
  response_time?: number;
  
  // コミュニケーション
  direction: 'inbound' | 'outbound';
  reply_frequency?: number;
  response_ratio?: number;
  night_reply_rate?: number;
  
  // キーワード
  urgency_keywords: string[];
  complaint_keywords: string[];
  inquiry_keywords: string[];
  proposal_keywords: string[];
  reoccurrence_keywords: string[];
  
  // 文脈
  context?: string;
  
  // 行動パターン
  alert_history?: any[];
  reoccurrence_flag?: boolean;
}

export interface Context {
  previous_segment?: SegmentKey;
  status?: 'unhandled' | 'in_progress' | 'completed';
  thread_id?: string;
  [key: string]: any;
}

export interface DetectionCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'contains' | 'regex';
  value: number | string | string[];
  weight: number;
}

export interface SegmentRule {
  segment: SegmentKey;
  category: SegmentCategoryKey;
  priority: number;  // 1-10（1が最優先）
  conditions: DetectionCondition[];
  confidence_threshold: number;  // 0-1
  min_confidence: number;  // 最小信頼度
}

export interface SegmentClassificationResult {
  segment: SegmentKey;
  category: SegmentCategoryKey;
  confidence: number;
  score: number;
  matched_conditions: string[];
  reason: string;
}

/**
 * セグメント優先順位マップ
 * 数値が小さいほど優先順位が高い
 */
const SEGMENT_PRIORITY: Record<SegmentKey, number> = {
  'occurrence': 1,  // 発生（最優先）
  'forecast': 2,    // 予兆
  'follow': 3,      // フォロー
};

/**
 * 汎用的なセグメント分類器
 */
export class SegmentClassifier {
  private rules: SegmentRule[];

  constructor(rules?: SegmentRule[]) {
    // ルールが指定されていない場合は、デフォルトのルールを使用
    this.rules = (rules || getSegmentRules()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * メトリクスとコンテキストからセグメントを分類
   */
  async classify(
    metrics: DetectionMetrics,
    context: Context = {}
  ): Promise<SegmentClassificationResult | null> {
    // 1. すべてのルールを評価
    const candidates: SegmentClassificationResult[] = [];

    for (const rule of this.rules) {
      const result = await this.evaluateRule(rule, metrics, context);
      if (result && result.confidence >= rule.min_confidence) {
        candidates.push(result);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // 2. 優先順位でソート（優先順位が高い = 数値が小さい）
    candidates.sort((a, b) => {
      const priorityA = SEGMENT_PRIORITY[a.segment] || 99;
      const priorityB = SEGMENT_PRIORITY[b.segment] || 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB; // 優先順位が高いものを優先
      }

      // 優先順位が同じ場合は信頼度で判定
      return b.confidence - a.confidence;
    });

    // 3. 最も優先順位が高く、信頼度が閾値以上のものを選択
    const best = candidates[0];
    const rule = this.rules.find(r => r.segment === best.segment);
    
    if (best && rule && best.confidence >= rule.confidence_threshold) {
      return best;
    }

    return null;
  }

  /**
   * ルールを評価して結果を返す
   */
  private async evaluateRule(
    rule: SegmentRule,
    metrics: DetectionMetrics,
    context: Context
  ): Promise<SegmentClassificationResult | null> {
    const matchedConditions: string[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // 各条件を評価
    for (const condition of rule.conditions) {
      const conditionResult = this.evaluateCondition(condition, metrics, context);
      
      if (conditionResult.matched) {
        matchedConditions.push(condition.metric);
        totalScore += conditionResult.score * condition.weight;
        totalWeight += condition.weight;
      }
    }

    // 条件が1つもマッチしない場合は null を返す
    if (matchedConditions.length === 0) {
      return null;
    }

    // 信頼度を計算（マッチした条件の重み付き平均）
    const confidence = totalWeight > 0 ? totalScore / totalWeight : 0;

    // スコアを計算（信頼度 × 100 + 優先順位ボーナス）
    const priorityBonus = (11 - rule.priority) * 5;
    const score = confidence * 100 + priorityBonus;

    return {
      segment: rule.segment,
      category: rule.category,
      confidence: Math.min(confidence, 1.0),
      score: Math.min(score, 100),
      matched_conditions: matchedConditions,
      reason: `${matchedConditions.length}個の条件にマッチ（信頼度: ${(confidence * 100).toFixed(1)}%）`,
    };
  }

  /**
   * 個別の条件を評価
   */
  private evaluateCondition(
    condition: DetectionCondition,
    metrics: DetectionMetrics,
    context: Context
  ): { matched: boolean; score: number } {
    const metricValue = this.getMetricValue(condition.metric, metrics, context);

    if (metricValue === null || metricValue === undefined) {
      return { matched: false, score: 0 };
    }

    let matched = false;
    let score = 0;

    switch (condition.operator) {
      case 'gt':
        matched = typeof metricValue === 'number' && metricValue > (condition.value as number);
        score = matched ? 1.0 : 0;
        break;

      case 'gte':
        matched = typeof metricValue === 'number' && metricValue >= (condition.value as number);
        score = matched ? 1.0 : 0;
        break;

      case 'lt':
        matched = typeof metricValue === 'number' && metricValue < (condition.value as number);
        score = matched ? 1.0 : 0;
        break;

      case 'lte':
        matched = typeof metricValue === 'number' && metricValue <= (condition.value as number);
        score = matched ? 1.0 : 0;
        break;

      case 'eq':
        matched = metricValue === condition.value;
        score = matched ? 1.0 : 0;
        break;

      case 'contains':
        if (Array.isArray(condition.value)) {
          const keywordArray = condition.value as string[];
          if (Array.isArray(metricValue)) {
            matched = keywordArray.some(keyword => 
              (metricValue as string[]).some(mv => 
                typeof mv === 'string' && mv.toLowerCase().includes(keyword.toLowerCase())
              )
            );
          } else if (typeof metricValue === 'string') {
            matched = keywordArray.some(keyword => 
              metricValue.toLowerCase().includes(keyword.toLowerCase())
            );
          }
          score = matched ? 1.0 : 0;
        }
        break;

      case 'regex':
        if (typeof metricValue === 'string' && typeof condition.value === 'string') {
          const regex = new RegExp(condition.value, 'i');
          matched = regex.test(metricValue);
          score = matched ? 1.0 : 0;
        }
        break;
    }

    return { matched, score };
  }

  /**
   * メトリクスから値を取得
   */
  private getMetricValue(
    metric: string,
    metrics: DetectionMetrics,
    context: Context
  ): any {
    const metricMap: Record<string, any> = {
      sentiment_score: metrics.sentiment_score,
      sentiment_drop: metrics.sentiment_drop,
      sentiment_trend: metrics.sentiment_trend,
      hours_since_last_activity: metrics.hours_since_last_activity,
      response_time: metrics.response_time,
      direction: metrics.direction,
      reply_frequency: metrics.reply_frequency,
      response_ratio: metrics.response_ratio,
      night_reply_rate: metrics.night_reply_rate,
      urgency_keywords: metrics.urgency_keywords,
      complaint_keywords: metrics.complaint_keywords,
      inquiry_keywords: metrics.inquiry_keywords,
      proposal_keywords: metrics.proposal_keywords,
      reoccurrence_keywords: metrics.reoccurrence_keywords,
      context: metrics.context || context.context,
      alert_history: metrics.alert_history,
      reoccurrence_flag: metrics.reoccurrence_flag,
    };

    return metricMap[metric];
  }

  /**
   * セグメントの優先順位を取得
   */
  static getPriority(segment: SegmentKey): number {
    return SEGMENT_PRIORITY[segment] || 99;
  }
}

