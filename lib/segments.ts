export type SegmentCategoryKey = 'forecast' | 'occurrence' | 'follow';

// セグメントを3つに統合
export type SegmentKey = 'forecast' | 'occurrence' | 'follow';

type SegmentMeta = {
  key: SegmentKey;
  label: string;
  description: string;
  detectionLabel: string;
  actionLabel: string;
  category: {
    key: SegmentCategoryKey;
    label: string;
  };
  badgeClass: string;
  accentClass: string;
};

export const SEGMENT_META: Record<SegmentKey, SegmentMeta> = {
  forecast: {
    key: 'forecast',
    label: '予兆',
    description: 'リスクの予兆が検知された状態。トーンダウン、不安・不信感、放置、対応品質などの兆候',
    detectionLabel: '感情スコア低下／未返信時間増加／返信頻度低下／夜間対応率上昇／キーワード検知',
    actionLabel: '早期対応でリスクを回避。背景ヒアリングと前向きな提案で温度感を回復',
    category: { key: 'forecast', label: '予兆' },
    badgeClass: 'bg-violet-100 text-violet-700 border border-violet-200',
    accentClass: 'text-violet-700 bg-violet-50',
  },
  occurrence: {
    key: 'occurrence',
    label: '発生',
    description: '問題が発生している状態。催促・遅延、不満、沈黙、提案差異、再発など',
    detectionLabel: '催促キーワード／クレームキーワード／返信停止／提案修正要求／再発ワード',
    actionLabel: '即時対応で信頼低下を防ぐ。状況共有と具体的な改善案を提示',
    category: { key: 'occurrence', label: '発生' },
    badgeClass: 'bg-red-100 text-red-700 border border-red-200',
    accentClass: 'text-red-700 bg-red-50',
  },
  follow: {
    key: 'follow',
    label: 'フォロー',
    description: '施策後の改善状況を確認し、最終フォローが必要な状態',
    detectionLabel: 'レビュー依頼／同席要望／改善確認',
    actionLabel: '改善確認と次の成功プランを共有',
    category: { key: 'follow', label: 'フォロー' },
    badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    accentClass: 'text-emerald-700 bg-emerald-50',
  },
};

export const SEGMENT_GROUP_ORDER: SegmentCategoryKey[] = [
  'forecast',
  'occurrence',
  'follow',
];

export const SEGMENT_ORDER: SegmentKey[] = [
  'forecast',
  'occurrence',
  'follow',
];

export const getSegmentMeta = (key?: SegmentKey | null) =>
  key ? SEGMENT_META[key] : undefined;
