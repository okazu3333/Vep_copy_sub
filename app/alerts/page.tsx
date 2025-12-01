'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertDetail } from '@/components/alerts/AlertDetail';
import { AlertCard } from '@/components/alerts/AlertCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, EmailThread } from '@/types';
import { RawEvent } from '@/lib/detection/models';
import { buildFollowUpBody } from '@/lib/follow-template';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Brain, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { FilterBar, AlertsFilters } from '@/components/ui/FilterBar';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
// import { DetectionReasons } from '@/components/ui/DetectionReasons'; // 一覧表示では不使用
import { INTERNAL_EMAIL_DOMAINS } from '@/lib/constants/internal-domains';
import { calculateUnifiedScore } from '@/lib/unified-scoring';
import { cn } from '@/lib/utils';
import {
  SEGMENT_META,
  SEGMENT_GROUP_ORDER,
  SEGMENT_ORDER,
  getSegmentMeta,
  type SegmentKey,
} from '@/lib/segments';
import { DUMMY_ALERTS, DUMMY_ALERTS_BY_OWNER, DUMMY_SEGMENT_COUNTS } from '@/data/mock/dummyAlerts';
import { ALERT_CATEGORY_CONFIG, AlertCategoryKey, deriveAlertCategoryKey } from '@/lib/alert-categories';
import { formatOwnerLabel, UNASSIGNED_OWNER_LABEL } from '@/lib/owner-labels';
import { personalizeAlertsForOwner } from '@/lib/alert-personalization';
// detectDetailedSegment is only used in AlertCard component, not in this page

interface ThreadMessage {
  message_key?: string | null;
  message_id?: string | null;
  reply_level?: number | string | null;
  date?: string | null;
  created_at?: string | null;
  from?: string | null;
  sender?: string | null;
  to?: string | null;
  recipient?: string | null;
  subject?: string | null;
  body?: string | null;
  in_reply_to?: string | null;
}

// レガシー関数は削除（unified-scoringからインポート）

// Backend allows up to 10000 records per request when light mode is enabled
const LIMIT_PER_REQUEST = 10000;
const USE_DUMMY_DATA = process.env.NEXT_PUBLIC_USE_DUMMY_ALERTS !== '0';
const USE_DB_ALERTS = process.env.NEXT_PUBLIC_USE_DB_ALERTS === '1';
const CARD_ITEMS_PER_PAGE = 8;
const COMPACT_ITEMS_PER_PAGE = 20;
const GENERIC_FOLLOW_BODY = buildFollowUpBody();
const SALES_DEFAULT_DEPARTMENT = 'エンタープライズ営業部';

const ensureSalesContext = (alert: Alert): Alert => {
  const department =
    alert.department && alert.department.includes('営業')
      ? alert.department
      : SALES_DEFAULT_DEPARTMENT;
  const assignee = alert.assignee || 'sales@cross-m.co.jp';
  return { ...alert, department, assignee };
};


const deriveSentimentScoreFromResult = (result: any): number => {
  if (!result) return 0;
  if (typeof result.score === 'number') {
    return Math.max(-1, Math.min(1, result.score));
  }
  if (typeof result.generatedScore === 'number') {
    return Math.max(-1, Math.min(1, result.generatedScore));
  }
  const label = (result.label ?? result.dominantEmotion ?? '').toString().toLowerCase();
  if (label.includes('positive')) return 0.5;
  if (label.includes('negative')) return -0.6;
  if (label.includes('urgent')) return -0.4;
  if (label.includes('neutral')) return 0;

  if (Array.isArray(result.scores)) {
    const findScore = (keyword: string) =>
      result.scores?.find((entry: any) => entry?.label?.toString().toLowerCase().includes(keyword))
        ?.score ?? 0;
    const positive = findScore('positive');
    const negative = findScore('negative');
    const urgent = findScore('urgent');
    const score = positive - negative - urgent * 0.5;
    return Math.max(-1, Math.min(1, score));
  }
  return 0;
};

const fetchSentimentScore = async (text: string): Promise<number> => {
  if (!text.trim()) return 0;
  try {
    const resp = await fetch('/api/huggingface-sentiment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      throw new Error(`sentiment api ${resp.status}`);
    }
    const data = await resp.json();
    return deriveSentimentScoreFromResult(data?.sentiment);
  } catch (error) {
    console.error('Failed to analyze sentiment', error);
    return 0;
  }
};

const safeTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
};

const normalizeTextSnippet = (value?: string | null, length = 160) => {
  if (!value) return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > length ? `${normalized.slice(0, length)}…` : normalized;
};

const deriveAlertFromEmails = (alert: Alert): Alert => {
  const emails = Array.isArray(alert.emails) ? alert.emails.filter(Boolean) : [];
  if (!emails.length) return alert;

  const sortedEmails = [...emails].sort((a, b) => {
    const at = safeTimestamp(a.timestamp);
    const bt = safeTimestamp(b.timestamp);
    return bt - at;
  });
  const latest = sortedEmails[0];
  const subject = latest?.subject || alert.subject || alert.email_subject;
  const body =
    latest?.body ||
    latest?.ai_summary ||
    alert.body_preview ||
    alert.ai_summary ||
    latest?.subject ||
    '';

  const clone: Alert = {
    ...alert,
    subject: alert.subject || subject || alert.subject,
    email_subject: subject || alert.email_subject,
    body_preview: normalizeTextSnippet(body, 240),
    ai_summary: normalizeTextSnippet(body),
    emails,
  };

  return clone;
};

const formatJPDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const LEGACY_SEGMENT_MAP: Record<string, SegmentKey> = {
  urgent_response: 'occurrence',
  churn_risk: 'forecast',
  competitive_threat: 'forecast',
  contract_related: 'occurrence',
  revenue_opportunity: 'forecast',
  other: 'forecast',
  anxiety_signal: 'forecast',
  inactivity_risk: 'forecast',
  timing_load: 'forecast',
  quality_drop: 'forecast',
  followup_pressure: 'occurrence',
};

const normalizeSegmentCounts = (input?: Record<string, unknown>): SegmentCountsState => {
  const next: SegmentCountsState = { ...EMPTY_SEGMENT_COUNTS };
  if (!input) return next;
  Object.entries(input).forEach(([key, value]) => {
    const strKey = key.toString();
    let segmentKey: SegmentKey | undefined;
    if ((SEGMENT_META as Record<string, unknown>)[strKey]) {
      segmentKey = strKey as SegmentKey;
    } else if (LEGACY_SEGMENT_MAP[strKey]) {
      segmentKey = LEGACY_SEGMENT_MAP[strKey];
    }
    if (segmentKey) {
      next[segmentKey] = Number(value) || 0;
    }
  });
  return next;
};

type SegmentCountsState = Record<SegmentKey, number>;

const EMPTY_SEGMENT_COUNTS: SegmentCountsState = SEGMENT_ORDER.reduce(
  (acc, key) => {
    acc[key] = 0;
    return acc;
  },
  {} as SegmentCountsState
);

const INITIAL_SEGMENT_COUNTS: SegmentCountsState = { ...EMPTY_SEGMENT_COUNTS };

type AlertApiRow = Record<string, unknown>;

const deriveCountsFromAlerts = (list: Alert[]): SegmentCountsState => {
  const counts: SegmentCountsState = { ...EMPTY_SEGMENT_COUNTS };
  list.forEach((alert) => {
    const segment = alert.primarySegment;
    if (segment && counts[segment as SegmentKey] !== undefined) {
      counts[segment as SegmentKey] += 1;
    }
  });
  return counts;
};

const levelToSeverity = (lvl?: string) => (lvl === 'high' ? 'A' : lvl === 'medium' ? 'B' : 'C');
const levelToSentiment = (lvl?: string) => (lvl === 'high' ? -0.8 : lvl === 'medium' ? -0.4 : 0.2);

type ViewMode = 'cards' | 'compact';

const SEVERITY_META: Record<'A' | 'B' | 'C', { label: string; className: string }> = {
  A: { label: 'クリティカル', className: 'bg-red-600 text-white border border-red-500' },
  B: { label: '重要', className: 'bg-amber-500 text-white border border-amber-400' },
  C: { label: '注意', className: 'bg-yellow-500 text-white border border-yellow-400' },
};

const splitKeywordString = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const normalizeOwnerValue = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const ownerMatchesFilter = (owner: string, ownerLabel: string, filter: string) => {
  const normalizedFilter = normalizeOwnerValue(filter);
  if (!normalizedFilter) return true;
  const ownerNormalized = owner.toLowerCase();
  if (ownerNormalized === normalizedFilter) return true;
  if (ownerLabel?.toLowerCase().includes(normalizedFilter)) return true;
  return false;
};

const resolveOwnerKeyForFilter = (
  filter: string,
  dataset: Array<{ owner: string; ownerLabel: string }>
): string | null => {
  const normalizedFilter = normalizeOwnerValue(filter);
  if (!normalizedFilter) return null;
  const match = dataset.find(
    ({ owner, ownerLabel }) =>
      owner.toLowerCase() === normalizedFilter || ownerLabel.toLowerCase().includes(normalizedFilter)
  );
  return match?.owner ?? filter;
};

const resolveDummyOwnerKey = (filter?: string | null): string | null => {
  if (!filter) return null;
  const normalizedFilter = normalizeOwnerValue(filter);
  if (!normalizedFilter) return null;
  const candidates = Object.keys(DUMMY_ALERTS_BY_OWNER);
  
  // デバッグログ（開発環境のみ）
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 resolveDummyOwnerKey:', {
      filter,
      normalizedFilter,
      candidates,
    });
  }
  
  for (const key of candidates) {
    const normalizedKey = key.toLowerCase();
    // 完全一致
    if (normalizedKey === normalizedFilter) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ 完全一致:', key);
      }
      return key;
    }
    // ローカル部分（@より前）でのマッチング
    const localPart = normalizedKey.split('@')[0];
    const filterLocalPart = normalizedFilter.split('@')[0];
    if (normalizedFilter === localPart || localPart === filterLocalPart || localPart.includes(normalizedFilter) || normalizedFilter.includes(localPart)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ ローカル部分一致:', key);
      }
      return key;
    }
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('❌ マッチするキーが見つかりませんでした');
  }
  return null;
};

const mapApiRowToAlert = (row: AlertApiRow): Alert => {
  const keywordCandidates: string[] = [];
  if (typeof row.keyword === 'string') {
    keywordCandidates.push(...splitKeywordString(row.keyword));
  }
  if (Array.isArray(row.phrases)) {
    keywordCandidates.push(
      ...(row.phrases as unknown[])
        .map((phrase) => (typeof phrase === 'string' ? phrase.trim() : ''))
        .filter(Boolean) as string[]
    );
  } else if (typeof row.phrases === 'string') {
    keywordCandidates.push(...splitKeywordString(row.phrases));
  }
  if (Array.isArray((row as any).risk_keywords)) {
    keywordCandidates.push(
      ...((row as any).risk_keywords as unknown[])
        .map((phrase) => (typeof phrase === 'string' ? phrase.trim() : ''))
        .filter(Boolean) as string[]
    );
  } else if (typeof (row as any).risk_keywords === 'string') {
    keywordCandidates.push(...splitKeywordString((row as any).risk_keywords as string));
  }

  const keywordPhrases = keywordCandidates.length ? [...new Set(keywordCandidates)] : undefined;
  const rawSegment =
    (typeof row.primarySegment === 'string' && row.primarySegment) ||
    (typeof (row as any).primary_segment === 'string' && (row as any).primary_segment) ||
    null;
  const normalizedSegment = rawSegment ? rawSegment.toString() : null;
  let primarySegment: SegmentKey | null = null;
  if (normalizedSegment) {
    if ((SEGMENT_META as Record<string, unknown>)[normalizedSegment]) {
      primarySegment = normalizedSegment as SegmentKey;
    } else if (LEGACY_SEGMENT_MAP[normalizedSegment]) {
      primarySegment = LEGACY_SEGMENT_MAP[normalizedSegment];
    }
  }
  const segmentConfidence = typeof row.segmentConfidence === 'number' ? row.segmentConfidence : 0;
  const sentimentScore = typeof row.sentiment_score === 'number'
    ? row.sentiment_score
    : undefined;
  const level = typeof row.level === 'string' ? row.level : undefined;
  const severity = levelToSeverity(level);
  const sentiment = typeof sentimentScore === 'number' ? sentimentScore : levelToSentiment(level);

  const customer = String(row.customer ?? row.customer_name ?? row.customerEmail ?? row.person ?? 'Unknown');

  const alert: Alert = {
    id: String(row.id ?? ''),
    subject: String(row.description ?? row.subject ?? ''),
    severity,
    sentiment_score: sentiment,
    department: String(row.department ?? '営業部'),
    customer,
    updated_at: String(row.datetime ?? ''),
    status: row.status === '新規' || row.status === 'new'
      ? 'unhandled'
      : row.status === '対応中'
      ? 'in_progress'
      : row.status === '解決済み'
      ? 'completed'
      : 'unhandled',
    ai_summary: keywordPhrases?.length
      ? `検出: ${keywordPhrases.slice(0, 5).join(', ')}`
      : String((row as any).messageBody ?? ''),
    emails: [],
    company: typeof row.company === 'string' ? row.company : null,
    detection_score: typeof row.detection_score === 'number' ? row.detection_score : undefined,
    assignee: (typeof row.assignee === 'string' && row.assignee !== '未割り当て') ? row.assignee : undefined,
    phrases: keywordPhrases,
    threadId: typeof row.threadId === 'string' ? row.threadId : (typeof row.thread_id === 'string' ? row.thread_id : null),
    messageId: typeof row.message_id === 'string' ? row.message_id : null,
    sentiment_label: (typeof row.sentiment_label === 'string' && ['positive', 'neutral', 'negative'].includes(row.sentiment_label))
      ? (row.sentiment_label as 'positive' | 'neutral' | 'negative')
      : null,
    negative_flag: Boolean(row.negative_flag),
    primarySegment,
    segmentConfidence,
    urgencyScore: typeof row.urgencyScore === 'number' ? row.urgencyScore : undefined,
    detectionReasons: Array.isArray(row.detectionReasons) ? row.detectionReasons : [],
    highlightKeywords: Array.isArray(row.highlightKeywords) ? row.highlightKeywords : keywordPhrases ?? [],
  };

  alert.detection_score = alert.urgencyScore;
  return alert;
};

// Extract assignee email from internal senders
const extractAssigneeEmail = (alert: any): string => {
  if (alert.assignee && typeof alert.assignee === 'string' && alert.assignee.includes('@')) {
    return alert.assignee;
  }

  // Internal domains for filtering
  const internalDomains = INTERNAL_EMAIL_DOMAINS;

  // Try to extract from emails array
  if (alert.emails && Array.isArray(alert.emails)) {
    const internalSenders = alert.emails
      .map((email: any) => {
        // Try different sender field names
        const sender = email.sender || email.from || email.from_address;
        if (typeof sender === 'string') {
          // Extract email from "Name <email@domain.com>" format
          const emailMatch = sender.match(/<([^>]+)>/) || [null, sender];
          return emailMatch[1] || sender;
        }
        return null;
      })
      .filter((email: string | null): email is string => {
        if (!email || !email.includes('@')) return false;
        const domain = email.split('@')[1];
        return internalDomains.includes(domain as typeof internalDomains[number]);
      });

    if (internalSenders.length > 0) {
      // Return the most frequent internal sender
      const senderCounts = internalSenders.reduce((acc: Record<string, number>, sender: string) => {
        acc[sender] = (acc[sender] || 0) + 1;
        return acc;
      }, {});
      
      const mostFrequent = Object.entries(senderCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))[0];
      
      return mostFrequent[0];
    }
  }

  // Try to extract from alert.from_address or similar fields
  const fromFields = [
    alert.from_address,
    alert.from,
    alert.sender,
    (alert as any).most_frequent_internal_sender
  ];

  for (const field of fromFields) {
    if (typeof field === 'string' && field.includes('@')) {
      // Extract email from "Name <email@domain.com>" format
      const emailMatch = field.match(/<([^>]+)>/) || [null, field];
      const email = emailMatch[1] || field;
      
      if (email.includes('@')) {
        const domain = email.split('@')[1];
        if (internalDomains.includes(domain as typeof internalDomains[number])) {
          return email;
        }
      }
    }
  }

  return '未割り当て';
};

export default function AlertsPage() {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [segmentCounts, setSegmentCounts] = useState<SegmentCountsState>({ ...INITIAL_SEGMENT_COUNTS });
  const [filters, setFilters] = useState({
    severity: 'all',
    status: 'all',
    search: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<SegmentKey | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string | null>('tanaka@cross-m.co.jp');
  const [expandedCategories, setExpandedCategories] = useState<Record<AlertCategoryKey, boolean>>({
    forecast: true,
    occurrence: true,
    follow: true,
  });
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [simulationAlerts, setSimulationAlerts] = useState<Alert[]>([]);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);
  const alertRefs = useRef<Record<string, HTMLElement | null>>({});
  const [followTestForm, setFollowTestForm] = useState<{ targetAlertId: string; body: string }>({
    targetAlertId: '',
    body: GENERIC_FOLLOW_BODY,
  });
  const [followTestStatus, setFollowTestStatus] = useState<string | null>(null);
  const [isPostingFollowTest, setIsPostingFollowTest] = useState(false);
  const [followTransitionResult, setFollowTransitionResult] = useState<{
    before: Alert;
    after: Alert;
  } | null>(null);
  const itemsPerPage = viewMode === 'compact' ? COMPACT_ITEMS_PER_PAGE : CARD_ITEMS_PER_PAGE;
  const statusLabelMap: Record<string, string> = {
    all: 'すべて',
    unhandled: '未対応',
    in_progress: '対応中',
    completed: '解決済み',
  };
  const followTargetOptions = useMemo(() => {
    const candidates = alerts.filter((alert) => alert.primarySegment === 'occurrence');
    return candidates.slice(0, 6).map((alert) => ({
      id: alert.id,
      label: `${alert.customer || '顧客未設定'}｜${alert.subject || '件名なし'}`,
      segment: alert.primarySegment,
      summary: alert.ai_summary || alert.body_preview || '',
    }));
  }, [alerts]);
  const applyFollowSample = useCallback(
    (sampleId: string) => {
      const sampleAlert = alerts.find((alert) => alert.id === sampleId);
      setFollowTransitionResult(null);
      if (!sampleAlert) {
        setFollowTestForm({ targetAlertId: sampleId, body: GENERIC_FOLLOW_BODY });
        return;
      }
      setFollowTestForm({
        targetAlertId: sampleId,
        body: buildFollowUpBody(sampleAlert),
      });
    },
    [alerts]
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    setFilters((prev) => {
      const next = { ...prev };
      const severityParam = params.get('severity');
      const statusParam = params.get('status');
      const searchParam = params.get('search');

      if (severityParam) next.severity = severityParam;
      if (statusParam) next.status = statusParam;
      if (searchParam) {
        next.search = searchParam;
        setSearchQuery(searchParam);
      }
      return next;
    });

    const ownerParam = params.get('owner');
    const assigneeParam = params.get('assignee'); // サイドバーからのメンバー選択に対応
    if (ownerParam) {
      setOwnerFilter(ownerParam);
    } else if (assigneeParam) {
      // assigneeパラメータがある場合はownerフィルターに設定
      setOwnerFilter(assigneeParam);
    } else {
      setOwnerFilter(null);
    }

    const p = parseInt(params.get('page') || '1', 10);
    if (!Number.isNaN(p) && p > 0) setPage(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URLパラメータの変更を監視（メンバー切り替え時の即座の反映）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    let isMounted = true;
    
    // URLパラメータを定期的にチェック（pushStateの場合に対応）
    const checkUrlParams = () => {
      if (!isMounted) return;
      
      const params = new URLSearchParams(window.location.search);
      const assigneeParam = params.get('assignee');
      
      // 現在のownerFilterと比較して、実際に変更があった場合のみ更新
      setOwnerFilter((currentFilter) => {
        if (assigneeParam !== currentFilter) {
          setPage(1); // フィルター変更時は1ページ目に戻す
          return assigneeParam;
        }
        return currentFilter;
      });
    };
    
    // popstateイベント（ブラウザの戻る/進むボタン）
    const handlePopState = () => {
      checkUrlParams();
    };
    
    // pushState/replaceStateを監視（カスタムイベント）
    const handlePushState = () => {
      setTimeout(checkUrlParams, 0); // 次のイベントループでチェック
    };
    
    window.addEventListener('popstate', handlePopState);
    
    // pushState/replaceStateをフック
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    
    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args);
      handlePushState();
    };
    
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(window.history, args);
      handlePushState();
    };
    
    return () => {
      isMounted = false;
      window.removeEventListener('popstate', handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []); // 依存配列を空にして、マウント時のみ実行

  const mergedFilters: AlertsFilters = {
    severity: filters.severity,
    period: 'all', // Fixed since data is 2025/7/7-7/14
    status: filters.status,
    search: searchQuery,
  };

  const createFollowSimulationAlert = () => {
    const now = new Date();
    const complaintTime = new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString();
    const followTime = now.toISOString();
    const followEmails: EmailThread[] = [
      {
        id: `sim-follow-msg-1`,
        sender: 'ito@sunrise-manufacturing.co.jp',
        recipient: 'tanaka@cross-m.co.jp',
        timestamp: complaintTime,
        subject: '【障害対応】機能停止の影響について',
        sentiment: 'negative',
        ai_summary:
          '障害対応が遅れており、経営陣からの追及が入っている。至急フォロー報告と復旧計画が必要。',
        replyLevel: 0,
        body: `田中様

昨日ご相談していた障害の件ですが、まだ解決のめどが立っていません。
社内では経営陣からも状況共有を求められており、タイムラインの提示とSLA逸脱時の補填策を教えてください。

伊藤 / Sunrise Manufacturing`,
      },
      {
        id: `sim-follow-msg-2`,
        sender: 'tanaka@cross-m.co.jp',
        recipient: 'ito@sunrise-manufacturing.co.jp',
        timestamp: followTime,
        subject: 'Re: 【障害対応】機能停止の影響について',
        sentiment: 'neutral',
        ai_summary:
          '暫定対応と恒久対策を報告し、経営会議前にフォローMTGを設定。顧客の不安を鎮静化させるフォローメール。',
        replyLevel: 1,
        body: `伊藤様

Cross-Mの田中です。ご不安をおかけして申し訳ございません。
本日15時に暫定パッチを適用済みで、影響範囲はログイン周りに限定されております。
恒久対策は木曜までにお伝えできる見込みですので、明朝9時に状況共有MTGを設定させてください。

田中`,
      },
    ];
    const baseAlert: Alert = {
      id: `sim-follow-${now.getTime()}`,
      subject: 'フォロー対応中: Sunrise Manufacturing障害',
      severity: 'B',
      sentiment_score: 0.35,
      department: 'カスタマーサクセス',
      customer: 'Sunrise Manufacturing',
      updated_at: followTime,
      status: 'in_progress',
      ai_summary: '障害報告に対してサクセス担当がフォロー対応中。顧客の不安を鎮静化するため状況共有を継続。',
      emails: followEmails,
      assignee: 'tanaka@cross-m.co.jp',
      company: 'Sunrise Manufacturing',
      detection_score: 48,
      phrases: ['障害対応', 'フォロー', '状況共有'],
      primarySegment: 'follow',
      segmentConfidence: 0.82,
      urgencyScore: 40,
      detectionReasons: [
        '障害発生後のフォローコミュニケーション',
        '感情スコアがマイナスから中立に回復',
      ],
      highlightKeywords: ['フォロー', '改善共有', 'MTG設定'],
      resolutionPrediction: {
        probability: 0.62,
        ttrHours: 12,
      },
      quality: {
        level: 'Medium',
        score: 68,
        signals: ['一次障害後のフォロー記録', '顧客の反応が落ち着き始めている'],
      },
      detectionRule: {
        rule_type: 'recovery_monitoring',
        score: 48,
      },
    };
    return deriveAlertFromEmails(baseAlert);
  };

  const handleToggleSimulation = () => {
    setSimulationAlerts((prev) => {
      if (prev.length > 0) {
        return [];
      }
      return [createFollowSimulationAlert()];
    });
  };

  // Manual preset functionality removed - not used
  // const applyManualPreset = (preset: ManualPresetKey) => {
  //   setManualEvent({ ...MANUAL_PRESETS[preset] });
  //   setManualEventStatus(`プリセット「${preset === 'forecast' ? '見積懸念' : preset === 'occurrence' ? '障害/クレーム' : 'フォロー'}」を入力しました。編集後に送信してください。`);
  // };

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      if (USE_DUMMY_DATA) {
        const dummyAlerts = DUMMY_ALERTS.map((alert) =>
          deriveAlertFromEmails(
            ensureSalesContext({
              ...alert,
              emails: Array.isArray(alert.emails) ? alert.emails.map((email) => ({ ...email })) : [],
            })
          )
        );
        setAlerts(dummyAlerts);
        setSegmentCounts({ ...DUMMY_SEGMENT_COUNTS });
        return;
      }

      if (USE_DB_ALERTS) {
        const resp = await fetch('/api/events');
        if (!resp.ok) throw new Error('Failed to load runtime alerts');
        const store = await resp.json();
        const runtimeAlerts: Alert[] = Array.isArray(store.alerts) ? store.alerts : [];
        const normalizedAlerts = runtimeAlerts.map((alert) =>
          deriveAlertFromEmails({
            ...alert,
            emails: Array.isArray(alert.emails) ? alert.emails.map((email) => ({ ...email })) : [],
          })
        );
        setAlerts(normalizedAlerts);
        setSegmentCounts(deriveCountsFromAlerts(normalizedAlerts));
        return;
      }

      const accumulatedAlerts: Alert[] = [];
      let totalFromApi = 0;
      let totalPagesFromApi = 1;
      let currentPage = 1;
      let fetchedPages = 0;
      let segmentCountsSnapshot: SegmentCountsState | null = null;

      const buildQueryParams = (pageNumber: number) => {
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (segmentFilter) params.set('segment', segmentFilter);
        if (filters.status !== 'all') {
          const statusParam =
            filters.status === 'unhandled'
              ? '新規'
              : filters.status === 'in_progress'
              ? '対応中'
              : '解決済み';
          params.set('status', statusParam);
        }
        params.set('limit', String(LIMIT_PER_REQUEST));
        params.set('page', String(pageNumber));
        params.set('light', '1');
        return params;
      };

      while (currentPage <= totalPagesFromApi) {
        const params = buildQueryParams(currentPage);
        const apiUrl = `/api/alerts?${params.toString()}`;

        const resp = await fetch(apiUrl);
        if (!resp.ok) throw new Error(`Failed ${resp.status}`);
        const data = await resp.json();

        const rows: AlertApiRow[] = Array.isArray(data.alerts)
          ? (data.alerts as AlertApiRow[])
          : [];
        const mapped = rows.map(mapApiRowToAlert);
        accumulatedAlerts.push(...mapped);

        const paginationTotal =
          Number(data.pagination?.total ?? data.total ?? accumulatedAlerts.length) || 0;
        const paginationTotalPages = Number(
          data.pagination?.totalPages ??
            (paginationTotal ? Math.ceil(paginationTotal / LIMIT_PER_REQUEST) : 1)
        );

        if (!totalFromApi) {
          totalFromApi = paginationTotal;
        }
        if (Number.isFinite(paginationTotalPages) && paginationTotalPages > 0) {
          totalPagesFromApi = paginationTotalPages;
        }
        if (!segmentCountsSnapshot && data?.segmentCounts) {
          segmentCountsSnapshot = normalizeSegmentCounts(data.segmentCounts);
        }

        fetchedPages += 1;

        const effectiveLimit = Number(data.pagination?.limit ?? LIMIT_PER_REQUEST);
        const fetchedAllRecords = totalFromApi && accumulatedAlerts.length >= totalFromApi;
        const fetchedLessThanLimit = mapped.length < effectiveLimit;
        if (fetchedAllRecords || fetchedLessThanLimit) {
          break;
        }

        currentPage += 1;
      }

      setAlerts(accumulatedAlerts);
      setSegmentCounts(segmentCountsSnapshot ?? { ...INITIAL_SEGMENT_COUNTS });
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters.status, segmentFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const node = alertRefs.current[highlightedAlertId];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedAlertId, alerts]);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timer = window.setTimeout(() => setHighlightedAlertId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [highlightedAlertId]);

  const handleFollowTestSubmit = useCallback(async () => {
    if (!followTestForm.targetAlertId) {
      setFollowTestStatus('対象アラートを選択してください。');
      return;
    }
    if (!followTestForm.body.trim()) {
      setFollowTestStatus('フォローメール本文を入力してください。');
      return;
    }
    const targetAlert = alerts.find((alert) => alert.id === followTestForm.targetAlertId);
    if (!targetAlert) {
      setFollowTestStatus('対象アラートが見つかりません。');
      return;
    }
    setIsPostingFollowTest(true);
    setFollowTestStatus('感情分析を実行しています...');
    let sentimentScore = 0;
    try {
      sentimentScore = await fetchSentimentScore(followTestForm.body);
    } catch (error) {
      console.error('sentiment fallback', error);
    }

    const payload: RawEvent = {
      id: `follow-test-${targetAlert.id}-${Date.now()}`,
      subject: targetAlert.subject ? `Re: ${targetAlert.subject}` : 'フォローアップのご連絡',
      body: followTestForm.body.trim(),
      summary: 'フォローアップ報告',
      customer: targetAlert.customer || '営業顧客',
      channel: 'email',
      direction: 'outbound',
      assignee: targetAlert.assignee || 'success@cross-m.co.jp',
      sentimentScore,
      occurredAt: new Date().toISOString(),
      hoursSinceLastReply: 1,
      language: 'ja',
      urgencyHints: ['フォロー'],
      keywords: ['フォロー', '改善', '共有'],
      threadId: targetAlert.threadId || targetAlert.id,
      priorAlerts: [targetAlert.id],
    };

    try {
      const resp = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      const newAlertId =
        Array.isArray(data.alerts) && data.alerts.length ? data.alerts[0]?.id ?? null : null;

      if (targetAlert && newAlertId) {
        const newAlertRaw = data.alerts[0];
        const normalizedAlert = deriveAlertFromEmails(
          ensureSalesContext({
            ...newAlertRaw,
            emails: Array.isArray(newAlertRaw.emails)
              ? newAlertRaw.emails.map((email: any) => ({ ...email }))
              : [],
          })
        );
        setFollowTransitionResult({ before: targetAlert, after: normalizedAlert });
      } else {
        setFollowTransitionResult(null);
      }

      setFollowTestStatus(`フォローメールを送信しました（生成アラート: ${data.created}件）`);
      if (newAlertId) setHighlightedAlertId(newAlertId);
      setFollowTestForm((prev) => ({ ...prev, body: GENERIC_FOLLOW_BODY }));
      await fetchAlerts();
    } catch (error) {
      setFollowTestStatus(
        `送信に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
    } finally {
      setIsPostingFollowTest(false);
    }
  }, [followTestForm, alerts, fetchAlerts]);

  // Update URL when filters change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextParams = new URLSearchParams();
    if (filters.severity !== 'all') nextParams.set('severity', filters.severity);
    if (filters.status !== 'all') nextParams.set('status', filters.status);
    if (ownerFilter) {
      // サイドバーとの互換性のため、assigneeパラメータも設定
      nextParams.set('assignee', ownerFilter);
      nextParams.set('owner', ownerFilter);
    }
    if (searchQuery) nextParams.set('search', searchQuery);
    if (page > 1) nextParams.set('page', String(page));
    const newUrl = `${window.location.pathname}${nextParams.toString() ? '?' + nextParams.toString() : ''}`;
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [filters.status, filters.severity, ownerFilter, searchQuery, page]);

  const baseEnrichedAlerts = useMemo(() => {
    const combined = simulationAlerts.length ? [...simulationAlerts, ...alerts] : alerts;
    return combined.map((alert) => {
      const ownerCandidate = alert.assignee || extractAssigneeEmail(alert) || UNASSIGNED_OWNER_LABEL;
      const owner = ownerCandidate || UNASSIGNED_OWNER_LABEL;
      const ownerLabel = formatOwnerLabel(owner);
      const unifiedScore = calculateUnifiedScore(alert);
      const categoryKey = deriveAlertCategoryKey(alert) as AlertCategoryKey;
      const segmentMeta = getSegmentMeta(alert.primarySegment ?? undefined);
      return {
        alert,
        owner,
        ownerLabel,
        unifiedScore,
        categoryKey,
        segmentMeta,
      };
    });
  }, [alerts, simulationAlerts]);

  const dummyOwnerKey = useMemo(
    () => (USE_DUMMY_DATA ? resolveDummyOwnerKey(ownerFilter) : null),
    [ownerFilter]
  );

  const alertsSource = useMemo(() => {
    if (USE_DUMMY_DATA) {
      if (dummyOwnerKey) {
        const sourceAlerts = DUMMY_ALERTS_BY_OWNER[dummyOwnerKey] ?? [];
        if (process.env.NODE_ENV === 'development') {
          console.log('📊 alertsSource (dummyOwnerKey使用):', {
            dummyOwnerKey,
            sourceAlertsCount: sourceAlerts.length,
            availableKeys: Object.keys(DUMMY_ALERTS_BY_OWNER),
          });
        }
        const merged = simulationAlerts.length ? [...simulationAlerts, ...sourceAlerts] : sourceAlerts;
        return merged;
      } else if (ownerFilter) {
        // dummyOwnerKeyが解決できない場合でも、ownerFilterがあればalertsからフィルタリング
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️ alertsSource (dummyOwnerKeyがnull、alertsからフィルタリング):', {
            ownerFilter,
            alertsCount: alerts.length,
          });
        }
        const merged = simulationAlerts.length ? [...simulationAlerts, ...alerts] : alerts;
        return merged;
      }
    }
    const merged = simulationAlerts.length ? [...simulationAlerts, ...alerts] : alerts;
    return merged;
  }, [alerts, dummyOwnerKey, ownerFilter, simulationAlerts]);

  const enrichedAlerts = useMemo(() => {
    return alertsSource.map((alert) => {
      const ownerCandidate = alert.assignee || extractAssigneeEmail(alert) || UNASSIGNED_OWNER_LABEL;
      const owner = ownerCandidate || UNASSIGNED_OWNER_LABEL;
      const ownerLabel = formatOwnerLabel(owner);
      const unifiedScore = calculateUnifiedScore(alert);
      const categoryKey = deriveAlertCategoryKey(alert) as AlertCategoryKey;
      const segmentMeta = getSegmentMeta(alert.primarySegment ?? undefined);
      return {
        alert,
        owner,
        ownerLabel,
        unifiedScore,
        categoryKey,
        segmentMeta,
      };
    });
  }, [alertsSource]);

  const { paginatedAlerts: filteredAlerts, totalFilteredCount: totalFilteredAlerts } = useMemo(() => {
    const personalizationOwnerKey = ownerFilter
      ? USE_DUMMY_DATA
        ? dummyOwnerKey
        : resolveOwnerKeyForFilter(ownerFilter, baseEnrichedAlerts)
      : null;
    const normalizedSearch = searchQuery.trim().toLowerCase();

    // 早期リターンでパフォーマンスを改善
    if (enrichedAlerts.length === 0) {
      return {
        paginatedAlerts: [],
        totalFilteredCount: 0,
      };
    }

    // フィルタリングを最適化（早期リターンを使用）
    const filtered = enrichedAlerts.filter(({ alert, owner, ownerLabel }) => {
      // ステータスフィルター（最も早く判定）
      if (filters.status !== 'all' && alert.status !== filters.status) {
        return false;
      }
      
      // セグメントフィルター
      if (segmentFilter && alert.primarySegment !== segmentFilter) {
        return false;
      }
      
      // オーナーフィルター（メンバー切り替え時の主要フィルター）
      if (ownerFilter && !ownerMatchesFilter(owner, ownerLabel, ownerFilter)) {
        return false;
      }
      
      // 検索フィルター（最も重い処理なので最後に）
      if (normalizedSearch) {
        const haystack = [
          alert.subject,
          alert.customer,
          alert.ai_summary,
          owner,
          ...(alert.highlightKeywords ?? []),
          ...(alert.detectionReasons ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
        if (filters.severity === 'desc') {
          return b.unifiedScore.score - a.unifiedScore.score;
        }
        if (filters.severity === 'asc') {
          return a.unifiedScore.score - b.unifiedScore.score;
        }
        if (filters.severity === 'all' && segmentFilter) {
          return b.unifiedScore.score - a.unifiedScore.score;
        }
        return 0;
      });

    const startIndex = (page - 1) * itemsPerPage;
    const sliced = sorted.slice(startIndex, startIndex + itemsPerPage).map(({ alert, owner }) => ({
      ...alert,
      assignee: owner,
    }));

    const personalized =
      personalizationOwnerKey && ownerFilter
        ? personalizeAlertsForOwner(sliced, personalizationOwnerKey)
        : sliced;

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ filteredAlerts計算完了:', {
        filteredCount: filtered.length,
        slicedCount: sliced.length,
        personalizedCount: personalized.length,
        totalFilteredCount: sorted.length,
        ownerFilter,
        dummyOwnerKey,
      });
    }

    return {
      paginatedAlerts: personalized,
      totalFilteredCount: sorted.length,
    };
  }, [
    enrichedAlerts,
    filters.severity,
    filters.status,
    ownerFilter,
    segmentFilter,
    searchQuery,
    page,
    itemsPerPage,
    dummyOwnerKey,
    baseEnrichedAlerts,
  ]);

  const totalPagesCalculated = Math.max(1, Math.ceil(totalFilteredAlerts / itemsPerPage));

  // Calculate segment counts - total counts across all alerts, not just current page
  const calculateTotalSegmentCounts = useCallback(async () => {
    try {
      if (USE_DUMMY_DATA) {
        setSegmentCounts({ ...EMPTY_SEGMENT_COUNTS, ...DUMMY_SEGMENT_COUNTS });
        return;
      }
      // Use a dedicated API call to get consistent segment counts
      const resp = await fetch('/api/alerts?segment_counts_only=true&limit=10000'); 
      const json = await resp.json();
      
      if (json?.success && json.segmentCounts) {
        setSegmentCounts(normalizeSegmentCounts(json.segmentCounts));
      }
    } catch (error) {
      console.error('Failed to calculate segment counts:', error);
      // Set fallback counts to prevent inconsistency
      setSegmentCounts({ ...INITIAL_SEGMENT_COUNTS });
    }
  }, []);

  // Only calculate segment counts once when component mounts
  useEffect(() => {
    calculateTotalSegmentCounts();
  }, [calculateTotalSegmentCounts]);

  // Calculate segment counts from filtered alerts when owner filter is applied
  const filteredSegmentCounts = useMemo(() => {
    if (!ownerFilter) {
      // No owner filter, use total segment counts
      return segmentCounts;
    }
    
    // Calculate segment counts from filtered alerts
    // Note: segmentFilter is NOT applied here because we want to show counts for ALL segments
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const counts: SegmentCountsState = { ...EMPTY_SEGMENT_COUNTS };
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 filteredSegmentCounts計算開始:', {
        ownerFilter,
        enrichedAlertsCount: enrichedAlerts.length,
        filtersStatus: filters.status,
        searchQuery,
        alertsSourceCount: alertsSource.length,
      });
    }
    
    enrichedAlerts.forEach(({ alert, owner, ownerLabel }) => {
      // Apply filters (but NOT segmentFilter - we want counts for all segments)
      if (filters.status !== 'all' && alert.status !== filters.status) {
        return;
      }
      // Use ownerMatchesFilter for consistent matching logic
      // Note: alertsSource may already be filtered by owner, but we check again for safety
      if (ownerFilter && !ownerMatchesFilter(owner, ownerLabel, ownerFilter)) {
        return;
      }
      if (normalizedSearch) {
        const haystack = [
          alert.subject,
          alert.customer,
          alert.ai_summary,
          owner,
          ...(alert.highlightKeywords ?? []),
          ...(alert.detectionReasons ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          return;
        }
      }
      
      // Count the segment (for ALL segments, not just the filtered one)
      if (alert.primarySegment) {
        const segmentKey = alert.primarySegment as SegmentKey;
        counts[segmentKey] = (counts[segmentKey] || 0) + 1;
      }
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 filteredSegmentCounts計算結果:', counts);
      const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
      console.log('📊 セグメント合計件数:', totalCount);
    }
    
    return counts;
  }, [enrichedAlerts, ownerFilter, filters.status, searchQuery, segmentCounts, alertsSource.length]);

  useEffect(() => {
    setPage(1);
  }, [viewMode]);

  const segmentGroups = useMemo(() => {
    return SEGMENT_GROUP_ORDER.map((categoryKey) => {
      const segments = SEGMENT_ORDER
        .map((segKey) => ({ meta: SEGMENT_META[segKey], count: (filteredSegmentCounts[segKey] ?? 0) }))
        .filter(({ meta }) => meta.category.key === categoryKey)
        .map(({ meta, count }) => {
          return {
            key: meta.key,
            label: meta.label,
            description: meta.description,
            badgeClass: meta.badgeClass,
            accentClass: meta.accentClass,
            categoryLabel: meta.category.label,
            detectionLabel: meta.detectionLabel,
            actionLabel: meta.actionLabel,
            count,
          };
        });

      return {
        key: categoryKey,
        label: segments[0]?.categoryLabel ?? '',
        segments,
      };
    }).filter((group) => group.segments.length > 0);
  }, [filteredSegmentCounts]);

  const openDetail = useCallback(async (alert: Alert) => {
    try {
      if (USE_DUMMY_DATA) {
        setSelectedAlert(alert);
        return;
      }
      setSelectedAlert(alert);
      // Load thread messages if available
      if (alert.threadId || alert.messageId || alert.id) {
        const params = new URLSearchParams();
        if (alert.threadId) params.set('thread_id', alert.threadId);
        else if (alert.messageId) params.set('message_id', alert.messageId);
        else params.set('id', alert.id);
        params.set('mode', 'fast');
        
        const resp = await fetch(`/api/alerts-threaded/messages?${params.toString()}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.success && data.messages) {
            const emails: EmailThread[] = data.messages.map((msg: ThreadMessage) => ({
              id: msg.message_id || msg.message_key || '',
              subject: msg.subject || '',
              sender: msg.from || msg.sender || '',
              recipient: msg.to || msg.recipient || '',
              timestamp: msg.date || msg.created_at || '',
              sentiment: 'neutral' as const,
              ai_summary: msg.body || '',
              replyLevel: Number(msg.reply_level || 0),
              inReplyTo: msg.in_reply_to || null
            }));
            setSelectedAlert(prev => prev ? { ...prev, emails } : null);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load thread messages:', error);
    }
  }, []);

  const closeDetail = () => setSelectedAlert(null);

  const handleFilterChange = useCallback((newFilters: AlertsFilters) => {
    setFilters({
      severity: newFilters.severity,
      status: newFilters.status,
      search: newFilters.search,
    });
    setSearchQuery(newFilters.search);
    setPage(1);
  }, []);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleSegmentClick = (segmentLabel: SegmentKey) => {
    setSegmentFilter((current) => (current === segmentLabel ? null : segmentLabel));
    setPage(1);
  };

  const viewModeToggle = (
    <div className="flex items-center rounded-md border border-slate-200 overflow-hidden">
      <Button
        type="button"
        variant={viewMode === 'cards' ? 'default' : 'ghost'}
        size="icon"
        aria-label="カードビュー"
        onClick={() => setViewMode('cards')}
        className={cn(
          'h-9 w-9',
          viewMode === 'cards' && 'bg-blue-600 text-white hover:bg-blue-600'
        )}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={viewMode === 'compact' ? 'default' : 'ghost'}
        size="icon"
        aria-label="コンパクトビュー"
        onClick={() => setViewMode('compact')}
        className={cn(
          'h-9 w-9',
          viewMode === 'compact' && 'bg-blue-600 text-white hover:bg-blue-600'
        )}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-screen-2xl px-3 py-3 space-y-3 sm:px-4 sm:py-4 sm:space-y-4 md:px-6 md:py-6 md:space-y-6 lg:px-8">
      <PageHeader 
        title="アラート管理" 
        description="NLP感情分析によるセグメント検知システム (データ期間: 2025/7/7-7/14)"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={simulationAlerts.length ? 'secondary' : 'outline'}
              onClick={handleToggleSimulation}
              className="text-xs sm:text-sm"
            >
              {simulationAlerts.length ? 'フォロー検知サンプルを解除' : 'フォロー検知サンプルを追加'}
            </Button>
            {viewModeToggle}
          </div>
        }
      />

      <Collapsible defaultOpen>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <CardTitle className="text-base">トラブル対応→フォロー遷移を検証</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs text-slate-500">
                  折りたたむ/展開
                </Button>
              </div>
            </CollapsibleTrigger>
            <p className="text-sm text-slate-500">
              対象アラートを選び、フォローアップ文面を入力して送信すると、最後のメールとして感情分析 → 検知モデル評価を行い、
              follow セグメントへ遷移するかを確認できます。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              例: 「VIP Client Inc. / 再発障害への正式回答」や「Sunrise Manufacturing / 障害対応についての強い不満」など、トラブル→フォローの遷移を再現したいアラートを選んでください。
            </p>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-500">対象アラート</label>
            <select
              value={followTestForm.targetAlertId}
              onChange={(event) => applyFollowSample(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">選択してください</option>
              {followTargetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  [{getSegmentMeta(option.segment as SegmentKey)?.label ?? '未分類'}] {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              予兆/障害アラートを選びフォローを送信すると、感情スコアが改善した際に follow セグメントへ移動します。
            </p>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-500">フォローメール本文</label>
            <textarea
              value={followTestForm.body}
              onChange={(event) =>
                setFollowTestForm((prev) => ({ ...prev, body: event.target.value }))
              }
              rows={4}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" onClick={handleFollowTestSubmit} disabled={isPostingFollowTest}>
              {isPostingFollowTest ? '分析＆送信中…' : 'フォローメールを送信して遷移を確認'}
            </Button>
            {followTestStatus && (
              <p className="text-sm text-slate-600">{followTestStatus}</p>
            )}
          </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      {followTransitionResult && (
        <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>フォロー送信後の状態遷移</span>
              <Badge variant="outline" className="border-blue-200 text-blue-700">
                感情: {followTransitionResult.before.sentiment_score.toFixed(2)} →{' '}
                {followTransitionResult.after.sentiment_score.toFixed(2)}
              </Badge>
            </CardTitle>
            <p className="text-sm text-slate-600">
              {getSegmentMeta(followTransitionResult.before.primarySegment ?? undefined)?.label ??
                '未分類'}
              {' → '}
              {getSegmentMeta(followTransitionResult.after.primarySegment ?? undefined)?.label ??
                '未分類'}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[followTransitionResult.before, followTransitionResult.after].map(
              (item, index) => {
                const meta = getSegmentMeta(item.primarySegment ?? undefined);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-lg border p-4 space-y-2 bg-white',
                      index === 0 ? 'border-slate-200' : 'border-blue-200'
                    )}
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                      <span className="text-slate-500">
                        {index === 0 ? 'Before: 対象アラート' : 'After: フォロー生成'}
                      </span>
                      {meta && (
                        <Badge className={cn('text-[10px] px-2 py-0.5', meta.badgeClass)}>
                          {meta.label}
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm text-slate-900 line-clamp-2">
                      {item.subject || '件名なし'}
                    </h4>
                    <p className="text-xs text-slate-600 line-clamp-3">
                      {item.ai_summary || '概要なし'}
                    </p>
                    <div className="text-xs text-slate-500">
                      感情スコア: {item.sentiment_score.toFixed(2)} / 更新:{' '}
                      {formatJPDateTime(item.updated_at)}
                    </div>
                  </div>
                );
              }
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)] relative">
        {/* Sidebar */}
        <div className="space-y-2 sm:space-y-3 md:space-y-4 lg:sticky lg:top-8 lg:h-fit lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto order-2 lg:order-1 lg:w-[280px] xl:w-[320px] 2xl:w-[360px] overflow-x-hidden">
          {/* AI Segments */}
          <Card className="w-full overflow-hidden">
            <CardHeader className="p-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5" />
            AIセグメント
          </CardTitle>
        </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {segmentGroups.map((group) => {
                const categoryKey = group.key as AlertCategoryKey;
                const categoryMeta = ALERT_CATEGORY_CONFIG[categoryKey];
                const isExpanded = expandedCategories[categoryKey];
                const totalInGroup = group.segments.reduce((sum, seg) => sum + seg.count, 0);

                return (
                  <div key={group.key} className="space-y-1.5">
                    <button
                      onClick={() =>
                        setExpandedCategories((prev) => ({
                          ...prev,
                          [categoryKey]: !prev[categoryKey],
                        }))
                      }
                      className={cn(
                        'w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors',
                        categoryMeta.summaryClass,
                        isExpanded ? 'ring-2 ring-offset-1 ring-blue-400' : 'hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="uppercase text-[11px] tracking-wide">{group.label}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                          {totalInGroup}件
                        </Badge>
                      </span>
                      <span className="text-xs text-slate-500">
                        {isExpanded ? '折りたたむ' : '展開'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="space-y-1.5">
                {group.segments.map((seg) => {
                  const isActive = segmentFilter === seg.key;
                  return (
                    <button
                      key={seg.key}
                      onClick={() => handleSegmentClick(seg.key)}
                      className={cn(
                                'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                                isActive
                                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-slate-900 text-sm truncate">{seg.label}</span>
                                    <Badge
                                      className={cn(
                                        seg.badgeClass,
                                        'text-[10px] px-1.5 py-0.5 flex-shrink-0'
                                      )}
                                    >
                                      {seg.count}
                                    </Badge>
                          </div>
                                  <div className="text-[11px] text-slate-500 leading-tight line-clamp-1">
                            {seg.description}
                          </div>
                        </div>
                              </div>
                              <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                                <div className="text-[10px] text-slate-600 font-medium truncate">
                            {seg.detectionLabel}
                          </div>
                              <div className="text-[10px] text-slate-500 italic truncate mt-0.5">
                        {seg.actionLabel}
                              </div>
                     </div>
                    </button>
                  );
                })}
              </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-3 sm:space-y-4 md:space-y-6 order-1 lg:order-2 min-w-0 overflow-hidden">
          <FilterBar 
            filters={mergedFilters} 
            onFiltersChange={handleFilterChange}
            hidePeriod={true} // Hide period filter since data is fixed
          />

          {/* Status Info */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm text-gray-600">
              {filteredAlerts.length}/{totalFilteredAlerts} 件表示
            </span>
            <Badge variant="outline" className="text-xs sm:text-sm">
              ビュー: {viewMode === 'compact' ? 'コンパクト' : 'カード'} / 1ページ {itemsPerPage}件
            </Badge>
            
            {segmentFilter && (
              <Badge variant="outline" className="text-xs sm:text-sm">
                フィルター: {getSegmentMeta(segmentFilter)?.label ?? 'セグメント'}
              </Badge>
            )}
            {ownerFilter && (
              <Badge variant="outline" className="text-xs sm:text-sm">
                担当: {formatOwnerLabel(ownerFilter)}
              </Badge>
            )}
          </div>

          {/* Alerts List */}
          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : filteredAlerts.length === 0 ? (
            <EmptyState 
              title="アラートが見つかりません"
              description="条件を変更して再度お試しください"
            />
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 w-full">
              {filteredAlerts.map((alert) => {
                const assigneeEmail = alert.assignee || extractAssigneeEmail(alert);
                return (
                  <div
                    key={alert.id}
                    ref={(node) => {
                      alertRefs.current[alert.id] = node;
                    }}
                    className={cn(
                      alert.id === highlightedAlertId
                        ? 'ring-2 ring-blue-400 rounded-xl animate-pulse'
                        : ''
                    )}
                  >
                    <AlertCard
                      alert={{
                        ...alert,
                        assignee: assigneeEmail || alert.assignee,
                      } as any}
                      onClick={() => openDetail(alert)}
                      isHighlighted={alert.id === highlightedAlertId}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 -mx-3 sm:-mx-4 md:mx-0 w-full">
              <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm w-full">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">重要度</th>
                    <th className="px-3 py-2 text-left">件名 / 要約</th>
                    <th className="px-3 py-2 text-left hidden lg:table-cell">顧客</th>
                    <th className="px-3 py-2 text-left hidden lg:table-cell">担当</th>
                    <th className="px-3 py-2 text-left hidden lg:table-cell">セグメント</th>
                    <th className="px-3 py-2 text-left hidden lg:table-cell">更新日時</th>
                    <th className="px-3 py-2 text-left">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAlerts.map((alert) => {
                    const segment = getSegmentMeta(alert.primarySegment ?? undefined);
                    const ownerLabel = formatOwnerLabel(alert.assignee || '');
                    const severityMeta = SEVERITY_META[alert.severity];
                    return (
                      <tr
                        key={alert.id}
                        ref={(node) => {
                          alertRefs.current[alert.id] = node;
                        }}
                        onClick={() => openDetail(alert)}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-slate-50',
                          alert.id === highlightedAlertId && 'bg-blue-50 ring-2 ring-blue-200'
                        )}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge className={cn('text-[10px] px-2 py-0.5', severityMeta.className)}>
                            {severityMeta.label}
                                </Badge>
                        </td>
                        <td className="px-3 py-2 max-w-[320px]">
                          <div className="font-medium text-slate-900 line-clamp-1">
                            {alert.subject || '件名なし'}
                            </div>
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {alert.ai_summary || '—'}
                            </div>
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell text-slate-700 line-clamp-1">
                          {alert.customer || '—'}
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell text-slate-700 line-clamp-1">
                          {ownerLabel}
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell">
                          {segment ? (
                            <Badge className={cn('text-[10px] px-1.5 py-0.5', segment.badgeClass)}>
                              {segment.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-500">未分類</span>
                          )}
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell text-xs text-slate-600 whitespace-nowrap">
                          {formatJPDateTime(alert.updated_at)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px]">
                            {alert.status === 'unhandled'
                              ? '未対応'
                              : alert.status === 'in_progress'
                              ? '対応中'
                              : '解決済み'}
                          </Badge>
                        </td>
                      </tr>
                );
              })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPagesCalculated > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                前へ
              </Button>
              <span className="text-sm">
                {page} / {totalPagesCalculated}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPagesCalculated}
              >
                次へ
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <AlertDetail
          alert={selectedAlert}
          onClose={closeDetail}
          onRefresh={fetchAlerts}
          onFollowCreated={(newAlertId) => {
            if (newAlertId) setHighlightedAlertId(newAlertId);
            fetchAlerts();
          }}
        />
      )}

    </div>
  );
} 
