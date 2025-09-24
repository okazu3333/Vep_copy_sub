'use client'

import { useState, useEffect, useCallback } from 'react'
import { Alert } from '@/types'
import { Badge } from '@/components/ui/badge'

export default function AlertDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all'
  })

  // アラート取得
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.priority !== 'all' && { priority: filters.priority })
      })

      const response = await fetch(`/api/alerts?${params}`)
      if (!response.ok) throw new Error('データ取得に失敗しました')

      const data = await response.json()
      setAlerts(data.alerts || [])
      setPagination(data.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters.search, filters.status, filters.priority])

  // ステータス更新
  const updateStatus = async (alertId: string, status: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (!response.ok) throw new Error('ステータス更新に失敗しました')

      // ローカル状態を更新
      setAlerts(prev => (prev || []).map(alert => 
        alert.id === alertId 
          ? { ...alert, status: status as any, updatedAt: new Date().toISOString() }
          : alert
      ))
    } catch (err) {
      console.error('Status update error:', err)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  if (loading) return <div className="p-4">読み込み中...</div>
  if (error) return <div className="p-4 text-red-600">エラー: {error}</div>

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">アラート一覧</h2>
      
      {/* フィルター */}
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="検索..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          className="border px-3 py-2 rounded"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          className="border px-3 py-2 rounded"
        >
          <option value="all">すべてのステータス</option>
          <option value="unhandled">未対応</option>
          <option value="in_progress">対応中</option>
          <option value="completed">完了</option>
        </select>
        <select
          value={filters.priority}
          onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
          className="border px-3 py-2 rounded"
        >
          <option value="all">すべての優先度</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
      </div>

      {/* アラート表 */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-4 py-2">件名</th>
              <th className="border px-4 py-2">顧客</th>
              <th className="border px-4 py-2">日時</th>
              <th className="border px-4 py-2">優先度</th>
              <th className="border px-4 py-2">ステータス</th>
              <th className="border px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {(alerts || []).map((alert) => (
              <tr key={alert.id}>
                <td className="border px-4 py-2">
                  <div className="max-w-xs truncate" title={alert.subject}>
                    {alert.subject}
                    {alert.phrases && (
                      <div className="mt-1">
                        {alert.phrases.split(',').map((phrase: string, index: number) => (
                          <Badge 
                            key={index} 
                            variant="secondary"
                            className="text-xs mr-1 mb-1"
                          >
                            {phrase.trim()}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="border px-4 py-2">
                  <div className="max-w-xs truncate" title={alert.customer}>
                    {alert.customer}
                  </div>
                </td>
                <td className="border px-4 py-2">
                  {new Date(alert.datetime).toLocaleDateString('ja-JP')}
                </td>
                <td className="border px-4 py-2">
                  <Badge variant={
                    alert.severity === 'high' ? 'destructive' : 
                    alert.severity === 'medium' ? 'default' : 'secondary'
                  }>
                    {alert.severity}
                  </Badge>
                </td>
                <td className="border px-4 py-2">
                  <Badge variant={
                    alert.status === 'completed' ? 'default' : 
                    alert.status === 'in_progress' ? 'secondary' : 'outline'
                  }>
                    {alert.status === 'unhandled' ? '未対応' :
                     alert.status === 'in_progress' ? '対応中' : '完了'}
                  </Badge>
                </td>
                <td className="border px-4 py-2">
                  <select
                    value={alert.status}
                    onChange={(e) => updateStatus(alert.id, e.target.value)}
                    className="border px-2 py-1 rounded text-sm"
                  >
                    <option value="unhandled">未対応</option>
                    <option value="in_progress">対応中</option>
                    <option value="completed">完了</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      <div className="mt-4 flex justify-between items-center">
        <div>
          {pagination.total}件中 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={!pagination.hasPrev}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            前へ
          </button>
          <span className="px-3 py-1">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={!pagination.hasNext}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  )
} 