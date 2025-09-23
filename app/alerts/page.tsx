'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCard } from '@/components/alerts/AlertCard';
import { AlertDetail } from '@/components/alerts/AlertDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, EmailThread } from '@/types'; // Assuming Alert type is defined here or imported
import { AlertTriangle, Brain, Shield, Target, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { FilterBar, AlertsFilters } from '@/components/ui/FilterBar';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

type AlertSegments = NonNullable<Alert['segments']>;
type SegmentKey = 'lose' | 'rival' | 'addreq' | 'renewal';

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

export default function AlertsPage() {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [segmentCounts, setSegmentCounts] = useState<{lose:number;rival:number;addreq:number;renewal:number}>({lose:0,rival:0,addreq:0,renewal:0});
  const [filters, setFilters] = useState({
    department: 'all',
    customer: '',
    severity: 'all',
    period: 'all',
    status: 'all',
    // keep a local search field to satisfy AlertsFilters structure when needed
    search: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [negOnly, setNegOnly] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState<SegmentKey | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const next: AlertsFilters = { ...filters };
    let changed = false;
    if (params.get('department')) { next.department = params.get('department')!; changed = true; }
    if (params.get('severity')) { next.severity = params.get('severity')!; changed = true; }
    if (params.get('status')) { next.status = params.get('status')!; changed = true; }
    if (params.get('period')) { next.period = params.get('period')!; changed = true; }
    if (params.get('search')) { setSearchQuery(params.get('search')!); }
    const p = parseInt(params.get('page') || '1');
    if (!Number.isNaN(p) && p > 0) setPage(p);
    if (changed) setFilters(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mergedFilters: AlertsFilters = {
    department: filters.department,
    customer: filters.customer,
    severity: filters.severity,
    period: filters.period,
    status: filters.status,
    search: searchQuery,
  };

  const severityToLevel = (sev: string) => sev === 'A' ? 'high' : sev === 'B' ? 'medium' : sev === 'C' ? 'low' : '';
  const levelToSeverity = (lvl?: string) => lvl === 'high' ? 'A' : lvl === 'medium' ? 'B' : 'C';
  const levelToSentiment = (lvl?: string) => lvl === 'high' ? -0.8 : lvl === 'medium' ? -0.4 : 0.2;

  const computeDateRange = useCallback(() => {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);
    start.setMilliseconds(0);
    end.setMilliseconds(0);

    switch (filters.period) {
      case 'today': {
        start.setHours(0, 0, 0, 0);
        break;
      }
      case 'week': {
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      }
      case 'month': {
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      }
      default: {
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      }
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }, [filters.period]);

  const dateRange = useMemo(() => computeDateRange(), [computeDateRange]);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filters.status !== 'all') params.set('status', filters.status === 'unhandled' ? '新規' : filters.status === 'in_progress' ? '対応中' : '解決済み');
      if (filters.severity !== 'all') params.set('level', severityToLevel(filters.severity));
      params.set('limit', '20');
      params.set('page', String(page));
      // Use light payload by default; detail fetch will pull full record on demand
      params.set('light', '1');
      // Provide required date window (default last 30 days)
      const now = new Date();
      const startDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
      const toIso = (d: Date) => d.toISOString();
      params.set('start', toIso(startDate));
      params.set('end', toIso(now));
      const resp = await fetch(`/api/alerts?${params.toString()}`, {
        headers: { 'Authorization': `Basic ${btoa('cmgadmin:crossadmin')}` },
      });
      if (!resp.ok) throw new Error(`Failed ${resp.status}`);
      const data = await resp.json();
      type AlertApiRow = Record<string, unknown>;
      const rows: AlertApiRow[] = Array.isArray(data.alerts) ? (data.alerts as AlertApiRow[]) : [];
      const mapped: Alert[] = rows.map((row) => {
        const keywordRaw = row.keyword;
        const keywordStr = typeof keywordRaw === 'string' ? keywordRaw : '';
        const keywordPhrases = keywordStr
          ? keywordStr.split(',').map((s) => s.trim()).filter(Boolean)
          : (Array.isArray(row.phrases) ? (row.phrases as string[]) : undefined);
        const segmentsValue = row.segments;
        const segments: Alert['segments'] = segmentsValue && typeof segmentsValue === 'object' ? (segmentsValue as AlertSegments) : undefined;
        const sentimentScore = typeof row.sentiment_score === 'number'
          ? row.sentiment_score
          : undefined;
        const level = typeof row.level === 'string' ? row.level : undefined;
        const severity = levelToSeverity(level);
        const sentiment = typeof sentimentScore === 'number' ? sentimentScore : levelToSentiment(level);
        return {
          id: String(row.id ?? ''),
          subject: String(row.description ?? ''),
          severity,
          sentiment_score: sentiment,
          department: String(row.department ?? '営業部'),
          customer: String(row.customer_name ?? row.customerEmail ?? row.person ?? 'Unknown'),
          updated_at: String(row.datetime ?? ''),
          status: row.status === '新規' || row.status === 'new'
            ? 'unhandled'
            : row.status === '対応中'
            ? 'in_progress'
            : row.status === '解決済み'
            ? 'completed'
            : 'unhandled',
          ai_summary: String(keywordStr ? `検出: ${keywordStr}` : (row.messageBody ?? '')),
          emails: [],
          company: row.company ?? null,
          detection_score: typeof row.detection_score === 'number' ? row.detection_score : (typeof row.score === 'number' ? Math.round((row.score as number) * 100) : undefined),
          assignee: row.assignee ?? undefined,
          phrases: keywordPhrases,
          threadId: row.threadId ?? row.thread_id ?? null,
          messageId: row.message_id ?? null,
          sentiment_label: row.sentiment_label ?? null,
          negative_flag: Boolean(row.negative_flag),
          segments,
        } as Alert;
      });
      setAlerts(mapped);
      const pg = data?.pagination;
      if (pg) {
        setTotal(Number(pg.total || 0));
        setTotalPages(Number(pg.totalPages || 1));
      } else {
        setTotal(mapped.length);
        setTotalPages(1);
      }
      if (data?.segmentCounts) {
        setSegmentCounts({
          lose: Number(data.segmentCounts.lose || 0),
          rival: Number(data.segmentCounts.rival || 0),
          addreq: Number(data.segmentCounts.addreq || 0),
          renewal: Number(data.segmentCounts.renewal || 0)
        });
      }

      if (typeof window !== 'undefined') {
        const nextParams = new URLSearchParams();
        nextParams.set('page', String(page));
        if (searchQuery) nextParams.set('search', searchQuery);
        if (filters.status !== 'all') nextParams.set('status', filters.status);
        if (filters.severity !== 'all') nextParams.set('severity', filters.severity);
        if (filters.period !== 'all') nextParams.set('period', filters.period);
        if (filters.department !== 'all') nextParams.set('department', filters.department);
        if (filters.customer) nextParams.set('customer', filters.customer);
        nextParams.set('start', dateRange.start);
        nextParams.set('end', dateRange.end);
        const nextUrl = `${window.location.pathname}?${nextParams.toString()}`;
        window.history.replaceState(null, '', nextUrl);
      }
    } catch (e) {
      console.error('Fetch alerts error', e);
      setAlerts([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.severity, filters.period, filters.department, filters.customer, searchQuery, page, dateRange.start, dateRange.end]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const filteredAlerts = alerts.filter(alert => {
    if (filters.department !== 'all' && alert.department !== filters.department) return false;
    if (filters.customer && !alert.customer.toLowerCase().includes(filters.customer.toLowerCase())) return false;
    if (filters.severity !== 'all' && alert.severity !== filters.severity) return false;
    if (filters.status !== 'all' && alert.status !== filters.status) return false;
    if (negOnly && !alert.negative_flag) return false;
    if (segmentFilter) {
      const segs = alert.segments;
      if (!segs || !segs[segmentFilter]) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inSubject = (alert.subject || '').toLowerCase().includes(q);
      const inSummary = (alert.ai_summary || '').toLowerCase().includes(q);
      const inPhrases = Array.isArray(alert.phrases) && alert.phrases.some(p => (p || '').toLowerCase().includes(q));
      if (!inSubject && !inSummary && !inPhrases) return false;
    }
    return true;
  });

  const normaliseMessages = useCallback((payload: unknown, fallbackSubject: string): EmailThread[] => {
    if (!Array.isArray(payload)) return [];
    const seen = new Set<string>();
    return (payload as ThreadMessage[]).reduce<EmailThread[]>((acc, msg, idx) => {
      const key = msg.message_key && msg.message_key !== ''
        ? String(msg.message_key)
        : `${msg.message_id ?? ''}|${msg.reply_level ?? ''}|${msg.date ?? msg.created_at ?? ''}|${idx}`;
      if (seen.has(key)) return acc;
      seen.add(key);

      const replyLevel = typeof msg.reply_level === 'number'
        ? msg.reply_level
        : typeof msg.reply_level === 'string' && msg.reply_level.trim() !== ''
        ? Number(msg.reply_level)
        : undefined;

      acc.push({
        id: key,
        sender: String(msg.from ?? msg.sender ?? ''),
        recipient: String(msg.to ?? msg.recipient ?? ''),
        timestamp: String(msg.date ?? msg.created_at ?? ''),
        sentiment: 'neutral',
        ai_summary: String(msg.body ?? ''),
        subject: String(msg.subject ?? fallbackSubject),
        replyLevel,
        inReplyTo: msg.in_reply_to ?? undefined,
        messageId: msg.message_id ?? undefined,
      });
      return acc;
    }, []);
  }, []);

  // Re-add openDetail to open modal and load messages (fast-first, fallback full)
  const openDetail = useCallback(async (alert: Alert) => {
    try {
      setSelectedAlert({ ...alert, emails: alert.emails ?? [] });

      const threadId = alert.threadId ?? null;
      const messageId = alert.messageId ?? null;
      const id = String(alert.id ?? '');
      const authHeader = { 'Authorization': `Basic ${btoa('cmgadmin:crossadmin')}` };

      const makeUrl = (mode: 'fast' | 'full') => {
        const params = new URLSearchParams();
        params.set('mode', mode);
        params.set('limit', '60');
        params.set('start', dateRange.start);
        params.set('end', dateRange.end);
        if (threadId) {
          params.set('thread_id', threadId);
        } else {
          if (messageId) params.set('message_id', messageId);
          params.set('id', id);
        }
        return `/api/alerts-threaded/messages?${params.toString()}`;
      };

      const fetchMessages = async (mode: 'fast' | 'full'): Promise<EmailThread[]> => {
        const res = await fetch(makeUrl(mode), { headers: authHeader });
        if (!res.ok) return [];
        const json = await res.json();
        return normaliseMessages(json?.messages, alert.subject ?? '');
      };

      let emails = await fetchMessages('fast');
      if (!emails.length) {
        emails = await fetchMessages('full');
      }

      emails.sort((a, b) => {
        const replyDelta = (a.replyLevel ?? 0) - (b.replyLevel ?? 0);
        if (replyDelta !== 0) return replyDelta;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      setSelectedAlert(prev => {
        if (!prev || prev.id !== alert.id) return prev;
        return { ...prev, emails };
      });
    } catch (e) {
      console.error('Fetch messages error', e);
    }
  }, [normaliseMessages, dateRange.start, dateRange.end]);

  const aiSegments = useMemo(() => {
    const segments: { label: string; key: SegmentKey; priority: 'critical' | 'high' | 'medium' }[] = [
      { label: '失注リスク', key: 'lose', priority: 'critical' },
      { label: '競合比較', key: 'rival', priority: 'high' },
      { label: '追加要望', key: 'addreq', priority: 'high' },
      { label: '更新/契約', key: 'renewal', priority: 'medium' },
    ];
    return segments.map(seg => ({
      label: seg.label,
      priority: seg.priority,
      key: seg.key,
      count: segmentCounts[seg.key as keyof typeof segmentCounts] || alerts.reduce((acc, alertItem) => acc + (alertItem.segments?.[seg.key] ? 1 : 0), 0)
    }));
  }, [alerts, segmentCounts]);

  const goPrev = () => setPage(p => Math.max(1, p - 1));
  const goNext = () => setPage(p => Math.min(totalPages, p + 1));

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="リスク統制センター"
        description="全社横断的なリスクアラートの監視・対応状況"
        actions={
          <>
            <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => setNegOnly(v => !v)}>
              {negOnly ? '全件表示' : 'ネガのみ'}
            </Button>
            <Button className="bg-slate-800 hover:bg-slate-900">
              緊急対応
            </Button>
          </>
        }
      />

      {/* Filter Bar */}
      <FilterBar
        value={mergedFilters}
        onChange={(next) => {
          setFilters({
            department: next.department,
            customer: next.customer,
            severity: next.severity,
            period: next.period,
            status: next.status,
            search: next.search || ''
          });
          setSearchQuery(next.search);
          setPage(1);
        }}
        storageKey="alerts"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Brain className="mr-2 h-5 w-5 text-purple-600" />
                分類セグメント
              </CardTitle>
              <p className="text-sm text-purple-600">辞書+ルール（暫定）</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {aiSegments.map((seg, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className={`w-full justify-between h-auto p-3 border-purple-200 hover:bg-purple-50 hover:border-purple-300 ${segmentFilter===seg.key ? 'bg-purple-50 border-purple-300' : ''}`}
                    onClick={() => {
                      setSegmentFilter(prev => prev === seg.key ? null : seg.key);
                      setSearchQuery('');
                      setPage(1);
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      {seg.priority === 'critical' ? <Zap className="h-3 w-3 text-red-500" /> : seg.priority === 'high' ? <AlertTriangle className="h-3 w-3 text-orange-500" /> : <Target className="h-3 w-3 text-blue-500" />}
                      <span className="text-sm font-medium">{seg.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                      {seg.count}件
                    </Badge>
                  </Button>
                ))}
                <div className="pt-2">
                  <Button variant="ghost" className="w-full" onClick={() => { setSegmentFilter(null); setSearchQuery(''); setPage(1); }}>セグメント解除</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                リスクアラート監視状況 
                <span className="text-blue-600">({filteredAlerts.length}/{total}件)</span>
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={loading || page <= 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> 前へ
                </Button>
                <span className="text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={goNext} disabled={loading || page >= totalPages}>
                  次へ <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredAlerts.map((alert, idx) => (
                <AlertCard
                  key={`${alert.id ?? 'row'}-${idx}`}
                  alert={alert}
                  onClick={() => openDetail(alert)}
                />
              ))}
            </div>

            {!loading && filteredAlerts.length === 0 && (
              <EmptyState
                icon={<div className="bg-green-100 rounded-full h-16 w-16 flex items-center justify-center"><Shield className="h-8 w-8 text-green-600" /></div>}
                title="優秀な統制状況です"
                description="現在の条件下では重要なリスクアラートは検出されていません。"
              />
            )}
          </div>
        </div>
      </div>

      {selectedAlert && (
        <AlertDetail alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  );
}
