'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCard } from '@/components/alerts/AlertCard';
import { AlertDetail } from '@/components/alerts/AlertDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, EmailThread } from '@/types';
import { AlertTriangle, Brain, Shield, Target, Zap, ChevronLeft, ChevronRight, Clock, AlertCircle, CheckCircle } from 'lucide-react';
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

// 内部ドメインリスト
const INTERNAL_DOMAINS = [
  'fittio.co.jp', 'gra-m.com', 'withwork.co.jp', 'cross-c.co.jp',
  'propworks.co.jp', 'cross-m.co.jp', 'cm-group.co.jp', 'shoppers-eye.co.jp',
  'd-and-m.co.jp', 'medi-l.com', 'metasite.co.jp', 'infidex.co.jp',
  'excrie.co.jp', 'alternaex.co.jp', 'cmg.traffics.jp', 'tokyogets.com',
  'pathcrie.co.jp', 'reech.co.jp'
];

// Helper function to safely get phrases as an array
const getPhrasesAsArray = (phrases: string[] | string | null | undefined): string[] => {
  if (!phrases) return [];
  if (Array.isArray(phrases)) return phrases.filter(p => typeof p === 'string');
  if (typeof phrases === 'string') return [phrases];
  return [];
};

// Enhanced risk scoring logic
const calculateRiskScore = (alert: Alert): number => {
  let score = 0;
  
  // Base score from sentiment
  if (alert.sentiment_score) {
    if (alert.sentiment_score < -0.6) score += 40;
    else if (alert.sentiment_score < -0.3) score += 25;
    else if (alert.sentiment_score < 0) score += 10;
  }
  
  // Segment-based scoring
  if (alert.segments) {
    if (alert.segments.lose) score += 35; // 失注・解約は最高リスク
    if (alert.segments.rival) score += 20; // 競合比較
    if (alert.segments.addreq) score += 15; // 追加要望
    if (alert.segments.renewal) score += 10; // 更新・継続
  }
  
  // Keyword-based scoring - Use helper function
  const phrasesArray = getPhrasesAsArray(alert.phrases);
  if (phrasesArray.length > 0) {
    const highRiskKeywords = ['解約', 'キャンセル', '中止', '不満', '問題', 'トラブル'];
    const mediumRiskKeywords = ['検討', '比較', '見直し', '変更'];
    
    phrasesArray.forEach(phrase => {
      if (highRiskKeywords.some(keyword => phrase.includes(keyword))) {
        score += 15;
      } else if (mediumRiskKeywords.some(keyword => phrase.includes(keyword))) {
        score += 8;
      }
    });
  }
  
  // Negative flag bonus
  if (alert.negative_flag) score += 10;
  
  return Math.min(score, 100); // Cap at 100
};

// Generate risk summary based on detected patterns
const generateDetectionReason = (alert: Alert): string => {
  const reasons: string[] = [];
  
  // キーワード検知理由 - Use helper function
  const phrasesArray = getPhrasesAsArray(alert.phrases);
  if (phrasesArray.length > 0) {
    const highRiskKeywords = ['解約', 'キャンセル', '中止', '不満', '問題', 'トラブル'];
    const mediumRiskKeywords = ['検討', '比較', '見直し', '変更'];
    
    const highRiskFound = phrasesArray.filter(phrase => 
      highRiskKeywords.some(keyword => phrase.includes(keyword))
    );
    const mediumRiskFound = phrasesArray.filter(phrase => 
      mediumRiskKeywords.some(keyword => phrase.includes(keyword))
    );
    
    if (highRiskFound.length > 0) {
      reasons.push(`高リスクキーワード「${highRiskFound.slice(0, 2).join('、')}」を検知`);
    } else if (mediumRiskFound.length > 0) {
      reasons.push(`注意キーワード「${mediumRiskFound.slice(0, 2).join('、')}」を検知`);
    }
  }
  
  // 感情分析理由
  if (alert.sentiment_score && alert.sentiment_score < -0.3) {
    reasons.push(`ネガティブ感情を検知（スコア: ${alert.sentiment_score.toFixed(2)}）`);
  }
  
  // セグメント検知理由
  if (alert.segments) {
    if (alert.segments.lose) reasons.push('失注・解約パターンを検知');
    if (alert.segments.rival) reasons.push('競合比較パターンを検知');
    if (alert.segments.addreq) reasons.push('追加要望パターンを検知');
    if (alert.segments.renewal) reasons.push('更新・継続パターンを検知');
  }
  
  // ネガティブフラグ
  if (alert.negative_flag) {
    reasons.push('ネガティブフラグが設定されています');
  }
  
  return reasons.length > 0 ? reasons.join('、') : 'リスク要因が特定されていません';
};

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
  const internalDomains = [
    'fittio.co.jp', 'gra-m.com', 'withwork.co.jp', 'cross-c.co.jp',
    'propworks.co.jp', 'cross-m.co.jp', 'cm-group.co.jp', 'shoppers-eye.co.jp',
    'd-and-m.co.jp', 'medi-l.com', 'metasite.co.jp', 'infidex.co.jp',
    'excrie.co.jp', 'alternaex.co.jp', 'cmg.traffics.jp', 'tokyogets.com',
    'pathcrie.co.jp', 'reech.co.jp'
  ];

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

// 顧客名から内部ドメインを除外
const isExternalCustomer = (customer: string): boolean => {
  const domain = customer.split('@')[1];
  return !domain || !INTERNAL_DOMAINS.includes(domain);
};

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
    if (params.get('department')) { next.department = params.get('department')!; changed = true; }
    if (params.get('severity')) { next.severity = params.get('severity')!; changed = true; }
    if (params.get('status')) { next.status = params.get('status')!; changed = true; }
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
    period: 'all', // Fixed since data is 2025/7/7-7/14
    status: filters.status,
    search: searchQuery,
  };

  const severityToLevel = (sev: string) => sev === 'A' ? 'high' : sev === 'B' ? 'medium' : sev === 'C' ? 'low' : '';
  const levelToSeverity = (lvl?: string) => lvl === 'high' ? 'A' : lvl === 'medium' ? 'B' : 'C';
  const levelToSentiment = (lvl?: string) => lvl === 'high' ? -0.8 : lvl === 'medium' ? -0.4 : 0.2;

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filters.status !== 'all') params.set('status', filters.status === 'unhandled' ? '新規' : filters.status === 'in_progress' ? '対応中' : '解決済み');
      if (filters.severity !== 'all') params.set('level', severityToLevel(filters.severity));
      params.set('limit', '20');
      params.set('page', String(page));
      params.set('light', '1');
      // Note: Date filtering removed since data is fixed to 2025/7/7-7/14
      
      const resp = await fetch(`/api/alerts?${params.toString()}`);
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
        
        // 顧客名から内部ドメインを除外
        const rawCustomer = String(row.customer_name ?? row.customerEmail ?? row.person ?? 'Unknown');
        const customer = isExternalCustomer(rawCustomer) ? rawCustomer : 'External Customer';
        
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
          detection_score: typeof row.detection_score === 'number' ? row.detection_score : (typeof row.score === 'number' ? Math.round((row.score as number) * 100) : undefined),
          assignee: typeof row.assignee === 'string' ? row.assignee : undefined,
          phrases: keywordPhrases,
          threadId: typeof row.threadId === 'string' ? row.threadId : (typeof row.thread_id === 'string' ? row.thread_id : null),
          messageId: typeof row.message_id === 'string' ? row.message_id : null,
          sentiment_label: (typeof row.sentiment_label === 'string' && ['positive', 'neutral', 'negative'].includes(row.sentiment_label)) 
            ? row.sentiment_label as 'positive' | 'neutral' | 'negative' 
            : null,
          negative_flag: Boolean(row.negative_flag),
          segments,
        };
        
        // Calculate enhanced risk score
        alert.detection_score = calculateRiskScore(alert);
        
        return alert;
      });
      setAlerts(mapped);
      
      // Calculate filtered count for pagination
      const filteredMapped = mapped.filter(alert => {
        const riskScore = calculateRiskScore(alert);
        return riskScore >= 30; // Only high-risk alerts
      });
      
      const pg = data?.pagination;
      if (pg) {
        // Use filtered count instead of raw total
        const filteredTotal = Math.ceil(filteredMapped.length * (Number(pg.total || 0) / Math.max(mapped.length, 1)));
        setTotal(filteredTotal);
        setTotalPages(Math.ceil(filteredTotal / 20));
      } else {
        setTotal(filteredMapped.length);
        setTotalPages(Math.ceil(filteredMapped.length / 20));
      }
      if (data?.segmentCounts) {
        setSegmentCounts({
          lose: Number(data.segmentCounts.lose || 0),
          rival: Number(data.segmentCounts.rival || 0),
          addreq: Number(data.segmentCounts.addreq || 0),
          renewal: Number(data.segmentCounts.renewal || 0)
        });
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters.status, filters.severity, page]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Update URL when filters change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextParams = new URLSearchParams();
    if (filters.department !== 'all') nextParams.set('department', filters.department);
    if (filters.severity !== 'all') nextParams.set('severity', filters.severity);
    if (filters.status !== 'all') nextParams.set('status', filters.status);
    if (searchQuery) nextParams.set('search', searchQuery);
    if (page > 1) nextParams.set('page', String(page));
    const newUrl = `${window.location.pathname}${nextParams.toString() ? '?' + nextParams.toString() : ''}`;
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [filters.status, filters.severity, filters.department, filters.customer, searchQuery, page]);

  // Filter alerts based on current filters and segment selection
  const filteredAlerts = useMemo(() => {
    let filtered = alerts.filter(alert => {
      const riskScore = calculateRiskScore(alert);
      
      // Only show high-risk alerts (score >= 30) - this is the key filter
      if (riskScore < 30) return false;
      
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

    // Apply segment filter - only for high-risk alerts that are already filtered above
    if (segmentFilter) {
      filtered = filtered.filter(alert => {
        return alert.segments?.[segmentFilter];
      });
    }

    return filtered;
  }, [alerts, segmentFilter, searchQuery]);

  // Calculate segment counts - total counts across all alerts, not just current page
  const calculateTotalSegmentCounts = useCallback(async () => {
    try {
      // Use a dedicated API call to get consistent segment counts
      const resp = await fetch('/api/alerts?segment_counts_only=true&limit=10000'); 
      const json = await resp.json();
      
      if (json?.success && json.alerts) {
        const counts = { lose: 0, rival: 0, addreq: 0, renewal: 0 };
        
        json.alerts.forEach((alert: Alert) => {
          const riskScore = calculateRiskScore(alert);
          // Only count segments for alerts that are detected AND classified into segments
          if (riskScore >= 30 && alert.segments) {
            if (alert.segments.lose) counts.lose++;
            if (alert.segments.rival) counts.rival++;
            if (alert.segments.addreq) counts.addreq++;
            if (alert.segments.renewal) counts.renewal++;
          }
        });
        
        setSegmentCounts(counts);
      }
    } catch (error) {
      console.error('Failed to calculate segment counts:', error);
      // Set fallback counts to prevent inconsistency
      setSegmentCounts({ lose: 0, rival: 0, addreq: 0, renewal: 0 });
    }
  }, []);

  // Only calculate segment counts once when component mounts
  useEffect(() => {
    calculateTotalSegmentCounts();
  }, []); // Remove dependency to prevent recalculation

  // セグメント表示は高リスクのもののみ
  const highRiskAlerts = useMemo(() => {
    return filteredAlerts.filter(alert => {
      const riskScore = alert.detection_score || 0;
      return riskScore >= 30; // 注意レベル以上のみセグメント表示
    });
  }, [filteredAlerts]);

  const aiSegments = useMemo(() => {
    return [
      { label: 'lose', name: '失注・解約', count: segmentCounts.lose, color: 'bg-red-500 text-white', icon: AlertTriangle },
      { label: 'rival', name: '競合比較', count: segmentCounts.rival, color: 'bg-orange-500 text-white', icon: Shield },
      { label: 'addreq', name: '追加要望', count: segmentCounts.addreq, color: 'bg-blue-500 text-white', icon: Target },
      { label: 'renewal', name: '更新・継続', count: segmentCounts.renewal, color: 'bg-green-500 text-white', icon: Zap },
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
      department: newFilters.department,
      customer: newFilters.customer,
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
                const riskScore = alert.detection_score || 0;
                const riskLevel = getRiskLevel(riskScore);
                const detectionReason = generateDetectionReason(alert);
                const assigneeEmail = extractAssigneeEmail(alert);
                const shouldShowSegments = riskScore >= 30; // 注意レベル以上のみセグメント表示
                
                return (
                  <div key={alert.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(alert)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{alert.subject || '件名なし'}</h3>
                          <Badge className={riskLevel.color}>
                            {riskLevel.label}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>顧客: {alert.customer}</span>
                            <span>担当者: {assigneeEmail}</span>
                          </div>
                          
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">検知理由: </span>
                            <span className="text-gray-600">{detectionReason}</span>
                          </div>
                          
                          {shouldShowSegments && alert.segments && (
                            <div className="flex gap-2">
                              {Object.entries(alert.segments).map(([key, value]) => {
                                if (!value) return null;
                                const segment = aiSegments.find(s => s.label === key);
                                return segment ? (
                                  <Badge key={key} className={segment.color} variant="secondary">
                                    {segment.name}
                                  </Badge>
                                ) : null;
                              })}
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