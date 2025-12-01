/**
 * セグメント検知ルール定義
 * 
 * 各セグメントの検知条件を定義します。
 * 新しいセグメントを追加する際は、このファイルにルールを追加するだけで自動的に検知されます。
 */

import type { SegmentKey, SegmentCategoryKey } from './segments';
import type { SegmentRule } from './segment-classifier';

/**
 * セグメント検知ルール定義
 * 
 * セグメントを3つ（予兆、発生、フォロー）に統合
 * 各セグメント内で、検知指標（メトリクス）で分類
 * 
 * 優先順位: 1が最優先（数値が小さいほど優先）
 * - 発生: 1（最優先）
 * - 予兆: 2
 * - フォロー: 3
 */
export const SEGMENT_RULES: SegmentRule[] = [
  // ==================== 発生セグメント ====================
  // 催促、不満、沈黙、提案差異、再発などを統合
  {
    segment: 'occurrence',
    category: 'occurrence',
    priority: 1,
    conditions: [
      // 不満・クレーム
      {
        metric: 'complaint_keywords',
        operator: 'contains',
        value: ['クレーム', '不満', '問題', 'トラブル', '不具合', 'エラー', '悪い', 'ダメ', '失敗'],
        weight: 0.3,
      },
      // 催促・遅延
      {
        metric: 'urgency_keywords',
        operator: 'contains',
        value: ['至急', 'いつまで', 'まだですか', '対応して', '返事がない', 'お待ちしています', 'ご確認ください', '急ぎ', '早く', '期限', '締切', '納期'],
        weight: 0.3,
      },
      // 提案差異
      {
        metric: 'proposal_keywords',
        operator: 'contains',
        value: ['修正', '変更', '違う', '期待', '要望', '確認不足', '資料', '再共有', '説明不足', '条項', '仕様', '見積', '提案'],
        weight: 0.2,
      },
      // 再発
      {
        metric: 'reoccurrence_keywords',
        operator: 'contains',
        value: ['また', '再度', '再発', '同じ問題', '前回と同じ', '同じ', '繰り返し'],
        weight: 0.1,
      },
      // 感情スコア（発生の指標）
      {
        metric: 'sentiment_score',
        operator: 'lt',
        value: -0.3,
        weight: 0.1,
      },
    ],
    confidence_threshold: 0.6,
    min_confidence: 0.5,
  },

  // ==================== 予兆セグメント ====================
  // トーンダウン、不安・不信感、放置、対応品質などを統合
  {
    segment: 'forecast',
    category: 'forecast',
    priority: 2,
    conditions: [
      // 放置予兆（72時間以上未返信）
      {
        metric: 'hours_since_last_activity',
        operator: 'gte',
        value: 72,
        weight: 0.3,
      },
      // トーンダウン（感情スコア低下）
      {
        metric: 'sentiment_drop',
        operator: 'lt',
        value: -0.2,
        weight: 0.2,
      },
      // 返信頻度低下
      {
        metric: 'reply_frequency',
        operator: 'lt',
        value: 0.5,
        weight: 0.2,
      },
      // 不安・不信感キーワード
      {
        metric: 'inquiry_keywords',
        operator: 'contains',
        value: ['ROI', '不安', '懸念', '確認', '比較', '競合', '他社', '検討', '選定'],
        weight: 0.2,
      },
      // 夜間対応率上昇
      {
        metric: 'night_reply_rate',
        operator: 'gte',
        value: 0.5,
        weight: 0.1,
      },
    ],
    confidence_threshold: 0.6,
    min_confidence: 0.5,
  },

  // ==================== フォローセグメント ====================
  {
    segment: 'follow',
    category: 'follow',
    priority: 3,
    conditions: [
      // ポジティブな感情スコア
      {
        metric: 'sentiment_score',
        operator: 'gt',
        value: 0,
        weight: 0.5,
      },
      // フォローキーワード
      {
        metric: 'inquiry_keywords',
        operator: 'contains',
        value: ['レビュー', '確認', '同席', 'フォロー', '改善', 'ありがとう', '感謝'],
        weight: 0.5,
      },
    ],
    confidence_threshold: 0.6,
    min_confidence: 0.5,
  },
];

/**
 * セグメントルールを取得
 */
export function getSegmentRules(): SegmentRule[] {
  return SEGMENT_RULES;
}

/**
 * 特定のセグメントのルールを取得
 */
export function getSegmentRule(segment: SegmentKey): SegmentRule | undefined {
  return SEGMENT_RULES.find(rule => rule.segment === segment);
}

/**
 * カテゴリ別のルールを取得
 */
export function getSegmentRulesByCategory(category: SegmentCategoryKey): SegmentRule[] {
  return SEGMENT_RULES.filter(rule => rule.category === category);
}

