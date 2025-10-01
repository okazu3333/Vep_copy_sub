'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertDetail } from '@/components/alerts/AlertDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, EmailThread } from '@/types';
import { AlertTriangle, Brain, Shield, Target, ChevronLeft, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { FilterBar, AlertsFilters } from '@/components/ui/FilterBar';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HighlightText } from '@/components/ui/HighlightText';
// import { DetectionReasons } from '@/components/ui/DetectionReasons'; // 一覧表示では不使用
import { INTERNAL_EMAIL_DOMAINS } from '@/lib/constants/internal-domains';

type SegmentKey = 'urgent_response' | 'churn_risk' | 'competitive_threat' | 'contract_related' | 'revenue_opportunity' | 'other';

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

// 3段階リスクレベル
const getRiskLevel = (score: number): { level: string; label: string; color: string } => {
  if (score >= 60) {
    return { level: 'high', label: '危険', color: 'bg-red-100 text-red-800' };
  } else if (score >= 30) {
    return { level: 'medium', label: '注意', color: 'bg-yellow-100 text-yellow-800' };
  } else {
    return { level: 'low', label: '健全', color: 'bg-green-100 text-green-800' };
  }
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
        return internalDomains.includes(domain);
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
        if (internalDomains.includes(domain)) {
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
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [segmentCounts, setSegmentCounts] = useState<{urgent_response:number;churn_risk:number;competitive_threat:number;contract_related:number;revenue_opportunity:number;other:number}>({urgent_response:0,churn_risk:0,competitive_threat:0,contract_related:0,revenue_opportunity:0,other:0});
  const [filters, setFilters] = useState({
    severity: 'all',
    status: 'all',
    search: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<SegmentKey | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const next: AlertsFilters = { ...filters, period: 'all' };
    let changed = false;
    if (params.get('severity')) { next.severity = params.get('severity')!; changed = true; }
    if (params.get('status')) { next.status = params.get('status')!; changed = true; }
    if (params.get('search')) { setSearchQuery(params.get('search')!); }
    const p = parseInt(params.get('page') || '1');
    if (!Number.isNaN(p) && p > 0) setPage(p);
    if (changed) setFilters(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mergedFilters: AlertsFilters = {
    severity: filters.severity,
    period: 'all', // Fixed since data is 2025/7/7-7/14
    status: filters.status,
    search: searchQuery,
  };

  const levelToSeverity = (lvl?: string) => lvl === 'high' ? 'A' : lvl === 'medium' ? 'B' : 'C';
  const levelToSentiment = (lvl?: string) => lvl === 'high' ? -0.8 : lvl === 'medium' ? -0.4 : 0.2;

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (segmentFilter) params.set('segment', segmentFilter);
      if (filters.status !== 'all') params.set('status', filters.status === 'unhandled' ? '新規' : filters.status === 'in_progress' ? '対応中' : '解決済み');
      // 新しい重要度フィルタロジック
      if (filters.severity !== 'all') {
        params.set('severity', filters.severity);
      }
      params.set('limit', '20');
      params.set('page', String(page));
      params.set('light', '1');
      // Note: Date filtering removed since data is fixed to 2025/7/7-7/14
      
      const apiUrl = `/api/alerts?${params.toString()}`;
      const resp = await fetch(apiUrl);
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
        const primarySegment = typeof row.primarySegment === 'string' ? row.primarySegment as SegmentKey : null;
        const segmentConfidence = typeof row.segmentConfidence === 'number' ? row.segmentConfidence : 0;
        const sentimentScore = typeof row.sentiment_score === 'number'
          ? row.sentiment_score
          : undefined;
        const level = typeof row.level === 'string' ? row.level : undefined;
        const severity = levelToSeverity(level);
        const sentiment = typeof sentimentScore === 'number' ? sentimentScore : levelToSentiment(level);
        
        // APIから取得した顧客名をそのまま使用（APIで既に適切に処理済み）
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
          ai_summary: String(keywordStr ? `検出: ${keywordStr}` : (row.messageBody ?? '')),
          emails: [],
          company: typeof row.company === 'string' ? row.company : null,
          detection_score: typeof row.detection_score === 'number' ? row.detection_score : undefined,
          assignee: (typeof row.assignee === 'string' && row.assignee !== '未割り当て') ? row.assignee : undefined,
          phrases: keywordPhrases,
          threadId: typeof row.threadId === 'string' ? row.threadId : (typeof row.thread_id === 'string' ? row.thread_id : null),
          messageId: typeof row.message_id === 'string' ? row.message_id : null,
          sentiment_label: (typeof row.sentiment_label === 'string' && ['positive', 'neutral', 'negative'].includes(row.sentiment_label)) 
            ? row.sentiment_label as 'positive' | 'neutral' | 'negative' 
            : null,
          negative_flag: Boolean(row.negative_flag),
          primarySegment,
          segmentConfidence,
          urgencyScore: typeof row.urgencyScore === 'number' ? row.urgencyScore : undefined,
          detectionReasons: Array.isArray(row.detectionReasons) ? row.detectionReasons : [],
          highlightKeywords: Array.isArray(row.highlightKeywords) ? row.highlightKeywords : [],
        };
        
        // Use API-calculated urgency score directly (no frontend calculation needed)
        alert.detection_score = alert.urgencyScore;
        return alert;
      });
      
      setAlerts(mapped);

      // セグメントフィルタはAPIで処理されるため、フロントエンドフィルタは不要
      const filteredMapped = mapped;
      
      const pg = data?.pagination;
      if (pg) {
        // APIから返される正確な総件数を使用
        setTotal(Number(pg.total || 0));
        setTotalPages(Math.ceil(Number(pg.total || 0) / 20));
      } else {
        setTotal(filteredMapped.length);
        setTotalPages(Math.ceil(filteredMapped.length / 20));
      }
      if (data?.segmentCounts) {
        setSegmentCounts({
          urgent_response: Number(data.segmentCounts.urgent_response || 0),
          churn_risk: Number(data.segmentCounts.churn_risk || 0),
          competitive_threat: Number(data.segmentCounts.competitive_threat || 0),
          contract_related: Number(data.segmentCounts.contract_related || 0),
          revenue_opportunity: Number(data.segmentCounts.revenue_opportunity || 0),
          other: Number(data.segmentCounts.other || 0)
        });
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, segmentFilter, filters.status, filters.severity, page]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Update URL when filters change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextParams = new URLSearchParams();
    if (filters.severity !== 'all') nextParams.set('severity', filters.severity);
    if (filters.status !== 'all') nextParams.set('status', filters.status);
    if (searchQuery) nextParams.set('search', searchQuery);
    if (page > 1) nextParams.set('page', String(page));
    const newUrl = `${window.location.pathname}${nextParams.toString() ? '?' + nextParams.toString() : ''}`;
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [filters.status, filters.severity, searchQuery, page]);

  // Filter alerts based on current filters and segment selection
  const filteredAlerts = useMemo(() => {
    const filtered = alerts.filter(alert => {
      
      // APIで重要度フィルタが適用されるため、フロントエンドでは追加フィルタ不要
      
      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          alert.customer?.toLowerCase().includes(query) ||
          alert.subject?.toLowerCase().includes(query) ||
          alert.id?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      return true;
    });

    // セグメントフィルタはAPIで処理されるため、フロントエンドでは不要
    // if (segmentFilter) { ... }

    return filtered;
  }, [alerts, searchQuery]);

  // Calculate segment counts - total counts across all alerts, not just current page
  const calculateTotalSegmentCounts = useCallback(async () => {
    try {
      // Use a dedicated API call to get consistent segment counts
      const resp = await fetch('/api/alerts?segment_counts_only=true&limit=10000'); 
      const json = await resp.json();
      
      if (json?.success && json.segmentCounts) {
        setSegmentCounts({
          urgent_response: Number(json.segmentCounts.urgent_response || 0),
          churn_risk: Number(json.segmentCounts.churn_risk || 0),
          competitive_threat: Number(json.segmentCounts.competitive_threat || 0),
          contract_related: Number(json.segmentCounts.contract_related || 0),
          revenue_opportunity: Number(json.segmentCounts.revenue_opportunity || 0),
          other: Number(json.segmentCounts.other || 0)
        });
      }
    } catch (error) {
      console.error('Failed to calculate segment counts:', error);
      // Set fallback counts to prevent inconsistency
      setSegmentCounts({ urgent_response: 0, churn_risk: 0, competitive_threat: 0, contract_related: 0, revenue_opportunity: 0, other: 0 });
    }
  }, []);

  // Only calculate segment counts once when component mounts
  useEffect(() => {
    calculateTotalSegmentCounts();
  }, [calculateTotalSegmentCounts]);

  const aiSegments = useMemo(() => {
    return [
      { label: 'urgent_response', name: '緊急対応', count: segmentCounts.urgent_response, color: 'bg-red-500 text-white', icon: AlertTriangle },
      { label: 'churn_risk', name: '解約リスク', count: segmentCounts.churn_risk, color: 'bg-orange-500 text-white', icon: AlertCircle },
      { label: 'competitive_threat', name: '競合脅威', count: segmentCounts.competitive_threat, color: 'bg-yellow-500 text-white', icon: Shield },
      { label: 'contract_related', name: '契約関連', count: segmentCounts.contract_related, color: 'bg-blue-500 text-white', icon: Clock },
      { label: 'revenue_opportunity', name: '売上機会', count: segmentCounts.revenue_opportunity, color: 'bg-green-500 text-white', icon: Target },
      { label: 'other', name: 'その他', count: segmentCounts.other, color: 'bg-gray-500 text-white', icon: AlertCircle },
    ] as const;
  }, [segmentCounts]);

  const openDetail = useCallback(async (alert: Alert) => {
    try {
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

  const handleSegmentClick = (segmentLabel: string) => {
    const key = segmentLabel as SegmentKey;
    setSegmentFilter(current => current === key ? null : key);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        title="アラート管理" 
        description="NLP感情分析によるセグメント検知システム (データ期間: 2025/7/7-7/14)"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Segments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AIセグメント
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiSegments.map((seg) => {
                const Icon = seg.icon;
                const isActive = segmentFilter === seg.label;
                return (
                  <button
                    key={seg.label}
                    onClick={() => handleSegmentClick(seg.label)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      isActive 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{seg.name}</span>
                      </div>
                      <Badge className={seg.color}>{seg.count}</Badge>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          <FilterBar 
            filters={mergedFilters} 
            onFiltersChange={handleFilterChange}
            hidePeriod={true} // Hide period filter since data is fixed
          />

          {/* Status Info */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {filteredAlerts.length}/{total} 件表示
            </span>
            {segmentFilter && (
              <Badge variant="outline" className="text-sm">
                フィルター: {aiSegments.find(s => s.label === segmentFilter)?.name}
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
          ) : (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => {
                const riskScore = alert.detection_score || alert.urgencyScore || 0;
                const riskLevel = getRiskLevel(riskScore);
                // APIから返される担当者情報を優先、フォールバックで抽出関数を使用
                const assigneeEmail = alert.assignee || extractAssigneeEmail(alert);
                const shouldShowSegments = true; // APIでフィルタ済みのため、全て表示
                
                return (
                  <div key={alert.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(alert)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">
                            <HighlightText 
                              text={alert.subject || '件名なし'} 
                              keywords={alert.highlightKeywords || []}
                            />
                          </h3>
                          <Badge className={riskLevel.color}>
                            {riskLevel.label}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>顧客: {alert.customer}</span>
                            <span>担当者: {assigneeEmail || '未割り当て'}</span>
                            <span>更新: {new Date(alert.updated_at).toLocaleDateString('ja-JP')}</span>
                          </div>
                          
                          {/* 検知理由の詳細表示は削除（モーダルで確認可能） */}
                          
                          {shouldShowSegments && alert.primarySegment && (
                            <div className="flex gap-2 items-center">
                              {(() => {
                                const segment = aiSegments.find(s => s.label === alert.primarySegment);
                                return segment ? (
                                  <Badge className={segment.color} variant="secondary">
                                    {segment.name}
                                  </Badge>
                                ) : null;
                              })()}
                              {/* セグメント信頼度は削除（詳細はモーダルで確認） */}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        <div className="text-2xl font-bold text-red-600 mb-1">
                          {riskScore}
                        </div>
                        <div className="text-xs text-gray-500">リスクスコア</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
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
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
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
        />
      )}
    </div>
  );
} 
