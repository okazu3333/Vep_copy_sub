'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Eye,
  Info,
  MessageSquare,
  Phone,
  TrendingUp,
  Loader2,
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface Alert {
  id: string
  keyword: string
  description: string
  department: string
  person: string
  customerName: string
  customerCompany: string
  level: string
  status: string
  datetime: string
  priority: string
  score: number
}

export function RecentAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  // アラートデータ取得
  useEffect(() => {
    const fetchRecentAlerts = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/alerts?limit=5&page=1')
        const data = await response.json()
        
        if (data.success) {
          const processedAlerts = data.alerts.map((alert: any) => ({
            id: alert.id,
            keyword: alert.keyword || 'キーワードなし',
            description: alert.description || '詳細なし',
            department: alert.department || '不明',
            person: alert.person || '不明',
            customerName: alert.customerName || '不明',
            customerCompany: alert.customerCompany || '不明',
            level: alert.level || 'medium',
            status: alert.status || 'pending',
            datetime: alert.datetime ? new Date(alert.datetime).toLocaleString('ja-JP', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }) : '不明',
            priority: alert.level === 'high' ? 'urgent' : alert.level === 'medium' ? 'high' : 'low',
            score: alert.score || 0
          }))
          
          setAlerts(processedAlerts)
        }
      } catch (error) {
        console.error('アラート取得エラー:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecentAlerts()
  }, [])

  const filteredAlerts = alerts.filter(
    alert => filter === 'all' || alert.level === filter
  )

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'medium':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'low':
        return <Info className="w-4 h-4 text-blue-500" />
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="destructive" className="text-xs">
            未対応
          </Badge>
        )
      case 'in_progress':
        return (
          <Badge variant="secondary" className="text-xs">
            対応中
          </Badge>
        )
      case 'resolved':
        return (
          <Badge variant="default" className="text-xs bg-green-500">
            解決済み
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        )
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20'
      case 'high':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20'
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
      case 'low':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20'
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-950/20'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                最新アラート
              </CardTitle>
              <CardDescription>直近の重要なアラート一覧</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">データを読み込み中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              最新アラート
            </CardTitle>
            <CardDescription>直近の重要なアラート一覧</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="text-xs"
            >
              すべて
            </Button>
            <Button
              variant={filter === 'high' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('high')}
              className="text-xs"
            >
              高
            </Button>
            <Button
              variant={filter === 'medium' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('medium')}
              className="text-xs"
            >
              中
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {filteredAlerts.map(alert => (
          <div
            key={alert.id}
            className={`p-3 border rounded-lg transition-all cursor-pointer hover:shadow-md border-l-4 ${getPriorityColor(
              alert.priority
            )}`}
            onClick={() =>
              setSelectedAlert(selectedAlert === alert.id ? null : alert.id)
            }
          >
            {/* メイン情報行 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getLevelIcon(alert.level)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{alert.id}</span>
                    <span className="text-sm font-medium truncate">
                      {alert.keyword}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {alert.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(alert.status)}
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  {alert.datetime}
                </div>
              </div>
            </div>

            {/* 詳細情報行 */}
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-4">
                <span>部署: {alert.department}</span>
                <span>担当: {alert.person}</span>
              </div>
              <span>顧客: {alert.customerName}</span>
            </div>

            {/* アクションボタン */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  詳細
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  メール
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <Phone className="h-3 w-3 mr-1" />
                  電話
                </Button>
              </div>
              <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
                対応開始
              </Button>
            </div>
          </div>
        ))}

        {filteredAlerts.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            該当するアラートがありません
          </div>
        )}

        <div className="pt-2 border-t">
          <Button variant="outline" size="sm" className="w-full text-xs">
            すべてのアラートを表示
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
