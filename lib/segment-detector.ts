/**
 * セグメント検知ユーティリティ
 * 
 * メールデータからセグメントを自動検知するためのヘルパー関数
 */

import { SegmentClassifier, type DetectionMetrics, type Context } from './segment-classifier';
import type { SegmentKey } from './segments';

/**
 * メールテキストからキーワードを抽出
 */
export function extractKeywords(
  text: string,
  keywordLists: {
    urgency?: string[];
    complaint?: string[];
    inquiry?: string[];
    proposal?: string[];
    reoccurrence?: string[];
  }
): {
  urgency_keywords: string[];
  complaint_keywords: string[];
  inquiry_keywords: string[];
  proposal_keywords: string[];
  reoccurrence_keywords: string[];
} {
  const lowerText = text.toLowerCase();
  
  return {
    urgency_keywords: (keywordLists.urgency || []).filter(kw => 
      lowerText.includes(kw.toLowerCase())
    ),
    complaint_keywords: (keywordLists.complaint || []).filter(kw => 
      lowerText.includes(kw.toLowerCase())
    ),
    inquiry_keywords: (keywordLists.inquiry || []).filter(kw => 
      lowerText.includes(kw.toLowerCase())
    ),
    proposal_keywords: (keywordLists.proposal || []).filter(kw => 
      lowerText.includes(kw.toLowerCase())
    ),
    reoccurrence_keywords: (keywordLists.reoccurrence || []).filter(kw => 
      lowerText.includes(kw.toLowerCase())
    ),
  };
}

/**
 * メールデータからセグメントを検知
 */
export async function detectSegment(
  emailData: {
    subject?: string;
    body?: string;
    sentiment_score?: number;
    direction?: 'inbound' | 'outbound';
    hours_since_last_activity?: number;
    reply_frequency?: number;
    night_reply_rate?: number;
    previous_segment?: SegmentKey;
    status?: 'unhandled' | 'in_progress' | 'completed';
    thread_id?: string;
  }
): Promise<{
  segment: SegmentKey | null;
  confidence: number;
  score: number;
  reason: string;
} | null> {
  const classifier = new SegmentClassifier();
  
  // テキストを結合
  const text = `${emailData.subject || ''} ${emailData.body || ''}`.trim();
  
  // キーワードを抽出
  const keywords = extractKeywords(text, {
    urgency: ['至急', 'いつまで', 'まだですか', '対応して', '返事がない', 'お待ちしています', 'ご確認ください', '急ぎ', '早く', '期限', '締切', '納期'],
    complaint: ['クレーム', '不満', '問題', 'トラブル', '不具合', 'エラー', '悪い', 'ダメ', '失敗'],
    inquiry: ['ROI', '不安', '懸念', '確認', '比較', '競合', '他社', '検討', '選定', 'レビュー', '同席', 'フォロー', '改善', 'ありがとう', '感謝'],
    proposal: ['修正', '変更', '違う', '期待', '要望', '確認不足', '資料', '再共有', '説明不足', '条項', '仕様', '見積', '提案'],
    reoccurrence: ['また', '再度', '再発', '同じ問題', '前回と同じ', '同じ', '繰り返し'],
  });
  
  // メトリクスを構築
  const metrics: DetectionMetrics = {
    sentiment_score: emailData.sentiment_score || 0,
    hours_since_last_activity: emailData.hours_since_last_activity,
    direction: emailData.direction || 'inbound',
    reply_frequency: emailData.reply_frequency,
    night_reply_rate: emailData.night_reply_rate,
    urgency_keywords: keywords.urgency_keywords,
    complaint_keywords: keywords.complaint_keywords,
    inquiry_keywords: keywords.inquiry_keywords,
    proposal_keywords: keywords.proposal_keywords,
    reoccurrence_keywords: keywords.reoccurrence_keywords,
  };
  
  // コンテキストを構築
  const context: Context = {
    previous_segment: emailData.previous_segment,
    status: emailData.status,
    thread_id: emailData.thread_id,
  };
  
  // セグメントを分類
  const result = await classifier.classify(metrics, context);
  
  if (result) {
    return {
      segment: result.segment,
      confidence: result.confidence,
      score: result.score,
      reason: result.reason,
    };
  }
  
  return null;
}

