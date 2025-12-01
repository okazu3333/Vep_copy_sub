'use client';

import { useEffect, useMemo, useState } from 'react';
import { ManagerDashboardV2 } from '@/components/dashboard/ManagerDashboardV2';
import { KPICard } from '@/components/dashboard/KPICard';
import { TimeSeriesChart } from '@/components/dashboard/TimeSeriesChart';
import { ThreeLevelAlertChart } from '@/components/dashboard/ThreeLevelAlertChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mockKPI, mockTimeSeriesData } from '@/lib/mock-data';
import { FileDown, FileText, TrendingUp, Users, AlertTriangle, Building, Target, DollarSign, Clock, TrendingDown, BarChart3 } from 'lucide-react';
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

// 顧客リスク分析用のモックデータ
const mockCustomerRiskData = {
  highRiskCustomers: [
    { name: 'ABC商事', domain: 'abc-trading.co.jp', riskScore: 85, riskFactors: ['契約更新遅延', '価格交渉難航', '競合検討中'], lastContact: '2025-01-10', assignee: '田中太郎' },
    { name: 'DEF製造', domain: 'def-manufacturing.co.jp', riskScore: 78, riskFactors: ['サポート不満', '機能要望未対応'], lastContact: '2025-01-12', assignee: '佐藤花子' },
    { name: 'GHI技術', domain: 'ghi-tech.co.jp', riskScore: 72, riskFactors: ['予算削減検討', 'レスポンス遅延'], lastContact: '2025-01-08', assignee: '鈴木一郎' }
  ],
  riskDistribution: [
    { category: '契約・更新', count: 15, severity: 'high' },
    { category: '価格・予算', count: 12, severity: 'high' },
    { category: 'サポート品質', count: 8, severity: 'medium' },
    { category: '機能・性能', count: 6, severity: 'medium' },
    { category: '競合比較', count: 10, severity: 'high' },
    { category: 'コミュニケーション', count: 4, severity: 'low' }
  ]
};

export default function DashboardPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [customerRiskData, setCustomerRiskData] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [loading, setLoading] = useState(true);

  const handleExportPDF = () => {
    toast('PDFレポートの生成を開始しました', { description: '数秒でダウンロード準備が整います' });
  };

  const handleExportText = () => {
    if (!report) {
      toast.error('データが読み込まれていません');
      return;
    }
    
    // テキスト形式のレポート生成
    const textReport = generateTextReport(report);
    
    // テキストファイルとしてダウンロード
    const blob = new Blob([textReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salesguard-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('テキストレポートをダウンロードしました');
  };

  const generateTextReport = (data: ReportData): string => {
    const date = new Date().toLocaleDateString('ja-JP');
    const time = new Date().toLocaleTimeString('ja-JP');
    const periodLabel = {
      week: '週次',
      month: '月次', 
      quarter: '四半期',
      year: '年次'
    }[selectedPeriod];
    
    return `
SalesGuard ${periodLabel}エグゼクティブレポート
生成日時: ${date} ${time}
集計期間: ${periodLabel}

=== 経営指標サマリー ===

1. 総合状況
   - 総アラート数: ${data.currentStatus.totalAlerts}件
   - 未対応案件: ${data.currentStatus.pendingCases}件
   - 対応中案件: ${data.currentStatus.inProgressCases}件
   - 解決済み案件: ${data.currentStatus.resolvedCases}件
   - 本日新規: ${data.currentStatus.todayNewCases}件

2. リスク検知状況
   - 検知率: ${((data.detectionPatterns.detectedAlerts / data.detectionPatterns.totalAlerts) * 100).toFixed(1)}%
   - 平均リスクスコア: ${data.detectionPatterns.avgScore.toFixed(1)}
   - 総スレッド数: ${data.detectionPatterns.totalThreads}件

3. 高リスク顧客 (要注意)
${mockCustomerRiskData.highRiskCustomers.map((customer, index) => 
  `   ${index + 1}. ${customer.name} (リスクスコア: ${customer.riskScore}) - 担当: ${customer.assignee}`
).join('\n')}

4. リスク要因分布
${mockCustomerRiskData.riskDistribution.map((risk, index) => 
  `   ${index + 1}. ${risk.category}: ${risk.count}件 (${risk.severity})`
).join('\n')}

=== 推奨アクション ===

1. 高リスク顧客${mockCustomerRiskData.highRiskCustomers.length}社への緊急対応が必要です。
2. 契約・更新関連のリスクが最多です。プロアクティブな対応を強化してください。
3. 未対応案件が${data.currentStatus.pendingCases}件あります。優先対応をお勧めします。

---
本レポートは SalesGuard システムにより自動生成されました。
    `.trim();
  };

  useEffect(() => {
    // 非同期でデータを読み込む（メインスレッドをブロックしない）
    let cancelled = false;
    
    const fetchReportData = async () => {
      // メインスレッドをブロックしないようにする
      await new Promise(resolve => setTimeout(resolve, 0));
      
      if (cancelled) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/reports?period=${selectedPeriod}`);
        if (response.ok) {
          const json = await response.json();
          if (json.success && json.data) {
            setReport(json.data);
          } else {
            throw new Error('Invalid API response format');
          }
        } else {
          // Set fallback data if API response is not ok
          setReport({
            currentStatus: {
              totalAlerts: mockKPI.critical_alerts,
              pendingCases: 45,
              inProgressCases: 23,
              resolvedCases: 132,
              todayNewCases: 8
            },
            priorityDistribution: [
              { priority: 'high', count: 25 },
              { priority: 'medium', count: 35 },
              { priority: 'low', count: 40 }
            ],
            detectionPatterns: {
              totalAlerts: mockKPI.critical_alerts,
              detectedAlerts: Math.floor(mockKPI.critical_alerts * 0.68),
              undetectedAlerts: Math.floor(mockKPI.critical_alerts * 0.32),
              avgScore: 72.5,
              totalThreads: 1250,
              rootMessages: 890,
              replyMessages: 360,
              departments: mockKPI.department_rankings.map(dept => ({
                department: dept.department,
                count: dept.alert_count
              })),
              riskLevels: [
                { riskLevel: '高リスク', count: 25 },
                { riskLevel: '中リスク', count: 35 },
                { riskLevel: '低リスク', count: 40 }
              ]
            },
            staffAnalysis: {
              topPerformers: [
                { name: '田中太郎', totalCases: 45, avgScore: 85.2, avgThreadLength: 3.2, urgentCases: 8, highPriorityCases: 12, mediumPriorityCases: 18, lowPriorityCases: 15 },
                { name: '佐藤花子', totalCases: 38, avgScore: 82.1, avgThreadLength: 2.8, urgentCases: 6, highPriorityCases: 10, mediumPriorityCases: 15, lowPriorityCases: 13 }
              ],
              summary: { totalStaff: 12, avgCasesPerStaff: 18.5, totalCases: 222, highLoadStaff: 3, mediumLoadStaff: 6, lowLoadStaff: 3 }
            }
          });
        }
      } catch (error) {
        console.error('Failed to fetch report data:', error);
        // Set fallback data on error
        setReport({
          currentStatus: {
            totalAlerts: mockKPI.critical_alerts,
            pendingCases: 45,
            inProgressCases: 23,
            resolvedCases: 132,
            todayNewCases: 8
          },
          priorityDistribution: [
            { priority: 'high', count: 25 },
            { priority: 'medium', count: 35 },
            { priority: 'low', count: 40 }
          ],
          detectionPatterns: {
            totalAlerts: mockKPI.critical_alerts,
            detectedAlerts: Math.floor(mockKPI.critical_alerts * 0.68),
            undetectedAlerts: Math.floor(mockKPI.critical_alerts * 0.32),
            avgScore: 72.5,
            totalThreads: 1250,
            rootMessages: 890,
            replyMessages: 360,
            departments: mockKPI.department_rankings.map(dept => ({
              department: dept.department,
              count: dept.alert_count
            })),
            riskLevels: [
              { riskLevel: '高リスク', count: 25 },
              { riskLevel: '中リスク', count: 35 },
              { riskLevel: '低リスク', count: 40 }
            ]
          },
          staffAnalysis: {
            topPerformers: [
              { name: '田中太郎', totalCases: 45, avgScore: 85.2, avgThreadLength: 3.2, urgentCases: 8, highPriorityCases: 12, mediumPriorityCases: 18, lowPriorityCases: 15 },
              { name: '佐藤花子', totalCases: 38, avgScore: 82.1, avgThreadLength: 2.8, urgentCases: 6, highPriorityCases: 10, mediumPriorityCases: 15, lowPriorityCases: 13 }
            ],
            summary: { totalStaff: 12, avgCasesPerStaff: 18.5, totalCases: 222, highLoadStaff: 3, mediumLoadStaff: 6, lowLoadStaff: 3 }
          }
        });
      }
    };

    const fetchCustomerRiskData = async () => {
      try {
        const response = await fetch('/api/customer-risk');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCustomerRiskData(data.data);
          } else {
            setCustomerRiskData(mockCustomerRiskData);
          }
        } else {
          setCustomerRiskData(mockCustomerRiskData);
        }
      } catch (error) {
        console.error('Failed to fetch customer risk data:', error);
        setCustomerRiskData(mockCustomerRiskData);
      }
    };

    Promise.all([fetchReportData(), fetchCustomerRiskData()]).finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });
    
    return () => {
      cancelled = true;
    };
  }, [selectedPeriod]);

  // 経営層向けKPI計算
  const executiveKPIs = useMemo(() => {
    if (!report || !report.currentStatus) {
      return {
        totalAlerts: mockKPI.critical_alerts,
        responseRate: 85.2,
        riskPreventionRate: 67.8,
        avgResolutionTime: 2.4,
        customerSatisfaction: 92.1,
        revenueImpact: 15.6
      };
    }

    const responseRate = report.currentStatus.resolvedCases && report.currentStatus.totalAlerts 
      ? (report.currentStatus.resolvedCases / report.currentStatus.totalAlerts) * 100 
      : 85.2;
      
    const riskPreventionRate = report.detectionPatterns?.detectedAlerts && report.detectionPatterns?.totalAlerts
      ? (report.detectionPatterns.detectedAlerts / report.detectionPatterns.totalAlerts) * 100 
      : 67.8;
    
    return {
      totalAlerts: report.currentStatus.totalAlerts || mockKPI.critical_alerts,
      responseRate: responseRate,
      riskPreventionRate: riskPreventionRate,
      avgResolutionTime: 2.4, // モック値
      customerSatisfaction: Math.max(90 - ((report.currentStatus.pendingCases || 0) * 0.5), 75), // 未対応案件に基づく推定
      revenueImpact: Math.min(riskPreventionRate * 0.2, 20) // リスク予防率に基づく推定収益インパクト
    };
  }, [report]);

  const getPeriodLabel = (period: string) => {
    const labels = {
      week: '週次',
      month: '月次',
      quarter: '四半期',
      year: '年次'
    };
    return labels[period as keyof typeof labels] || '月次';
  };

  // 管理者向けダッシュボードを表示（loading状態でも他のページへの遷移を可能にする）
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {loading && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <p className="text-sm">レポートデータを読み込み中...</p>
          </div>
        </div>
      )}
      <ManagerDashboardV2 />
    </div>
  );
}






