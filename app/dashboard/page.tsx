'use client'

import { DepartmentChart } from '@/components/department-chart'
import { ReportExport } from '@/components/report-export'
import { SalesPersonChart } from '@/components/sales-person-chart'
import { SalesPersonFilter } from '@/components/sales-person-filter'
import { TimeSeriesChart } from '@/components/time-series-chart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  departmentAlertData,
  salesPersonAlertData,
  timeSeriesData,
} from '@/lib/dummy-data'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Bell,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileText,
  Lightbulb,
  Mail,
  Minus,
  Phone,
  PieChart,
  RefreshCw,
  Shield,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { useState } from 'react'

type Period = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
type ReportType = 'overview' | 'detailed' | 'comparison' | 'trends'

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('weekly')
  const [reportType, setReportType] = useState<ReportType>('overview')
  const [departmentChartType, setDepartmentChartType] = useState<'bar' | 'pie'>(
    'bar'
  )
  const [salesPersonSearchTerm, setSalesPersonSearchTerm] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const periodLabels = {
    weekly: '週次',
    monthly: '月次',
    quarterly: '四半期',
    yearly: '年次',
  }

  const reportTypeLabels = {
    overview: '概要',
    detailed: '詳細分析',
    comparison: '比較分析',
    trends: 'トレンド分析',
  }

  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    console.log(
      `Exporting ${selectedPeriod} ${reportTypeLabels[reportType]} report as ${format}`
    )
  }

  const handleSalesPersonSearch = (searchTerm: string) => {
    setSalesPersonSearchTerm(searchTerm)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // データ更新処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  // 統計データの計算
  const totalAlerts = salesPersonAlertData[selectedPeriod].reduce(
    (sum, person) => sum + person.alerts,
    0
  )
  const totalResolved = salesPersonAlertData[selectedPeriod].reduce(
    (sum, person) => sum + person.resolved,
    0
  )
  const totalPending = salesPersonAlertData[selectedPeriod].reduce(
    (sum, person) => sum + person.pending,
    0
  )
  const resolutionRate =
    totalAlerts > 0 ? Math.round((totalResolved / totalAlerts) * 100) : 0

  // 詳細統計データの計算
  const avgResponseTime = 2.3 // 平均対応時間（日）
  const previousPeriod =
    selectedPeriod === 'weekly'
      ? 'monthly'
      : selectedPeriod === 'monthly'
      ? 'quarterly'
      : selectedPeriod === 'quarterly'
      ? 'yearly'
      : 'yearly'

  const previousTotalAlerts =
    salesPersonAlertData[previousPeriod]?.reduce(
      (sum, person) => sum + person.alerts,
      0
    ) || 0
  const alertChange = totalAlerts - previousTotalAlerts
  const alertChangePercent =
    previousTotalAlerts > 0
      ? Math.round((alertChange / previousTotalAlerts) * 100)
      : 0

  // 部門別統計
  const departmentStats = departmentAlertData[selectedPeriod].map(dept => ({
    ...dept,
    resolutionRate:
      dept.alerts > 0 ? Math.round((dept.resolved / dept.alerts) * 100) : 0,
    pendingRate:
      dept.alerts > 0 ? Math.round((dept.pending / dept.alerts) * 100) : 0,
  }))

  // 営業担当者別統計
  const salesPersonStats = salesPersonAlertData[selectedPeriod]
    .filter(
      person =>
        !salesPersonSearchTerm ||
        person.name
          .toLowerCase()
          .includes(salesPersonSearchTerm.toLowerCase()) ||
        person.department
          .toLowerCase()
          .includes(salesPersonSearchTerm.toLowerCase())
    )
    .map(person => ({
      ...person,
      resolutionRate:
        person.alerts > 0
          ? Math.round((person.resolved / person.alerts) * 100)
          : 0,
      efficiency:
        person.alerts > 0
          ? Math.round((person.resolved / person.alerts) * 100)
          : 0,
    }))
    .sort((a, b) => b.efficiency - a.efficiency)

  // トップパフォーマー（解決率上位）
  const topPerformers = salesPersonStats.slice(0, 3)

  // 要注意部門（未対応率上位）
  const highRiskDepartments = departmentStats
    .sort((a, b) => b.pendingRate - a.pendingRate)
    .slice(0, 3)

  // アラート傾向分析
  const alertTrend =
    alertChange > 0 ? 'increase' : alertChange < 0 ? 'decrease' : 'stable'
  const trendIcon =
    alertChange > 0 ? (
      <ArrowUpRight className="h-4 w-4" />
    ) : alertChange < 0 ? (
      <ArrowDownRight className="h-4 w-4" />
    ) : (
      <Minus className="h-4 w-4" />
    )
  const trendColor =
    alertChange > 0
      ? 'text-red-500'
      : alertChange < 0
      ? 'text-green-500'
      : 'text-gray-500'

  // 新しい指標の計算
  const customerSatisfaction = 85 // 顧客満足度（%）
  const costPerAlert = 12500 // アラートあたりのコスト（円）
  const efficiencyScore = 78 // 効率性スコア
  const riskLevel =
    totalPending > 10 ? 'high' : totalPending > 5 ? 'medium' : 'low'
  const riskColor =
    riskLevel === 'high'
      ? 'text-red-500'
      : riskLevel === 'medium'
      ? 'text-yellow-500'
      : 'text-green-500'

  // リアルタイム通知データ
  const notifications = [
    {
      id: 1,
      type: 'alert',
      message: '新規アラート: 営業部 田中様',
      time: '2分前',
      priority: 'high',
    },
    {
      id: 2,
      type: 'resolved',
      message: '解決済み: マーケティング部 佐藤様',
      time: '5分前',
      priority: 'medium',
    },
    {
      id: 3,
      type: 'warning',
      message: '未対応アラートが5件あります',
      time: '10分前',
      priority: 'high',
    },
  ]

  // クイックアクション
  const quickActions = [
    {
      icon: Eye,
      label: '全アラート確認',
      action: () => console.log('全アラート確認'),
    },
    { icon: Phone, label: '緊急連絡', action: () => console.log('緊急連絡') },
    {
      icon: Mail,
      label: '一括メール送信',
      action: () => console.log('一括メール送信'),
    },
    {
      icon: Download,
      label: 'レポート出力',
      action: () => console.log('レポート出力'),
    },
  ]

  // 予測・推奨事項
  const recommendations = [
    {
      type: 'improvement',
      title: '営業部の対応時間短縮',
      description: '平均対応時間を1.5日まで短縮可能',
      impact: 'high',
    },
    {
      type: 'warning',
      title: 'マーケティング部の未対応増加',
      description: '未対応率が20%を超えています',
      impact: 'medium',
    },
    {
      type: 'opportunity',
      title: '顧客満足度向上の機会',
      description: '解決率を85%まで向上させることが可能',
      impact: 'high',
    },
  ]

  // レポートエクスポート用のデータ
  const exportData = {
    totalAlerts,
    totalResolved,
    totalPending,
    resolutionRate,
    avgResponseTime,
    alertChangePercent,
    topPerformers,
    highRiskDepartments,
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                レポートダッシュボード
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                営業トラブルアラートの包括的な分析と洞察
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                />
                更新
              </Button>
              <ReportExport
                period={selectedPeriod}
                reportType={reportType}
                onExport={handleExport}
                data={exportData}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 期間選択 */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                期間:
              </span>
            </div>
            <div className="flex space-x-1">
              {(Object.keys(periodLabels) as Period[]).map(period => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                  className="text-sm"
                >
                  {periodLabels[period]}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* 主要指標カード - 6列に拡張 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                総アラート数
              </CardTitle>
              <AlertTriangle className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAlerts}</div>
              <div className="flex items-center text-xs mt-1">
                {trendIcon}
                <span className="ml-1">
                  {alertChangePercent > 0 ? '+' : ''}
                  {alertChangePercent}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                未対応アラート
              </CardTitle>
              <Bell className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPending}</div>
              <div className="text-xs mt-1">
                {totalAlerts > 0
                  ? Math.round((totalPending / totalAlerts) * 100)
                  : 0}
                % の未対応率
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">解決済み</CardTitle>
              <CheckCircle className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalResolved}</div>
              <div className="text-xs mt-1">解決率 {resolutionRate}%</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                平均対応時間
              </CardTitle>
              <Clock className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgResponseTime}日</div>
              <div className="text-xs mt-1">-0.5日 前期間より</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">顧客満足度</CardTitle>
              <Star className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customerSatisfaction}%</div>
              <div className="text-xs mt-1">+3% 前期間より</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                効率性スコア
              </CardTitle>
              <Zap className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{efficiencyScore}</div>
              <div className="text-xs mt-1">+5 前期間より</div>
            </CardContent>
          </Card>
        </div>

        {/* メインコンテンツ */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-gray-800">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              概要
            </TabsTrigger>
            <TabsTrigger value="detailed" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              詳細分析
            </TabsTrigger>
            <TabsTrigger value="comparison" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              比較分析
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              トレンド
            </TabsTrigger>
          </TabsList>

          {/* 概要タブ */}
          <TabsContent value="overview" className="space-y-6">
            {/* アラート推移チャート - 全幅表示 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  アラート推移（{periodLabels[selectedPeriod]}）
                </CardTitle>
                <CardDescription>
                  期間別のアラート発生状況と傾向
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TimeSeriesChart
                  data={timeSeriesData[selectedPeriod]}
                  period={selectedPeriod}
                />
              </CardContent>
            </Card>

            {/* 分析サマリー - 4列に拡張 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Award className="h-5 w-5 mr-2" />
                    トップパフォーマー
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topPerformers.map((person, index) => (
                      <div
                        key={person.name}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                              index === 0
                                ? 'bg-yellow-500'
                                : index === 1
                                ? 'bg-gray-400'
                                : 'bg-orange-500'
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {person.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {person.department}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-green-600">
                          {person.resolutionRate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    要注意部門
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {highRiskDepartments.map((dept, index) => (
                      <div
                        key={dept.name}
                        className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-sm">{dept.name}</div>
                          <div className="text-xs text-muted-foreground">
                            未対応率: {dept.pendingRate}%
                          </div>
                        </div>
                        <Badge variant="destructive">{dept.pending}件</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    期間サマリー
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">総アラート数</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{totalAlerts}</Badge>
                        <span className={`text-xs ${trendColor}`}>
                          {alertChangePercent > 0 ? '+' : ''}
                          {alertChangePercent}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">解決済み</span>
                      <Badge variant="default" className="bg-green-500">
                        {totalResolved}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">未対応</span>
                      <Badge variant="destructive">{totalPending}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">解決率</span>
                      <Badge variant="secondary">{resolutionRate}%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">平均対応時間</span>
                      <Badge variant="outline">{avgResponseTime}日</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Lightbulb className="h-5 w-5 mr-2" />
                    推奨事項
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recommendations.map((rec, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg ${
                          rec.type === 'improvement'
                            ? 'bg-green-50 dark:bg-green-950/20'
                            : rec.type === 'warning'
                            ? 'bg-red-50 dark:bg-red-950/20'
                            : 'bg-blue-50 dark:bg-blue-950/20'
                        }`}
                      >
                        <div className="font-medium text-sm">{rec.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {rec.description}
                        </div>
                        <Badge
                          variant="outline"
                          className={`mt-2 ${
                            rec.impact === 'high'
                              ? 'text-red-600 border-red-600'
                              : 'text-yellow-600 border-yellow-600'
                          }`}
                        >
                          {rec.impact === 'high' ? '高' : '中'}優先度
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 詳細分析タブ */}
          <TabsContent value="detailed" className="space-y-6">
            <Tabs defaultValue="sales-person" className="space-y-6">
              <TabsList className="bg-white dark:bg-gray-800">
                <TabsTrigger
                  value="sales-person"
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  営業担当者別
                </TabsTrigger>
                <TabsTrigger
                  value="department"
                  className="flex items-center gap-2"
                >
                  <Building className="h-4 w-4" />
                  部門別
                </TabsTrigger>
                <TabsTrigger value="cost" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  コスト分析
                </TabsTrigger>
                <TabsTrigger value="risk" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  リスク評価
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sales-person">
                <SalesPersonFilter
                  salesPersons={salesPersonAlertData[selectedPeriod]}
                  onSearch={handleSalesPersonSearch}
                  searchTerm={salesPersonSearchTerm}
                />
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <BarChart3 className="h-5 w-5 mr-2" />
                        営業担当者別アラート分析（{periodLabels[selectedPeriod]}
                        ）
                      </div>
                      <div className="text-sm text-gray-500">
                        {salesPersonSearchTerm
                          ? `${salesPersonStats.length}名を表示中`
                          : `全${salesPersonAlertData[selectedPeriod].length}名を表示中`}
                      </div>
                    </CardTitle>
                    <CardDescription>
                      各営業担当者のアラート発生状況と対応実績
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SalesPersonChart
                      data={salesPersonStats}
                      period={selectedPeriod}
                      searchTerm={salesPersonSearchTerm}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="department">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center">
                          <PieChart className="h-5 w-5 mr-2" />
                          部門別アラート分析（{periodLabels[selectedPeriod]}）
                        </CardTitle>
                        <CardDescription>
                          部門ごとのアラート発生状況と対応実績
                        </CardDescription>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant={
                            departmentChartType === 'bar'
                              ? 'default'
                              : 'outline'
                          }
                          size="sm"
                          onClick={() => setDepartmentChartType('bar')}
                        >
                          <BarChart3 className="h-4 w-4 mr-1" />
                          棒グラフ
                        </Button>
                        <Button
                          variant={
                            departmentChartType === 'pie'
                              ? 'default'
                              : 'outline'
                          }
                          size="sm"
                          onClick={() => setDepartmentChartType('pie')}
                        >
                          <PieChart className="h-4 w-4 mr-1" />
                          円グラフ
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <DepartmentChart
                      data={departmentStats}
                      period={selectedPeriod}
                      chartType={departmentChartType}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cost">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <DollarSign className="h-5 w-5 mr-2" />
                        コスト分析
                      </CardTitle>
                      <CardDescription>
                        アラート対応にかかるコストの詳細分析
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">
                              ¥{costPerAlert.toLocaleString()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              アラートあたりのコスト
                            </div>
                          </div>
                          <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">
                              ¥{(totalAlerts * costPerAlert).toLocaleString()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              総コスト
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">人件費</span>
                            <Badge variant="outline">65%</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">システム運用費</span>
                            <Badge variant="outline">20%</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">その他費用</span>
                            <Badge variant="outline">15%</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <TrendingUp className="h-5 w-5 mr-2" />
                        コスト効率性
                      </CardTitle>
                      <CardDescription>コスト対効果の分析</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                          <div>
                            <div className="font-medium text-sm">
                              解決率向上による節約
                            </div>
                            <div className="text-xs text-muted-foreground">
                              前期間比 +5%
                            </div>
                          </div>
                          <Badge variant="default" className="bg-green-500">
                            ¥125,000
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                          <div>
                            <div className="font-medium text-sm">
                              対応時間短縮効果
                            </div>
                            <div className="text-xs text-muted-foreground">
                              平均 -0.5日
                            </div>
                          </div>
                          <Badge variant="default" className="bg-blue-500">
                            ¥85,000
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                          <div>
                            <div className="font-medium text-sm">
                              未対応による損失
                            </div>
                            <div className="text-xs text-muted-foreground">
                              5件の未対応
                            </div>
                          </div>
                          <Badge variant="destructive">-¥62,500</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="risk">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Shield className="h-5 w-5 mr-2" />
                        リスク評価
                      </CardTitle>
                      <CardDescription>
                        現在のリスクレベルと対策
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">総合リスクレベル</span>
                          <Badge
                            variant="outline"
                            className={`${
                              riskLevel === 'high'
                                ? 'text-red-600 border-red-600'
                                : riskLevel === 'medium'
                                ? 'text-yellow-600 border-yellow-600'
                                : 'text-green-600 border-green-600'
                            }`}
                          >
                            {riskLevel === 'high'
                              ? '高'
                              : riskLevel === 'medium'
                              ? '中'
                              : '低'}
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                            <div>
                              <div className="font-medium text-sm">
                                未対応アラート
                              </div>
                              <div className="text-xs text-muted-foreground">
                                リスク要因
                              </div>
                            </div>
                            <Badge variant="destructive">
                              {totalPending}件
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                            <div>
                              <div className="font-medium text-sm">
                                対応時間延長
                              </div>
                              <div className="text-xs text-muted-foreground">
                                平均2.3日
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-yellow-600"
                            >
                              中リスク
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                            <div>
                              <div className="font-medium text-sm">解決率</div>
                              <div className="text-xs text-muted-foreground">
                                良好
                              </div>
                            </div>
                            <Badge variant="outline" className="text-green-600">
                              {resolutionRate}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        リスク対策
                      </CardTitle>
                      <CardDescription>
                        推奨される対策とアクション
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                          <div className="font-medium text-sm text-red-800 dark:text-red-200">
                            緊急対応が必要
                          </div>
                          <div className="text-sm mt-2">
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              <li>未対応アラートの即座の対応</li>
                              <li>担当者の追加配置</li>
                              <li>緊急連絡体制の確認</li>
                            </ul>
                          </div>
                        </div>
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                          <div className="font-medium text-sm text-yellow-800 dark:text-yellow-200">
                            改善が必要
                          </div>
                          <div className="text-sm mt-2">
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              <li>対応プロセスの見直し</li>
                              <li>自動化の検討</li>
                              <li>研修の実施</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* 比較分析タブ */}
          <TabsContent value="comparison" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    期間比較分析
                  </CardTitle>
                  <CardDescription>
                    前期間との比較による改善点と課題の特定
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">改善点</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                          <span className="text-sm">解決率の向上</span>
                          <Badge variant="default" className="bg-green-500">
                            +5%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                          <span className="text-sm">平均対応時間の短縮</span>
                          <Badge variant="default" className="bg-green-500">
                            -0.5日
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                          <span className="text-sm">顧客満足度の向上</span>
                          <Badge variant="default" className="bg-green-500">
                            +3%
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">課題</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                          <span className="text-sm">アラート数の増加</span>
                          <Badge variant="destructive">+12%</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                          <span className="text-sm">未対応率の上昇</span>
                          <Badge variant="destructive">+3%</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                          <span className="text-sm">コストの増加</span>
                          <Badge variant="destructive">+8%</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    パフォーマンス比較
                  </CardTitle>
                  <CardDescription>
                    部門・担当者別のパフォーマンス比較
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">トップ3部門</h3>
                      {departmentStats.slice(0, 3).map((dept, index) => (
                        <div
                          key={dept.name}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                index === 0
                                  ? 'bg-yellow-500'
                                  : index === 1
                                  ? 'bg-gray-400'
                                  : 'bg-orange-500'
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-sm">
                                {dept.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                解決率: {dept.resolutionRate}%
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline">{dept.alerts}件</Badge>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">
                        改善が必要な部門
                      </h3>
                      {highRiskDepartments.map((dept, index) => (
                        <div
                          key={dept.name}
                          className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg"
                        >
                          <div>
                            <div className="font-medium text-sm">
                              {dept.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              未対応率: {dept.pendingRate}%
                            </div>
                          </div>
                          <Badge variant="destructive">{dept.pending}件</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* トレンド分析タブ */}
          <TabsContent value="trends" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    トレンド分析
                  </CardTitle>
                  <CardDescription>
                    長期的な傾向とパターンの分析
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">
                        月別トレンド
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">1月</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: '60%' }}
                              ></div>
                            </div>
                            <span className="text-sm">60%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">2月</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: '75%' }}
                              ></div>
                            </div>
                            <span className="text-sm">75%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">3月</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: '85%' }}
                              ></div>
                            </div>
                            <span className="text-sm">85%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-4">予測分析</h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                          <div className="font-medium text-sm">来月の予測</div>
                          <div className="text-2xl font-bold text-blue-600">
                            +8%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            アラート数の増加が予想されます
                          </div>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                          <div className="font-medium text-sm">解決率予測</div>
                          <div className="text-2xl font-bold text-green-600">
                            78%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            改善傾向が続くと予想されます
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    パフォーマンス予測
                  </CardTitle>
                  <CardDescription>
                    将来のパフォーマンス予測と目標設定
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">3ヶ月後の予測</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                          <div className="text-lg font-bold text-blue-600">
                            {Math.round(totalAlerts * 1.08)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            予測アラート数
                          </div>
                        </div>
                        <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                          <div className="text-lg font-bold text-green-600">
                            {resolutionRate + 3}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            予測解決率
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">目標設定</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                          <div>
                            <div className="font-medium text-sm">
                              解決率目標
                            </div>
                            <div className="text-xs text-muted-foreground">
                              3ヶ月後までに
                            </div>
                          </div>
                          <Badge variant="outline" className="text-purple-600">
                            85%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
                          <div>
                            <div className="font-medium text-sm">
                              対応時間目標
                            </div>
                            <div className="text-xs text-muted-foreground">
                              平均1.5日以内
                            </div>
                          </div>
                          <Badge variant="outline" className="text-indigo-600">
                            1.5日
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-teal-50 dark:bg-teal-950/20 rounded-lg">
                          <div>
                            <div className="font-medium text-sm">
                              顧客満足度目標
                            </div>
                            <div className="text-xs text-muted-foreground">
                              90%以上を維持
                            </div>
                          </div>
                          <Badge variant="outline" className="text-teal-600">
                            90%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
