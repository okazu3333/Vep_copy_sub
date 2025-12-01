import { Alert } from '@/types';
import { getSegmentMeta, SegmentKey } from '@/lib/segments';

export type AlertCategoryKey = 'forecast' | 'occurrence' | 'follow';

export interface AlertCategoryMeta {
  key: AlertCategoryKey;
  label: string;
  description: string;
  badgeClass: string;
  summaryClass: string;
}

const TROUBLE_KEYWORDS = ['障害', 'トラブル', '緊急', '停止', 'エスカ', '重大', 'SLA', '恒久', '恒常', '期限超過', 'クリティカル'];

export const ALERT_CATEGORY_CONFIG: Record<AlertCategoryKey, Omit<AlertCategoryMeta, 'key'> & { summaryAccent: string }> =
  {
    forecast: {
      label: '予兆',
      description: '感情変化や関心低下など、兆しの段階で手を打ちたい領域',
      badgeClass: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
      summaryClass: 'border border-indigo-200 bg-indigo-50 text-indigo-800',
      summaryAccent: 'bg-indigo-500',
    },
    occurrence: {
      label: '発生',
      description: '催促や不満など、顧客側で事象が顕在化している案件',
      badgeClass: 'bg-red-100 text-red-700 border border-red-200',
      summaryClass: 'border border-red-200 bg-red-50 text-red-800',
      summaryAccent: 'bg-red-500',
    },
    follow: {
      label: 'フォロー',
      description: '施策後の回復状況を確認し、抜け漏れを防ぎたい案件',
      badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      summaryClass: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
      summaryAccent: 'bg-emerald-500',
    },
  };

const troubleRegex = new RegExp(TROUBLE_KEYWORDS.join('|'));

export const deriveAlertCategoryKey = (alert: Alert): AlertCategoryKey => {
  const segment = alert.primarySegment as SegmentKey | null | undefined;
  const segmentMeta = getSegmentMeta(segment ?? undefined);
  if (segmentMeta) {
    return segmentMeta.category.key as AlertCategoryKey;
  }

  const severity = alert.severity;
  const detectionScore =
    typeof alert.detection_score === 'number'
      ? alert.detection_score
      : typeof alert.urgencyScore === 'number'
      ? alert.urgencyScore
      : 0;

  const reasonText = [
    alert.subject,
    alert.ai_summary,
    ...(alert.detectionReasons ?? []),
    ...(alert.highlightKeywords ?? []),
  ]
    .filter(Boolean)
    .join(' ');

  if (severity === 'A' || detectionScore >= 70 || troubleRegex.test(reasonText)) {
    return 'occurrence';
  }

  return severity === 'B' ? 'occurrence' : 'forecast';
};

export const getAlertCategoryMeta = (alert: Alert): AlertCategoryMeta => {
  const key = deriveAlertCategoryKey(alert);
  const config = ALERT_CATEGORY_CONFIG[key];
  return {
    key,
    label: config.label,
    description: config.description,
    badgeClass: config.badgeClass,
    summaryClass: config.summaryClass,
  };
};
