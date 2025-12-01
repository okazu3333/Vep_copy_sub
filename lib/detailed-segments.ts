/**
 * 詳細セグメント判定ロジック
 * 
 * 統合された3つのセグメント（forecast, occurrence, follow）から、
 * 詳細なセグメント（催促、遅延、不満など）を判定する
 */

import type { Alert } from '@/types';

export type DetailedSegmentKey =
  | 'tone_down'           // トーンダウン
  | 'trust_risk'          // 不安・不信感
  | 'inactive'            // 放置予兆
  | 'response_quality'    // 対応時間/品質
  | 'followup'            // 催促・遅延
  | 'complaint'           // 不満
  | 'silence'             // 沈黙
  | 'proposal_issue'      // 提案差異・情報共有不足
  | 'reoccurrence'        // 再発
  | 'recovery';           // 回復確認

export interface DetailedSegmentMeta {
  key: DetailedSegmentKey;
  label: string;
  badgeClass: string;
}

export const DETAILED_SEGMENT_META: Record<DetailedSegmentKey, DetailedSegmentMeta> = {
  tone_down: {
    key: 'tone_down',
    label: 'トーンダウン',
    badgeClass: 'bg-violet-100 text-violet-700 border border-violet-200',
  },
  trust_risk: {
    key: 'trust_risk',
    label: '不安・不信感',
    badgeClass: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  inactive: {
    key: 'inactive',
    label: '放置予兆',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
  },
  response_quality: {
    key: 'response_quality',
    label: '対応時間/品質',
    badgeClass: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  followup: {
    key: 'followup',
    label: '催促・遅延',
    badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  complaint: {
    key: 'complaint',
    label: '不満',
    badgeClass: 'bg-red-100 text-red-700 border border-red-200',
  },
  silence: {
    key: 'silence',
    label: '沈黙',
    badgeClass: 'bg-slate-200 text-slate-800 border border-slate-300',
  },
  proposal_issue: {
    key: 'proposal_issue',
    label: '提案差異・情報共有不足',
    badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  reoccurrence: {
    key: 'reoccurrence',
    label: '再発',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200',
  },
  recovery: {
    key: 'recovery',
    label: '回復確認',
    badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
};

/**
 * アラートから詳細セグメントを判定
 */
export function detectDetailedSegment(alert: Alert): DetailedSegmentMeta | null {
  const text = `${alert.subject || ''} ${alert.ai_summary || ''} ${(alert.phrases || []).join(' ')}`.toLowerCase();
  const keywords = alert.highlightKeywords || [];
  const detectionReasons = alert.detectionReasons || [];
  const detectionRule = (alert as any).detectionRule;

  // 発生セグメントの場合
  if (alert.primarySegment === 'occurrence') {
    // 不満・クレーム（優先度: 最高）- 明確なクレームシグナル
    if (
      text.includes('クレーム') ||
      text.includes('不満') ||
      text.includes('問題') ||
      text.includes('トラブル') ||
      text.includes('不具合') ||
      text.includes('エラー') ||
      text.includes('障害') ||
      text.includes('故障') ||
      keywords.some(kw => ['クレーム', '不満', '問題', 'トラブル', '不具合', 'エラー', '障害', '故障'].includes(kw)) ||
      detectionReasons.some(reason => reason.includes('クレーム') || reason.includes('不満') || reason.includes('問題'))
    ) {
      return DETAILED_SEGMENT_META.complaint;
    }

    // 催促・遅延（優先度: 高）- 明確な催促シグナル
    if (
      text.includes('至急') ||
      text.includes('いつまで') ||
      text.includes('まだですか') ||
      text.includes('対応して') ||
      text.includes('返事がない') ||
      text.includes('お待ちしています') ||
      text.includes('ご確認ください') ||
      text.includes('急ぎ') ||
      text.includes('早く') ||
      text.includes('期限') ||
      text.includes('締切') ||
      text.includes('納期') ||
      text.includes('催促') ||
      text.includes('遅延') ||
      text.includes('72時間') ||
      text.includes('未返信') ||
      keywords.some(kw => ['至急', 'いつまで', 'まだですか', '対応して', '返事がない', '催促', '遅延', '期限', '締切'].includes(kw)) ||
      detectionRule?.rule_type === 'sentiment_urgency' ||
      detectionRule?.rule_type === 'inactivity_72h' ||
      detectionReasons.some(reason => reason.includes('催促') || reason.includes('遅延') || reason.includes('72時間'))
    ) {
      return DETAILED_SEGMENT_META.followup;
    }

    // 提案差異・情報共有不足（優先度: 中）
    if (
      text.includes('修正') ||
      text.includes('変更') ||
      text.includes('違う') ||
      text.includes('期待') ||
      text.includes('要望') ||
      text.includes('確認不足') ||
      text.includes('資料') ||
      text.includes('再共有') ||
      text.includes('説明不足') ||
      text.includes('条項') ||
      text.includes('仕様') ||
      text.includes('見積') ||
      text.includes('提案') ||
      text.includes('契約') ||
      keywords.some(kw => ['修正', '変更', '違う', '期待', '要望', '確認不足', '資料', '再共有', '説明不足', '条項', '見積', '提案'].includes(kw)) ||
      detectionReasons.some(reason => reason.includes('修正') || reason.includes('変更') || reason.includes('説明不足'))
    ) {
      return DETAILED_SEGMENT_META.proposal_issue;
    }

    // 再発（優先度: 中）
    if (
      text.includes('また') ||
      text.includes('再度') ||
      text.includes('再発') ||
      text.includes('同じ問題') ||
      text.includes('前回と同じ') ||
      text.includes('同じ') ||
      text.includes('繰り返し') ||
      keywords.some(kw => ['また', '再度', '再発', '同じ問題', '前回と同じ', '繰り返し'].includes(kw)) ||
      detectionReasons.some(reason => reason.includes('再発') || reason.includes('再度') || reason.includes('同じ'))
    ) {
      return DETAILED_SEGMENT_META.reoccurrence;
    }

    // 沈黙（デフォルト）- 返信が途絶えている状態
    return DETAILED_SEGMENT_META.silence;
  }

  // 予兆セグメントの場合
  if (alert.primarySegment === 'forecast') {
    // 不安・不信感（優先度: 高）- ROI、競合比較などの明確な不安シグナル
    if (
      text.includes('ROI') ||
      text.includes('競合比較') ||
      text.includes('競合') ||
      text.includes('他社') ||
      text.includes('選定') ||
      text.includes('稟議') ||
      keywords.some(kw => ['ROI', '競合', '他社', '選定', '稟議'].includes(kw)) ||
      detectionReasons.some(reason => reason.includes('競合') || reason.includes('ROI') || reason.includes('不安'))
    ) {
      return DETAILED_SEGMENT_META.trust_risk;
    }

    // 対応時間/品質（優先度: 中）- 夜間対応、品質低下など
    if (
      text.includes('夜間') ||
      text.includes('休日') ||
      text.includes('対応時間') ||
      text.includes('品質') ||
      text.includes('深夜') ||
      detectionRule?.rule_type === 'night_reply_rate' ||
      detectionRule?.rule_type === 'tone_frequency_drop' ||
      detectionRule?.rule_type === 'topic_repetition_tone_drop'
    ) {
      return DETAILED_SEGMENT_META.response_quality;
    }

    // 放置予兆（優先度: 低）- 顧客からの問い合わせに未返信の特定ケース
    if (
      detectionRule?.rule_type === 'forecast_inactive' ||
      (detectionRule?.rule_type === 'inactivity_72h' && 
       (text.includes('問い合わせ') || 
        text.includes('未返信') || 
        text.includes('返信していない') ||
        detectionReasons.some(reason => reason.includes('問い合わせ') || reason.includes('未返信')))) ||
      (text.includes('未返信') && text.includes('問い合わせ')) ||
      (text.includes('返信していない') && text.includes('問い合わせ')) ||
      (text.includes('放置') && (text.includes('問い合わせ') || text.includes('返信')))
    ) {
      return DETAILED_SEGMENT_META.inactive;
    }

    // 不安・不信感（広義）- 不安、懸念、確認などの一般的な不安シグナル
    if (
      text.includes('不安') ||
      text.includes('懸念') ||
      text.includes('確認') ||
      text.includes('比較') ||
      text.includes('検討') ||
      keywords.some(kw => ['不安', '懸念', '確認', '比較', '検討'].includes(kw))
    ) {
      return DETAILED_SEGMENT_META.trust_risk;
    }

    // トーンダウン（デフォルト）- 反応が薄い、温度感が下がっているなど
    return DETAILED_SEGMENT_META.tone_down;
  }

  // フォローセグメントの場合
  if (alert.primarySegment === 'follow') {
    // 回復確認（デフォルト）- フォローアップメール、状況確認など
    // フォローセグメントは基本的に回復確認のみ
    // 将来的に「改善確認」「最終確認」などのサブセグメントを追加する場合はここで判定
    return DETAILED_SEGMENT_META.recovery;
  }

  return null;
}
