'use client'

import { useState, useEffect } from 'react'
import { Alert, AlertResponse } from '@/types/alert'
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
  const fetchAlerts = async () => {
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

      const data: AlertResponse = await response.json()
      setAlerts(data.data)
      setPagination(data.pagination)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // ステータス更新
  const updateStatus = async (messageId: string, status: string) => {
    try {
      const response = await fetch(`/api/alerts/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (!response.ok) throw new Error('ステータス更新に失敗しました')

      // ローカル状態を更新
      setAlerts(prev => prev.map(alert => 
        alert.message_id === messageId 
          ? { ...alert, status, status_updated_at: new Date().toISOString() }
          : alert
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ステータス更新に失敗しました')
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [pagination.page, filters])

  if (loading) return <div className="flex justify-center items-center h-64">読み込み中...</div>
  if (error) return <div className="text-red-600 p-4">エラー: {error}</div>

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">アラート管理ダッシュボード</h1>
      
      {/* フィルター */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="検索..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="border rounded px-3 py-2"
          />
          <select
            value={filters.priority}
            onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
            className="border rounded px-3 py-2"
          >
            <option value="all">全優先度</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </div>
      </div>

      {/* アラートテーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              <th className="border px-4 py-2">件名</th>
              <th className="border px-4 py-2">送信者</th>
              <th className="border px-4 py-2">日時</th>
              <th className="border px-4 py-2">優先度</th>
              <th className="border px-4 py-2">ステータス</th>
              <th className="border px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.message_id}>
                                       <td className="border px-4 py-2">
                         <div className="max-w-xs truncate" title={alert.subject}>
                           {alert.subject}
                           {alert.phraseDetections && alert.phraseDetections.length > 0 && (
                             <div className="mt-1">
                               {alert.phraseDetections.map((detection: any, index: number) => (
                                 <Badge 
                                   key={index} 
                                   variant={detection.priority === 'High' ? 'destructive' : 'secondary'}
                                   className="text-xs mr-1 mb-1"
                                   title={`${detection.category}: ${detection.phrase}`}
                                 >
                                   {detection.category}
                                 </Badge>
                               ))}
                             </div>
                           )}
                         </div>
                       </td>
                <td className="border px-4 py-2">
                  <div className="max-w-xs truncate" title={alert.from_address}>
                    {alert.from_address}
                  </div>
                </td>
                <td className="border px-4 py-2">
                  {new Date(alert.sent_timestamp).toLocaleString('ja-JP')}
                </td>
                <td className="border px-4 py-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    alert.priority === 'high' ? 'bg-red-100 text-red-800' :
                    alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {alert.priority}
                  </span>
                </td>
                <td className="border px-4 py-2">
                  <select
                    value={alert.status}
                    onChange={(e) => updateStatus(alert.message_id, e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="未対応">未対応</option>
                    <option value="対応中">対応中</option>
                    <option value="完了">完了</option>
                  </select>
                </td>
                <td className="border px-4 py-2">
                  <button
                    onClick={() => {/* 詳細表示 */}}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    詳細
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      <div className="mt-6 flex justify-between items-center">
        <div>
          全 {pagination.total} 件中 {(pagination.page - 1) * pagination.limit + 1} - 
          {Math.min(pagination.page * pagination.limit, pagination.total)} 件
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