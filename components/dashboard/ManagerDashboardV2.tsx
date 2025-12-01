'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Users,
  TrendingUp,
  BarChart3,
  PieChart,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert } from '@/types';
import { DUMMY_MEMBERS } from '@/data/mock/dummyMembers';
import { DUMMY_ALERTS } from '@/data/mock/dummyAlerts';
import { SEGMENT_META, SEGMENT_ORDER, type SegmentKey } from '@/lib/segments';

import { formatOwnerLabel } from '@/lib/owner-labels';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MemberCustomerRelation {
  memberEmail: string;
  memberName: string;
  customer: string;
  alertCount: number;
  lastInteraction: string;
  avgSentiment: number;
  urgentAlerts: number;
}

interface SegmentAlertCount {
  segment: SegmentKey;
  count: number;
  members: Array<{
    memberEmail: string;
    memberName: string;
    count: number;
  }>;
}

interface UrgentAlert {
  id: string;
  subject: string;
  customer: string;
  assignee: string;
  assigneeName: string;
  severity: 'A' | 'B' | 'C';
  urgencyScore: number;
  segment: SegmentKey | null;
  updated_at: string;
  status: 'unhandled' | 'in_progress' | 'completed';
}

export function ManagerDashboardV2() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMember, setActiveMember] = useState<string | null>(null);
  const [recentFilter, setRecentFilter] = useState<'all' | 'unhandled'>('all');
  const [showAllUrgent, setShowAllUrgent] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('manager-dashboard-active-member');
    if (saved) {
      setActiveMember(saved);
    }
  }, []);

  useEffect(() => {
    // ダミーデータを読み込む（即座に設定）
    const timer = setTimeout(() => {
      if (DUMMY_ALERTS?.length) {
        setAlerts(DUMMY_ALERTS);
      } else {
        setAlerts([]);
      }
      setLoading(false);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const mergeAlerts = (current: Alert[], incoming: Alert[]) => {
      const map = new Map(current.map((alert) => [alert.id, alert]));
      incoming.forEach((alert) => map.set(alert.id, alert));
      return Array.from(map.values());
    };

    const fetchRuntimeAlerts = async () => {
      try {
        const res = await fetch('/api/events', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.alerts) && data.alerts.length > 0) {
          setAlerts((prev) => mergeAlerts(prev, data.alerts));
        }
      } catch (error) {
        console.warn('Failed to fetch runtime alerts', error);
      }
    };

    fetchRuntimeAlerts();
    const interval = setInterval(fetchRuntimeAlerts, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeMember) {
      window.localStorage.setItem('manager-dashboard-active-member', activeMember);
    } else {
      window.localStorage.removeItem('manager-dashboard-active-member');
    }
  }, [activeMember]);

  // クライアント-メンバー関係性データ（最適化）
  const memberCustomerRelations = useMemo(() => {
    if (alerts.length === 0) return [];
    
    const relations = new Map<string, MemberCustomerRelation>();
    const memberMap = new Map(DUMMY_MEMBERS.map(m => [m.email, m]));

    for (const alert of alerts) {
      if (!alert.assignee || !alert.customer) continue;

      const key = `${alert.assignee}|${alert.customer}`;
      const member = memberMap.get(alert.assignee);
      const memberName = member?.name || alert.assignee;

      if (!relations.has(key)) {
        relations.set(key, {
          memberEmail: alert.assignee,
          memberName,
          customer: alert.customer,
          alertCount: 0,
          lastInteraction: alert.updated_at,
          avgSentiment: 0,
          urgentAlerts: 0,
        });
      }

      const relation = relations.get(key)!;
      relation.alertCount += 1;
      relation.avgSentiment += alert.sentiment_score || 0;
      if (alert.severity === 'A' || (alert.urgencyScore && alert.urgencyScore > 70)) {
        relation.urgentAlerts += 1;
      }
      const alertDate = new Date(alert.updated_at).getTime();
      const relationDate = new Date(relation.lastInteraction).getTime();
      if (alertDate > relationDate) {
        relation.lastInteraction = alert.updated_at;
      }
    }

    // 平均感情スコアを計算
    const relationsArray = Array.from(relations.values());
    for (const relation of relationsArray) {
      if (relation.alertCount > 0) {
        relation.avgSentiment = relation.avgSentiment / relation.alertCount;
      }
    }

    return relationsArray.sort((a, b) => b.alertCount - a.alertCount);
  }, [alerts]);

  const memberCompanyChart = useMemo(() => {
    if (memberCustomerRelations.length === 0) {
      return { members: [] };
    }

    const distribution = new Map<
      string,
      { memberEmail: string; memberName: string; total: number; companies: Array<{ customer: string; count: number }> }
    >();

    for (const relation of memberCustomerRelations) {
      if (!distribution.has(relation.memberEmail)) {
        distribution.set(relation.memberEmail, {
          memberEmail: relation.memberEmail,
          memberName: relation.memberName,
          total: 0,
          companies: [],
        });
      }

      const memberEntry = distribution.get(relation.memberEmail)!;
      memberEntry.total += relation.alertCount;
      memberEntry.companies.push({
        customer: relation.customer,
        count: relation.alertCount,
      });
    }

    const members = Array.from(distribution.values())
      .map((entry) => ({
        ...entry,
        companies: entry.companies.sort((a, b) => b.count - a.count).slice(0, 5),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    return { members };
  }, [memberCustomerRelations]);

  useEffect(() => {
    if (memberCompanyChart.members.length === 0) {
      if (activeMember !== null) {
        setActiveMember(null);
      }
      return;
    }

    if (!activeMember || !memberCompanyChart.members.some((member) => member.memberEmail === activeMember)) {
      setActiveMember(memberCompanyChart.members[0].memberEmail);
    }
  }, [memberCompanyChart.members, activeMember]);

  const activeMemberData = useMemo(() => {
    if (!activeMember) return null;
    return memberCompanyChart.members.find((member) => member.memberEmail === activeMember) ?? null;
  }, [memberCompanyChart.members, activeMember]);

  const activeMemberMax = useMemo(() => {
    if (!activeMemberData || activeMemberData.companies.length === 0) {
      return 1;
    }
    return activeMemberData.companies.reduce((max, company) => Math.max(max, company.count), 1);
  }, [activeMemberData]);

  // セグメント別アラート数（最適化）
  const segmentAlertCounts = useMemo(() => {
    if (alerts.length === 0) return [];
    
    const segmentMap = new Map<SegmentKey, SegmentAlertCount>();
    const memberMap = new Map(DUMMY_MEMBERS.map(m => [m.email, m]));
    const memberCounts = new Map<string, Map<SegmentKey, number>>();

    // セグメントマップを初期化
    for (const segment of SEGMENT_ORDER) {
      segmentMap.set(segment, {
        segment,
        count: 0,
        members: [],
      });
    }

    // アラートを処理
    for (const alert of alerts) {
      if (!alert.primarySegment || !alert.assignee) continue;

      const segment = alert.primarySegment;
      const segmentData = segmentMap.get(segment);
      if (segmentData) {
        segmentData.count += 1;

        if (!memberCounts.has(alert.assignee)) {
          memberCounts.set(alert.assignee, new Map());
        }
        const memberSegments = memberCounts.get(alert.assignee)!;
        memberSegments.set(segment, (memberSegments.get(segment) || 0) + 1);
      }
    }

    // メンバー別のセグメント数を集計
    for (const [memberEmail, segments] of memberCounts.entries()) {
      const member = memberMap.get(memberEmail);
      const memberName = member?.name || memberEmail;

      for (const [segment, count] of segments.entries()) {
        const segmentData = segmentMap.get(segment);
        if (segmentData) {
          const existingMember = segmentData.members.find(m => m.memberEmail === memberEmail);
          if (existingMember) {
            existingMember.count += count;
          } else {
            segmentData.members.push({
              memberEmail,
              memberName,
              count,
            });
          }
        }
      }
    }

    return Array.from(segmentMap.values())
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [alerts]);

  // 緊急度の高いアラートリスト（最適化）
  const urgentAlerts = useMemo(() => {
    if (alerts.length === 0) return [];
    
    const memberMap = new Map(DUMMY_MEMBERS.map(m => [m.email, m]));
    const urgent: UrgentAlert[] = [];

    for (const alert of alerts) {
      if (!alert.assignee) continue;
      
      const isUrgent = alert.severity === 'A' || 
                      (alert.urgencyScore && alert.urgencyScore > 70) ||
                      alert.status === 'unhandled';
      
      if (isUrgent) {
        const member = memberMap.get(alert.assignee);
        urgent.push({
          id: alert.id,
          subject: alert.subject,
          customer: alert.customer,
          assignee: alert.assignee,
          assigneeName: member?.name || alert.assignee,
          severity: alert.severity,
          urgencyScore: alert.urgencyScore || 0,
          segment: alert.primarySegment || null,
          updated_at: alert.updated_at,
          status: alert.status,
        });
      }
    }

    // ソート: 緊急度スコアでソート、次に更新日時
    urgent.sort((a, b) => {
      if (b.urgencyScore !== a.urgencyScore) {
        return b.urgencyScore - a.urgencyScore;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return urgent.slice(0, 10); // トップ10
  }, [alerts]);
  const displayedUrgentAlerts = useMemo(() => {
    if (showAllUrgent) {
      return urgentAlerts;
    }
    return urgentAlerts.slice(0, 3);
  }, [urgentAlerts, showAllUrgent]);

  const followAlerts = useMemo(() => {
    return alerts
      .filter((alert) => alert.primarySegment === 'follow')
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      .slice(0, 5)
      .map((alert) => ({
        id: alert.id,
        subject: alert.subject,
        customer: alert.customer,
        updatedAt: alert.updated_at,
        summary: alert.ai_summary || alert.body_preview || '',
        assignee: formatOwnerLabel(alert.assignee || ''),
        status: alert.status,
      }));
  }, [alerts]);
  const recentUpdates = useMemo(() => {
    if (alerts.length === 0) return [];

    return [...alerts]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 12)
      .map((alert) => ({
        id: alert.id,
        subject: alert.subject,
        assigneeName: formatOwnerLabel(alert.assignee || ''),
        updatedAt: alert.updated_at,
        status: alert.status,
        segment: alert.primarySegment || null,
      }));
  }, [alerts]);

  const filteredRecentUpdates = useMemo(() => {
    if (recentFilter === 'unhandled') {
      return recentUpdates.filter((alert) => alert.status === 'unhandled');
    }
    return recentUpdates;
  }, [recentUpdates, recentFilter]);

  // グラフ用データ（最適化）
  const segmentTopSegments = useMemo(() => {
    return segmentAlertCounts.slice(0, 3).map((segment) => ({
      key: segment.segment,
      label: SEGMENT_META[segment.segment]?.label || segment.segment,
      count: segment.count,
    }));
  }, [segmentAlertCounts]);
  const segmentTopList = useMemo(() => {
    return segmentAlertCounts.slice(0, 5);
  }, [segmentAlertCounts]);
  const segmentMaxCount = useMemo(() => {
    return segmentTopList[0]?.count || 1;
  }, [segmentTopList]);

  const memberAlertChartData = useMemo(() => {
    if (alerts.length === 0) return [];
    
    const memberCountMap = new Map<string, number>();
    const memberMap = new Map(DUMMY_MEMBERS.map(m => [m.email, m]));

    for (const alert of alerts) {
      if (alert.assignee) {
        memberCountMap.set(alert.assignee, (memberCountMap.get(alert.assignee) || 0) + 1);
      }
    }

    const result = Array.from(memberCountMap.entries())
      .map(([email, count]) => {
        const member = memberMap.get(email);
        return {
          name: member?.name || email,
          count,
        };
      })
      .sort((a, b) => b.count - a.count);
    
    return result;
  }, [alerts]);
  const memberAlertChartDisplay = useMemo(() => {
    if (memberAlertChartData.length === 0) return [];
    const top = memberAlertChartData.slice(0, 5);
    const others = memberAlertChartData.slice(5);
    const otherTotal = others.reduce((sum, item) => sum + item.count, 0);
    if (otherTotal > 0) {
      top.push({ name: 'その他', count: otherTotal });
    }
    return top;
  }, [memberAlertChartData]);

  const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

  // KPI統計（最適化）
  const kpiStats = useMemo(() => {
    let unhandled = 0;
    let inProgress = 0;
    let completed = 0;
    let activeMembers = new Set<string>();

    for (const alert of alerts) {
      if (alert.status === 'unhandled') unhandled++;
      else if (alert.status === 'in_progress') inProgress++;
      else if (alert.status === 'completed') completed++;
      
      if (alert.assignee) {
        activeMembers.add(alert.assignee);
      }
    }

    return {
      total: alerts.length,
      unhandled,
      inProgress,
      completed,
      activeMembers: activeMembers.size,
    };
  }, [alerts]);

  // 前日比を計算（モックデータ）
  const previousStats = useMemo(() => {
    return {
      total: Math.floor(kpiStats.total * 0.95),
      unhandled: Math.floor(kpiStats.unhandled * 1.1),
      inProgress: Math.floor(kpiStats.inProgress * 0.9),
      activeMembers: kpiStats.activeMembers,
    };
  }, [kpiStats]);

  // タイムアウト処理を追加
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout, forcing loading to false');
        setLoading(false);
      }
    }, 3000); // 3秒でタイムアウト

    return () => clearTimeout(timeout);
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">データを読み込み中...</p>
          <p className="text-sm text-gray-500 mt-2">しばらくお待ちください</p>
        </div>
      </div>
    );
  }

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, isPositive: true };
    const diff = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(diff).toFixed(1),
      isPositive: diff >= 0,
    };
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pb-2">
        <div>
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] text-slate-400 mb-1">Overview</p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">管理者ダッシュボード</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-2">配下メンバーの状態とアラート状況を一覧表示</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 border border-slate-200 rounded-full px-4 py-2 bg-white shadow-sm hover:shadow-md transition-shadow">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">最終更新</span>
            <span className="text-sm font-bold text-slate-700">
              {new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* KPIカード */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Key Metrics</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card className="h-full border-l-4 border-l-red-500">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-600 mb-2">総アラート数</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">{kpiStats.total}件</p>
                  {(() => {
                    const trend = calculateTrend(kpiStats.total, previousStats.total);
                    return (
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-xs sm:text-sm font-semibold', trend.isPositive ? 'text-emerald-600' : 'text-red-600')}>
                          {trend.isPositive ? '↑' : '↓'}
                        </span>
                        <p className={cn('text-xs sm:text-sm font-semibold', trend.isPositive ? 'text-emerald-600' : 'text-red-600')}>
                          {trend.isPositive ? '+' : '-'}
                          {trend.value}%
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div className="p-2.5 bg-red-50 rounded-xl ml-3 flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full border-l-4 border-l-orange-500">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-600 mb-2">未対応</p>
                  <p className="text-2xl sm:text-3xl font-bold text-orange-600 mb-2">{kpiStats.unhandled}件</p>
                  {(() => {
                    const trend = calculateTrend(kpiStats.unhandled, previousStats.unhandled);
                    return (
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-xs sm:text-sm font-semibold', trend.isPositive ? 'text-emerald-600' : 'text-red-600')}>
                          {trend.isPositive ? '↑' : '↓'}
                        </span>
                        <p className={cn('text-xs sm:text-sm font-semibold', trend.isPositive ? 'text-emerald-600' : 'text-red-600')}>
                          {trend.isPositive ? '+' : '-'}
                          {trend.value}%
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div className="p-2.5 bg-orange-50 rounded-xl ml-3 flex-shrink-0">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full border-l-4 border-l-blue-500">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-600 mb-2">対応中</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">{kpiStats.inProgress}件</p>
                  {(() => {
                    const trend = calculateTrend(kpiStats.inProgress, previousStats.inProgress);
                    return (
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-xs sm:text-sm font-semibold', trend.isPositive ? 'text-emerald-600' : 'text-red-600')}>
                          {trend.isPositive ? '↑' : '↓'}
                        </span>
                        <p className={cn('text-xs sm:text-sm font-semibold', trend.isPositive ? 'text-emerald-600' : 'text-red-600')}>
                          {trend.isPositive ? '+' : '-'}
                          {trend.value}%
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div className="p-2.5 bg-blue-50 rounded-xl ml-3 flex-shrink-0">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full border-l-4 border-l-emerald-500">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-600 mb-2">アクティブメンバー</p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-600 mb-2">{kpiStats.activeMembers}名</p>
                  <p className="text-xs sm:text-sm text-slate-500">全メンバー中</p>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl ml-3 flex-shrink-0">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 営業 / セグメント可視化 */}
      <section className="space-y-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] text-slate-400 mb-1">Sales Insights</p>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">営業 / セグメント可視化</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* 営業ごとの会社別アラート分布 */}
          <Card className="lg:col-span-2 h-full">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <BarChart3 className="h-5 w-5" />
                営業別・会社別アラート本数
              </CardTitle>
              <p className="text-sm text-gray-500">
                営業タブを切り替えて主要取引先のボリュームを確認
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pb-2">
              {memberCompanyChart.members.length === 0 ? (
                <div className="text-center py-10 text-gray-500">関係性データがありません</div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 pb-1">
                    {memberCompanyChart.members.map((member) => (
                      <Button
                        key={member.memberEmail}
                        size="sm"
                        variant={activeMember === member.memberEmail ? 'default' : 'outline'}
                        onClick={() => setActiveMember(member.memberEmail)}
                        className={cn(
                          'text-xs px-3 py-1 whitespace-nowrap rounded-full',
                          activeMember === member.memberEmail ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white'
                        )}
                      >
                        {member.memberName}
                      </Button>
                    ))}
                  </div>
                  {activeMemberData ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                        <div>
                          <span className="font-semibold text-gray-900">{activeMemberData.memberName}</span>
                          <span className="ml-2 text-xs text-gray-500">{activeMemberData.memberEmail}</span>
                        </div>
                        <div>主要{activeMemberData.companies.length}社 / {activeMemberData.total}件</div>
                      </div>
                      {activeMemberData.companies.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">対象取引先がありません</div>
                      ) : (
                        <div className="flex items-end gap-4 sm:gap-5 h-72 pb-2">
                          {activeMemberData.companies.map((company, idx) => {
                            const heightPercent = (company.count / activeMemberMax) * 100;
                            const color = COLORS[idx % COLORS.length];
                            return (
                              <div
                                key={`${activeMemberData.memberEmail}-${company.customer}`}
                                className="flex-1 flex flex-col items-center min-w-0"
                              >
                                <div
                                  className="w-full rounded-t-lg relative overflow-visible transition-all hover:opacity-90"
                                  style={{
                                    height: `${Math.max(heightPercent, 5)}%`,
                                    backgroundColor: color,
                                    minHeight: heightPercent > 0 ? '20px' : '0',
                                  }}
                                >
                                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs sm:text-sm font-bold text-slate-900 whitespace-nowrap">
                                    {company.count}
                                  </span>
                                </div>
                                <span className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-center text-gray-700 font-medium break-words leading-tight px-0.5">
                                  {company.customer}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-500">表示できるデータがありません</div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* セグメント別アラート数 */}
          <Card className="lg:col-span-1 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <PieChart className="h-5 w-5" />
                セグメント別アラート数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {segmentAlertCounts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">セグメントデータがありません</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={segmentTopSegments} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} 
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={{ stroke: '#e2e8f0' }}
                        />
                        <YAxis 
                          allowDecimals={false} 
                          tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} 
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={{ stroke: '#e2e8f0' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '13px',
                            padding: '8px 12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          }}
                          labelStyle={{ fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}
                        />
                        <Bar 
                          dataKey="count" 
                          fill="#8b5cf6" 
                          radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fill: '#475569', fontSize: 11, fontWeight: 600 }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {segmentTopList.map((segment) => {
                        const percent = Math.round((segment.count / Math.max(segmentMaxCount, 1)) * 100);
                        return (
                          <div
                            key={segment.segment}
                            className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Badge className={cn('text-xs px-2.5 py-1 font-semibold', SEGMENT_META[segment.segment]?.badgeClass)}>
                                  {SEGMENT_META[segment.segment]?.label || segment.segment}
                                </Badge>
                                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{percent}%</span>
                              </div>
                              <span className="text-sm font-bold text-slate-900 whitespace-nowrap">{segment.count}件</span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span className="truncate font-medium">上位: {segment.members[0]?.memberName ?? '—'}</span>
                              {segment.members.length > 1 && <span className="font-medium">+{segment.members.length - 1}名</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* メンバー状況と最新更新 */}
      <section className="space-y-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] text-slate-400 mb-1">Team Activity</p>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">メンバー状況と最新更新</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* メンバー別アラート数グラフ */}
          <Card className="lg:col-span-2 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <BarChart3 className="h-5 w-5" />
                メンバー別アラート数
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-2">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={memberAlertChartDisplay} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={11}
                    tick={{ fill: '#64748b', fontWeight: 500 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis 
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={{ stroke: '#e2e8f0' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13px',
                      padding: '8px 12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#3b82f6" 
                    radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fill: '#475569', fontSize: 11, fontWeight: 600 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 最近の更新 */}
          <Card className="lg:col-span-1 h-full">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <MessageSquare className="h-5 w-5" />
                  最近の更新
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={recentFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setRecentFilter('all')}
                  className="text-xs"
                >
                  すべて
                </Button>
                <Button
                  size="sm"
                  variant={recentFilter === 'unhandled' ? 'default' : 'outline'}
                  onClick={() => setRecentFilter('unhandled')}
                  className="text-xs"
                >
                  要対応のみ
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {filteredRecentUpdates.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    <div className="p-2 bg-slate-100 rounded-lg flex-shrink-0">
                      <Clock className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 line-clamp-1 mb-2">{alert.subject}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2 font-medium">
                        <span>{alert.assigneeName || '未アサイン'}</span>
                        <span className="text-slate-300">•</span>
                        <span>
                          {new Date(alert.updatedAt).toLocaleDateString('ja-JP', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            alert.status === 'unhandled'
                              ? 'destructive'
                              : alert.status === 'in_progress'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-xs px-2 py-1 font-semibold"
                        >
                          {alert.status === 'unhandled' ? '要対応' : alert.status === 'in_progress' ? '対応中' : '解決済み'}
                        </Badge>
                        {alert.segment && (
                          <Badge
                            variant="outline"
                            className={cn('text-xs px-2 py-1 font-semibold', SEGMENT_META[alert.segment]?.badgeClass)}
                          >
                            {SEGMENT_META[alert.segment]?.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredRecentUpdates.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm font-medium">該当する更新はありません</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 案件状況 */}
      <section className="space-y-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] text-slate-400 mb-1">Pipeline</p>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">案件状況</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* フォロー中の案件 */}
          <Card className="lg:col-span-2 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Clock className="h-5 w-5" />
                フォロー中の案件
                <Badge variant="outline" className="ml-2">
                  {followAlerts.length}件
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {followAlerts.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm font-medium">フォロー中の案件はありません</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {followAlerts.map((alert) => {
                    const statusLabel =
                      alert.status === 'completed' ? '完了' : alert.status === 'in_progress' ? '対応中' : '未対応';
                    const statusClass =
                      alert.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : alert.status === 'in_progress'
                        ? 'bg-blue-50 text-blue-700 border border-blue-100'
                        : 'bg-orange-50 text-orange-700 border border-orange-100';
                    return (
                      <div key={alert.id} className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-slate-900 line-clamp-1 flex-1 min-w-0">{alert.subject}</span>
                          <Badge variant="outline" className="text-xs font-medium flex-shrink-0">
                            {new Date(alert.updatedAt).toLocaleDateString('ja-JP')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', statusClass)}>
                            {statusLabel}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">{alert.assignee || '担当未設定'}</span>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{alert.summary || 'サマリーがありません。'}</p>
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                          <span className="font-medium">{alert.customer || '取引先未設定'}</span>
                          <span className="font-bold text-slate-700">{formatOwnerLabel(alert.assignee || '')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 緊急度の高いアラートリスト */}
          <Card className="lg:col-span-1 h-full">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                緊急度の高いアラート
                <Badge variant="destructive" className="ml-2">
                  {urgentAlerts.length}件
                </Badge>
              </CardTitle>
              {urgentAlerts.length > 3 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAllUrgent((prev) => !prev)}
                  className="text-xs"
                >
                  {showAllUrgent ? 'トップ3だけ表示' : 'すべて表示'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {urgentAlerts.length === 0 ? (
                  <div className="text-center py-8 text-emerald-600 text-sm font-medium">緊急アラートはありません</div>
                ) : (
                  displayedUrgentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        'p-4 border-2 rounded-xl transition-all hover:shadow-sm',
                        alert.severity === 'A'
                          ? 'border-red-500 bg-red-50/50 hover:bg-red-50'
                          : alert.urgencyScore > 80
                          ? 'border-orange-500 bg-orange-50/50 hover:bg-orange-50'
                          : 'border-yellow-500 bg-yellow-50/50 hover:bg-yellow-50'
                      )}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <Badge variant={alert.severity === 'A' ? 'destructive' : 'default'} className="text-xs font-semibold">
                              {alert.severity === 'A' ? '緊急' : alert.severity === 'B' ? '重要' : '注意'}
                            </Badge>
                            {alert.segment && (
                              <Badge
                                variant="outline"
                                className={cn('text-xs font-semibold', SEGMENT_META[alert.segment]?.badgeClass)}
                              >
                                {SEGMENT_META[alert.segment]?.label}
                              </Badge>
                            )}
                            <span className="font-semibold text-sm text-slate-900 line-clamp-1 flex-1 min-w-0">{alert.subject}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-slate-400" />
                              <span className="font-medium">{alert.customer}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                              <span className="font-medium">担当: {alert.assigneeName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span className="font-medium">{new Date(alert.updated_at).toLocaleDateString('ja-JP')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right md:ml-4">
                          <div className="text-lg font-bold text-red-600">{alert.urgencyScore}</div>
                          <div className="text-xs text-gray-500">緊急度</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {!showAllUrgent && urgentAlerts.length > 3 && (
                  <p className="text-center text-xs text-gray-500">トップ3のみ表示中（全{urgentAlerts.length}件）</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
