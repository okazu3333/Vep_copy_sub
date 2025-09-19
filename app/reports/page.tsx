'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, TrendingUp, AlertTriangle, Users, Target, BarChart3 } from 'lucide-react'
import { ReportExport } from '@/components/report-export'
import { useRouter } from 'next/navigation'

interface ReportData {
  currentStatus: {
    totalAlerts: number
    pendingCases: number
    inProgressCases: number
    resolvedCases: number
    todayNewCases: number
  }
  priorityDistribution: Array<{
    priority: string
    count: number
  }>
  detectionPatterns: {
    totalAlerts: number
    detectedAlerts: number
    undetectedAlerts: number
    avgScore: number
    totalThreads: number
    rootMessages: number
    replyMessages: number
    departments: Array<{
      department: string
      count: number
    }>
    riskLevels: Array<{
      riskLevel: string
      count: number
    }>
  }
  staffAnalysis: {
    topPerformers: Array<{
      name: string
      totalCases: number
      avgScore: number
      avgThreadLength: number
      urgentCases: number
      highPriorityCases: number
      mediumPriorityCases: number
      lowPriorityCases: number
    }>
    summary: {
      totalStaff: number
      avgCasesPerStaff: number
      totalCases: number
      highLoadStaff: number
      mediumLoadStaff: number
      lowLoadStaff: number
    }
  }
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7d')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const computeRange = (p: string) => {
    const now = new Date()
    const end = now.toISOString()
    const d = new Date(now)
    if (p === '90d') d.setDate(d.getDate() - 90)
    else if (p === '30d') d.setDate(d.getDate() - 30)
    else d.setDate(d.getDate() - 7)
    const start = d.toISOString()
    return { start, end }
  }

  const goAlerts = (params: Record<string, string>) => {
    const { start, end } = computeRange(period)
    const usp = new URLSearchParams({ start, end, trace: 'dashboard', ...params })
    router.push(`/alerts?${usp.toString()}`)
  }

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/reports?period=${period}&type=overview`)
      const result = await response.json()
      
      if (result.success) {
        console.log('Report data received:', result.data)
        setReportData(result.data)
      } else {
        setError(result.error || 'レポートデータの取得に失敗しました')
      }
    } catch (err) {
      setError('レポートデータの取得中にエラーが発生しました')
      console.error('Report fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReportData()
  }, [period])

  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    console.log(`Exporting report as ${format}`)
    // 実際の実装では、ここでレポート生成APIを呼び出す
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>レポートデータを読み込み中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
          <Button onClick={fetchReportData} className="mt-2" variant="outline">
            再試行
          </Button>
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p>レポートデータが見つかりません</p>
          <Button onClick={fetchReportData} className="mt-2" variant="outline">
            再試行
          </Button>
        </div>
      </div>
    )
  }

  // データの型チェックと安全な表示
  const safeData = {
    currentStatus: reportData.currentStatus || {},
    priorityDistribution: reportData.priorityDistribution || [],
    detectionPatterns: reportData.detectionPatterns || {},
    staffAnalysis: reportData.staffAnalysis || { topPerformers: [], summary: {} }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">営業トラブルレポート</h1>
          <p className="text-gray-600">システム全体の状況と担当者別の分析</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="期間を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">直近7日</SelectItem>
              <SelectItem value="30d">直近30日</SelectItem>
              <SelectItem value="90d">直近90日</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchReportData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            更新
          </Button>
          <ReportExport
            period={period}
            reportType="overview"
            onExport={handleExport}
            data={reportData}
          />
        </div>
      </div>

      {/* 1. 現在の状況（リアルタイム） */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>現在の状況</span>
          </CardTitle>
          <CardDescription>リアルタイムのアラート状況</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <button className="text-center" onClick={() => goAlerts({})}>
              <div className="text-2xl font-bold text-blue-600">{String(safeData.currentStatus.totalAlerts || 0)}</div>
              <div className="text-sm text-gray-600">総アラート数</div>
            </button>
            <button className="text-center" onClick={() => goAlerts({ status: 'pending' })}>
              <div className="text-2xl font-bold text-red-600">{String(safeData.currentStatus.pendingCases || 0)}</div>
              <div className="text-sm text-gray-600">未対応</div>
            </button>
            <button className="text-center" onClick={() => goAlerts({ status: 'in_progress' })}>
              <div className="text-2xl font-bold text-yellow-600">{String(safeData.currentStatus.inProgressCases || 0)}</div>
              <div className="text-sm text-gray-600">対応中</div>
            </button>
            <button className="text-center" onClick={() => goAlerts({ status: 'resolved' })}>
              <div className="text-2xl font-bold text-green-600">{String(safeData.currentStatus.resolvedCases || 0)}</div>
              <div className="text-sm text-gray-600">解決済み</div>
            </button>
            <button className="text-center" onClick={() => goAlerts({})}>
              <div className="text-2xl font-bold text-purple-600">{String(safeData.currentStatus.todayNewCases || 0)}</div>
              <div className="text-sm text-gray-600">本日新規</div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 2. 緊急度別分布（優先度） */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>緊急度別分布</span>
          </CardTitle>
          <CardDescription>優先度別のアラート分布</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {safeData.priorityDistribution.length > 0 ? (
              safeData.priorityDistribution.map((item, index) => (
                <button key={`${item.priority}-${index}`} className="text-center" onClick={() => goAlerts({ priority: String(item.priority || '') })}>
                  <div className="text-2xl font-bold">
                    {item.priority === '緊急' && <span className="text-red-600">{String(item.count || 0)}</span>}
                    {item.priority === '高' && <span className="text-orange-600">{String(item.count || 0)}</span>}
                    {item.priority === '中' && <span className="text-yellow-600">{String(item.count || 0)}</span>}
                    {item.priority === '低' && <span className="text-green-600">{String(item.count || 0)}</span>}
                    {!['緊急', '高', '中', '低'].includes(item.priority) && <span className="text-gray-600">{String(item.count || 0)}</span>}
                  </div>
                  <div className="text-sm text-gray-600">{String(item.priority || '')}</div>
                  <div className="text-xs text-gray-500">{String(item.count || 0)}件</div>
                </button>
              ))
            ) : (
              <div className="col-span-4 text-center text-gray-500 py-8">
                優先度データが見つかりません
              </div>
            )}
          </div>
        </CardContent>
      </Card>



      {/* 3. 検知パターン分析 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>検知パターン分析</span>
          </CardTitle>
          <CardDescription>アラート検知の詳細分析とリスク分布</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 基本統計 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{String(safeData.detectionPatterns.totalAlerts || 0)}</div>
              <div className="text-sm text-gray-600">総アラート数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{String(safeData.detectionPatterns.detectedAlerts || 0)}</div>
              <div className="text-sm text-gray-600">検知済み</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{String(safeData.detectionPatterns.avgScore || 0)}</div>
              <div className="text-sm text-gray-600">平均スコア</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{String(safeData.detectionPatterns.totalThreads || 0)}</div>
              <div className="text-sm text-gray-600">スレッド数</div>
            </div>
          </div>
          
          {/* リスクレベル分布 */}
          <div className="border-t pt-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">リスクレベル分布</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {safeData.detectionPatterns.riskLevels?.map((risk, index) => (
                <div key={`${risk.riskLevel}-${index}`} className="text-center">
                  <div className="text-2xl font-bold text-red-600">{String(risk.count || 0)}</div>
                  <div className="text-sm text-gray-600">{String(risk.riskLevel || '')}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* 部署別検知件数 */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">部署別検知件数</h3>
            <div className="space-y-3">
              {safeData.detectionPatterns.departments?.map((dept, index) => (
                <div key={`${dept.department}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">{String(dept.department || '')}</span>
                  <Badge variant="secondary">{String(dept.count || 0)}件</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>



      {/* 4. 担当者別分析 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>担当者別分析</span>
          </CardTitle>
          <CardDescription>担当者別のパフォーマンスと負荷状況</CardDescription>
        </CardHeader>
        <CardContent>
          {/* サマリー */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{String(safeData.staffAnalysis.summary.totalStaff || 0)}</div>
              <div className="text-sm text-gray-600">総担当者数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{String(safeData.staffAnalysis.summary.avgCasesPerStaff || 0)}</div>
              <div className="text-sm text-gray-600">平均案件数/人</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{String(safeData.staffAnalysis.summary.highLoadStaff || 0)}</div>
              <div className="text-sm text-gray-600">高負荷担当者</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{String(safeData.staffAnalysis.summary.mediumLoadStaff || 0)}</div>
              <div className="text-sm text-gray-600">適正負荷担当者</div>
            </div>
          </div>

          {/* 担当者別詳細 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">上位担当者（案件数順）</h3>
            {safeData.staffAnalysis.topPerformers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {safeData.staffAnalysis.topPerformers.map((staff, index) => (
                  <div key={`staff-${index}-${staff.totalCases}`} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {index === 0 && <span className="text-yellow-500">🥇</span>}
                        {index === 1 && <span className="text-gray-400">🥈</span>}
                        {index === 2 && <span className="text-orange-500">🥉</span>}
                        <span className="font-medium text-sm truncate" title={staff.name}>
                          {staff.name.includes('<') ? staff.name.split('<')[0].trim() : staff.name}
                        </span>
                      </div>
                                          <Badge variant={staff.totalCases > 10 ? 'destructive' : staff.totalCases >= 5 ? 'default' : 'secondary'}>
                      {String(staff.totalCases || 0)}件
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div>平均スコア: {String(staff.avgScore || 0)}点</div>
                    <div>平均スレッド長: {String(staff.avgThreadLength || 0)}件</div>
                    <div>緊急案件: {String(staff.urgentCases || 0)}件</div>
                    <div>高優先度: {String(staff.highPriorityCases || 0)}件</div>
                  </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                担当者データが見つかりません
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 