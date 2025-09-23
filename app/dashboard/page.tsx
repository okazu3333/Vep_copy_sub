'use client';

import { useEffect, useMemo, useState } from 'react';
import { KPICard } from '@/components/dashboard/KPICard';
import { TimeSeriesChart } from '@/components/dashboard/TimeSeriesChart';
import { ThreeLevelAlertChart } from '@/components/dashboard/ThreeLevelAlertChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockKPI, mockTimeSeriesData } from '@/lib/mock-data';
import { FileDown, FileText, Brain, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { useDashboardSnapshot } from '@/hooks/use-dashboard-snapshots';
import { toast } from 'sonner';

interface ReportData {
  currentStatus: {
    totalAlerts: number;
    pendingCases: number;
    inProgressCases: number;
    resolvedCases: number;
    todayNewCases: number;
  };
  priorityDistribution: Array<{ priority: string; count: number }>;
  detectionPatterns: {
    totalAlerts: number;
    detectedAlerts: number;
    undetectedAlerts: number;
    avgScore: number;
    totalThreads: number;
    rootMessages: number;
    replyMessages: number;
    departments: Array<{ department: string; count: number }>;
    riskLevels: Array<{ riskLevel: string; count: number }>;
  };
  staffAnalysis: {
    topPerformers: Array<{ name: string; totalCases: number; avgScore: number; avgThreadLength: number; urgentCases: number; highPriorityCases: number; mediumPriorityCases: number; lowPriorityCases: number }>
    summary: { totalStaff: number; avgCasesPerStaff: number; totalCases: number; highLoadStaff: number; mediumLoadStaff: number; lowLoadStaff: number }
  }
}

export default function DashboardPage() {
  const { snapshot, save, clear } = useDashboardSnapshot();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExportPDF = () => {
    toast('PDFレポートの生成を開始しました', { description: '数秒でダウンロード準備が整います（モック）' });
  };

  const handleExportPPT = () => {
    toast('PowerPointレポートの生成を開始しました', { description: '数秒でダウンロード準備が整います（モック）' });
  };

  const handleSnapshot = () => {
    save({
      takenAt: Date.now(),
      kpis: {
        criticalAlerts: report?.currentStatus?.pendingCases ?? mockKPI.critical_alerts,
        negativeRatio: (report?.detectionPatterns?.detectedAlerts ?? 0) / Math.max((report?.detectionPatterns?.totalAlerts ?? 1), 1),
        topDepartment: report?.detectionPatterns?.departments?.[0]?.department ?? mockKPI.department_rankings[0].department,
        topDepartmentCount: report?.detectionPatterns?.departments?.[0]?.count ?? mockKPI.department_rankings[0].alert_count,
      },
    });
    toast.success('スナップショットを保存しました');
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const resp = await fetch('/api/reports', { headers: { 'Authorization': `Basic ${btoa('cmgadmin:crossadmin')}` } });
        if (!resp.ok) throw new Error(`Failed ${resp.status}`);
        const json = await resp.json();
        if (json?.success) setReport(json.data as ReportData);
      } catch (e) {
        console.error('Load reports error', e);
        setReport(null);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const kpi1 = useMemo(() => report?.currentStatus?.totalAlerts ?? mockKPI.critical_alerts, [report]);
  const negativeRatio = useMemo(() => {
    if (!report) return mockKPI.negative_ratio;
    const total = report.detectionPatterns.totalAlerts;
    const detected = report.detectionPatterns.detectedAlerts;
    return total > 0 ? detected / total : 0;
  }, [report]);
  const topDept = useMemo(() => report?.detectionPatterns?.departments?.[0]?.department ?? mockKPI.department_rankings[0].department, [report]);
  const topDeptCount = useMemo(() => report?.detectionPatterns?.departments?.[0]?.count ?? mockKPI.department_rankings[0].alert_count, [report]);

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-gray-600 mt-2">SalesGuardシステムの全体状況</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={handleExportPDF} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            PDF出力
          </Button>
          <Button onClick={handleExportPPT} variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            PPT出力
          </Button>
          <Button onClick={handleSnapshot}>🧷 スナップショット保存</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard
          title="総アラート数"
          value={kpi1}
          subtitle="集計期間: 直近"
          icon={<AlertTriangle className="h-5 w-5" />}
          className="border-l-4 border-l-blue-500"
        />
        
        <KPICard
          title="ネガティブ比率"
          value={`${(negativeRatio * 100).toFixed(1)}%`}
          subtitle="検知済み/全体"
          icon={<TrendingUp className="h-5 w-5" />}
          className="border-l-4 border-l-orange-500"
        />
        
        <KPICard
          title="トップ部署"
          value={topDept}
          subtitle={`${topDeptCount}件のアラート`}
          icon={<Users className="h-5 w-5" />}
          className="border-l-4 border-l-blue-500"
        />
      </div>

      {/* Charts */}
      <TimeSeriesChart data={mockTimeSeriesData} />

      {/* Three Level Alert Analysis with real data */}
      <ThreeLevelAlertChart
        departments={report?.detectionPatterns?.departments}
        riskLevels={report?.detectionPatterns?.riskLevels}
        personalTop={report?.staffAnalysis?.topPerformers?.map(p => ({ name: p.name, alerts: p.totalCases, department: '', lastAlert: '', severity: p.totalCases > 12 ? 'high' : p.totalCases > 8 ? 'medium' : 'low' }))}
      />

      {/* エグゼクティブサマリ削除済み */}
    </div>
  );
}
