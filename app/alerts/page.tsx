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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Download,
  Info,
  Search,
  Settings,
  Target,
  X,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  Filter,
  SkipForward,
  SkipBack,
  List,
  Rows,
  LayoutGrid,
} from 'lucide-react'
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"

// デバウンス用カスタムフック
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// スケルトンローディングコンポーネント
function AlertSkeleton() {
  return (
    <div className="p-3 border rounded-lg animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="h-6 bg-gray-200 rounded w-12"></div>
        </div>
        <div className="h-6 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      </div>
    </div>
  )
}

// アラート詳細モーダルコンポーネント
function AlertDetailModal({
  alert,
  isOpen,
  onClose,
  onStatusChange,
}: {
  alert: any
  isOpen: boolean
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const [status, setStatus] = useState(alert?.status || 'pending')
  // メッセージの開閉状態を管理
  const [openMessages, setOpenMessages] = useState<Set<string>>(new Set())
  // 追加: モーダル内でメッセージをオンデマンド取得
  const [modalMessages, setModalMessages] = useState<any[]>(alert?.messages || [])
  // 追加: ローディングとリトライ回数
  const [modalLoading, setModalLoading] = useState(false)
  const [modalRetry, setModalRetry] = useState(0)
  // 追加: 総件数
  const [modalTotalCount, setModalTotalCount] = useState<number | null>(null)
  // 追加: 戻り件数/ユニーク件数
  const [modalReturnedCount, setModalReturnedCount] = useState<number | null>(null)
  const [modalUniqueCount, setModalUniqueCount] = useState<number | null>(null)

  // メッセージページネーション用のstate
  const [messageCurrentPage, setMessageCurrentPage] = useState(1)
  const [messagePageSize, setMessagePageSize] = useState(20)

  // ユニークなメッセージキー生成（安定化）
  const getMessageKey = useCallback((m: any, idx: number) => {
    const base = m?.message_id || m?.alert_id || ''
    const lvl = m?.reply_level ?? ''
    const ts = m?.created_at || m?.date || ''
    return base ? `${base}|${lvl}|${ts}` : `row-${idx}-${ts}`
  }, [])

  // アラートが変更された際にページネーションとメッセージをリセット
  useEffect(() => {
    setMessageCurrentPage(1)
    setOpenMessages(new Set())
    setModalMessages(alert?.messages || [])
    setModalRetry(0)
    setModalTotalCount(null)
    setModalReturnedCount(null)
    setModalUniqueCount(null)
  }, [alert?.id])

  // モーダル表示時、messagesが空ならスレッドメッセージを取得
  useEffect(() => {
    const fetchThreadMessages = async () => {
      try {
        if (!isOpen) return
        if (modalMessages && modalMessages.length > 0) return
        const threadId = alert?.thread_id || alert?.threadId
        if (!threadId) return
        setModalLoading(true)
        const resp = await fetch(`/api/alerts-threaded/messages?mode=fast&limit=50&thread_id=${encodeURIComponent(threadId)}`, {
          headers: { 'Authorization': `Basic ${btoa('cmgadmin:crossadmin')}` }
        })
        if (resp.ok) {
          const data = await resp.json()
          if (data?.success) {
            const msgs = Array.isArray(data.messages) ? data.messages : []
            const normalized = msgs.map((m: any) => ({
              ...m,
              created_at: m.created_at || m.date,
              sender: m.from || m.sender,
              recipient: m.to || m.recipient,
              message_subject: m.subject || m.message_subject,
              body: m.body ? extractNewContent(m.body) : m.body,
            }))
            setModalMessages(normalized)
            if (typeof data.totalCount === 'number') setModalTotalCount(data.totalCount)
            if (typeof data.returnedCount === 'number') setModalReturnedCount(data.returnedCount)
            if (typeof data.uniqueCount === 'number') setModalUniqueCount(data.uniqueCount)
            setModalLoading(false)
            // 取得件数が総計に満たない場合は自動で full 取得
            if ((typeof data.totalCount === 'number') && normalized.length < data.totalCount) {
              refetchFull()
            } else if (normalized.length === 0 && modalRetry < 2) {
              setTimeout(() => setModalRetry((n) => n + 1), 800)
            }
          } else {
            setModalLoading(false)
            if (modalRetry < 2) setTimeout(() => setModalRetry((n) => n + 1), 800)
          }
        } else {
          setModalLoading(false)
          if (modalRetry < 2) setTimeout(() => setModalRetry((n) => n + 1), 800)
        }
      } catch (e) {
        console.error('スレッドメッセージ取得エラー:', e)
        setModalLoading(false)
        if (modalRetry < 2) setTimeout(() => setModalRetry((n) => n + 1), 800)
      }
    }
    fetchThreadMessages()
  }, [isOpen, alert?.thread_id, alert?.threadId, modalMessages?.length, modalRetry])

  // 完全表示（full再取得）
  const refetchFull = useCallback(async () => {
    try {
      const threadId = alert?.thread_id || alert?.threadId
      if (!threadId) return
      setModalLoading(true)
      const resp = await fetch(`/api/alerts-threaded/messages?mode=full&days=1&limit=500&thread_id=${encodeURIComponent(threadId)}`, {
        headers: { 'Authorization': `Basic ${btoa('cmgadmin:crossadmin')}` }
      })
      if (resp.ok) {
        const data = await resp.json()
        if (data?.success) {
          const msgs = Array.isArray(data.messages) ? data.messages : []
          const normalized = msgs.map((m: any) => ({
            ...m,
            created_at: m.created_at || m.date,
            sender: m.from || m.sender,
            recipient: m.to || m.recipient,
            message_subject: m.subject || m.message_subject,
            body: m.body ? extractNewContent(m.body) : m.body,
          }))
          setModalMessages(normalized)
          if (typeof data.totalCount === 'number') setModalTotalCount(data.totalCount)
          if (typeof data.returnedCount === 'number') setModalReturnedCount(data.returnedCount)
          if (typeof data.uniqueCount === 'number') setModalUniqueCount(data.uniqueCount)
        }
      }
    } catch (e) {
      console.error('完全表示取得エラー:', e)
    } finally {
      setModalLoading(false)
    }
  }, [alert?.thread_id, alert?.threadId])

  // メッセージの開閉状態を切り替える
  const toggleMessage = (messageId: string) => {
    setOpenMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  // すべてのメッセージを開く
  const openAllMessages = () => {
    if (modalMessages) {
      const allMessageIds = modalMessages.map((msg: any, idx: number) => 
        getMessageKey(msg, idx)
      )
      setOpenMessages(new Set(allMessageIds))
    }
  }

  // すべてのメッセージを閉じる
  const closeAllMessages = () => {
    setOpenMessages(new Set())
  }

  // ステータスバッジを取得する関数
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">
            未対応
          </Badge>
        )
      case 'in_progress':
        return (
          <Badge
            variant="secondary"
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            対応中
          </Badge>
        )
      case 'resolved':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            解決済み
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // 日付フォーマット関数
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  // スレッドチャット表示用のコンポーネント（開閉可能）
  const ThreadChatMessage = ({ message, isRoot, isOpen, onToggle }: { 
    message: any, 
    isRoot: boolean, 
    isOpen: boolean, 
    onToggle: () => void 
  }) => {
    const isCompany = !!message.isFromCompany
    const direction = isCompany ? 'Outbound' : 'Inbound'
    return (
      <div className={`flex ${isCompany ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[85%] ${isCompany ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} border rounded-lg`}>
          <div 
            className={`p-3 cursor-pointer hover:bg-opacity-80 transition-colors ${isCompany ? 'text-right' : 'text-left'}`}
            onClick={onToggle}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`flex items-center gap-2 ${isCompany ? 'flex-row-reverse' : ''} flex-1 min-w-0`}>
                <div className={`w-3 h-3 ${isCompany ? 'bg-blue-500' : 'bg-gray-400'} rounded-full flex-shrink-0`}></div>
                <div className="flex-1 min-w-0">
                  <div className={`flex items-center ${isCompany ? 'justify-end' : ''} gap-2 mb-1`}>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 border">
                      {direction}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate">
                      {message.sender || '送信者不明'}
                    </span>
                    {isRoot && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded flex-shrink-0">
                        ルート
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDate(message.created_at)}
                    </span>
                  </div>
                  {/* 方向表示: From → To */}
                  <div className={`text-[11px] text-muted-foreground ${isCompany ? 'text-right' : 'text-left'}`}>
                    {(message.sender || '')} → {(message.recipient || '不明')}
                  </div>
                  {message.in_reply_to && (
                    <div className={`text-[11px] text-muted-foreground mt-0.5 ${isCompany ? 'text-right' : 'text-left'}`}>返信先: {message.in_reply_to}</div>
                  )}
                  {message.references && (
                    <div className={`text-[11px] text-muted-foreground mt-0.5 ${isCompany ? 'text-right' : 'text-left'}`}>参照: {String(message.references).slice(0, 120)}{String(message.references).length > 120 ? '…' : ''}</div>
                  )}
                  {message.message_subject && (
                    <h5 className="text-sm font-medium text-foreground truncate mt-1">
                      {message.message_subject}
                    </h5>
                  )}
                </div>
              </div>
              <div className={`flex items-center gap-2 flex-shrink-0 ${isCompany ? 'order-first' : ''}`}>
                <div className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          {isOpen && (
            <div className={`px-3 pb-3 border-t ${isCompany ? 'border-blue-100' : 'border-gray-100'}`}>
              {message.body && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-2 font-medium">メッセージ内容</div>
                  <div className="text-sm text-foreground bg-white p-3 rounded-lg max-h-48 overflow-y-auto">
                    {extractNewContent(message.body || '')}
                  </div>
                </div>
              )}
              <div className="mt-3 text-xs text-muted-foreground">
                <div>メッセージID: {message.message_id}</div>
                {message.source_file && <div>ソース: {message.source_file}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // スレッド内のメッセージを表示するコンポーネント
  const ThreadMessage = ({ message, isRoot }: { message: any, isRoot: boolean }) => {
    return (
      <div className={`border-l-2 pl-3 py-2 ${isRoot ? 'border-l-blue-500' : 'border-l-gray-300'}`}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            {isRoot ? (
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            ) : (
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            )}
            <span className="text-sm font-medium text-foreground">
              {message.sender || '送信者不明'}
            </span>
            {isRoot && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                ルート
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDate(message.created_at)}
          </span>
        </div>
        
        {message.message_subject && (
          <h5 className="text-sm font-medium text-foreground mb-1">
            {message.message_subject}
          </h5>
        )}
        
        {message.body && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {extractNewContent(message.body || '')}
          </p>
        )}
        
        <div className="text-xs text-muted-foreground mt-1">
          {message.reply_level > 0 && `返信レベル: ${message.reply_level}`}
        </div>
      </div>
    )
  }

  // キーワードをハイライト表示するReactコンポーネント
  const HighlightedText = ({ text, keyword }: { text: string, keyword: string }) => {
    if (!text || !keyword) return <span>{text}</span>
    
    try {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escapedKeyword})`, 'gi')
      const parts = text.split(regex)
      
      return (
        <span>
          {parts.map((part, index) => 
            regex.test(part) ? (
              <mark key={index} className="bg-yellow-200 px-1 rounded font-semibold text-black">
                {part}
              </mark>
            ) : (
              <span key={index}>{part}</span>
            )
          )}
        </span>
      )
    } catch (error) {
      console.error('Highlight error:', error)
      return <span>{text}</span>
    }
  }

  const handleStatusChange = (value: string) => {
    setStatus(value)
    if (alert?.id) {
      onStatusChange(alert.id, value)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[98vh] overflow-hidden">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">
                <HighlightedText 
                  text={alert?.subject || alert?.keyword || ''} 
                  keyword={alert?.keyword || ''} 
                />
              </DialogTitle>
              <DialogDescription className="text-base mt-1">
                {alert?.id} - <HighlightedText 
                  text={alert?.keyword || ''} 
                  keyword={alert?.keyword || ''} 
                />
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {alert?.level === 'high' && (
                <Badge variant="destructive">高</Badge>
              )}
              {alert?.level === 'medium' && (
                <Badge variant="secondary">中</Badge>
              )}
              {alert?.level === 'low' && <Badge variant="outline">低</Badge>}
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">未対応</SelectItem>
                  <SelectItem value="in_progress">対応中</SelectItem>
                  <SelectItem value="resolved">解決済み</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full h-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              基本情報
            </TabsTrigger>
            <TabsTrigger value="message" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              メッセージ内容
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="basic"
            className="space-y-6 overflow-y-auto max-h-[calc(98vh-250px)]"
          >
            {/* アラート基本情報 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">基本情報</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="font-medium">アラートID</span>
                      <span className="text-muted-foreground">{alert?.id}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="font-medium">キーワード</span>
                      <span className="text-muted-foreground">
                        {alert?.keyword}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="font-medium">From（自社）</span>
                      <span className="text-muted-foreground">
                        {(() => {
                          // 1. まずsenderフィールドを確認
                          if (alert?.sender) {
                            // アングルブラケットで囲まれた形式を優先
                            const angleMatch = alert.sender.match(/<([^>]+@cross-m\.co\.jp)>/i)
                            if (angleMatch) {
                              return angleMatch[1]
                            }
                            
                            // その他のパターンで自社ドメインを検索
                            const patterns = [
                              /([a-zA-Z0-9._%+-]+@cross-m\.co\.jp)/i,  // 標準的なメールアドレス形式
                              /'([^']+@cross-m\.co\.jp)'/i,           // シングルクォートで囲まれた形式
                              /"([^"]+@cross-m\.co\.jp)"/i,           // ダブルクォートで囲まれた形式
                              /via\s+([^@]+@cross-m\.co\.jp)/i        // via で始まる形式
                            ]
                            
                            for (const pattern of patterns) {
                              const match = alert.sender.match(pattern)
                              if (match) {
                                const email = match[1] || match[0]
                                return email.trim()
                              }
                            }
                            
                            // パターンマッチしない場合は、そのまま表示
                            return alert.sender
                          }
                          
                          // 2. senderがない場合は、メッセージ配列から自社ドメインを抽出
                          if (modalMessages && modalMessages.length > 0) {
                            const rootMessage = modalMessages.find((m: any) => m.is_root === true) || modalMessages[0]
                            if (rootMessage?.from) {
                              const angleMatch = rootMessage.from.match(/<([^>]+@cross-m\.co\.jp)>/i)
                              if (angleMatch) {
                                return angleMatch[1]
                              }
                              
                              const emailMatch = rootMessage.from.match(/([a-zA-Z0-9._%+-]+@cross-m\.co\.jp)/i)
                              if (emailMatch) {
                                return emailMatch[1]
                              }
                            }
                          }
                          
                          return '送信者不明'
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      <span className="font-medium">To（顧客）</span>
                      <span className="text-muted-foreground">
                        {(() => {
                          // 1. まずcustomer_emailフィールドを確認（デフォルト値以外）
                          if (alert?.customer_email && alert.customer_email !== 'customer@example.com') {
                            const emailMatch = alert.customer_email.match(/<([^>]+)>/)
                            if (emailMatch) {
                              return emailMatch[1]
                            }
                            return alert.customer_email
                          }
                          
                          // 2. customer_emailがない場合やデフォルト値の場合は、メッセージ配列から抽出
                          if (modalMessages && modalMessages.length > 0) {
                            // ルートメッセージのTo情報を取得
                            const rootMessage = modalMessages.find((m: any) => m.is_root === true) || modalMessages[0]
                            if (rootMessage?.to) {
                              // 自社ドメイン以外のTo情報を優先
                              const nonCompanyMatch = rootMessage.to.match(/<([^>]+@(?!cross-m\.co\.jp)[^>]+)>/i)
                              if (nonCompanyMatch) {
                                return nonCompanyMatch[1]
                              }
                              
                              // アングルブラケットで囲まれた形式
                              const angleMatch = rootMessage.to.match(/<([^>]+)>/i)
                              if (angleMatch) {
                                return angleMatch[1]
                              }
                              
                              // 自社ドメイン以外のメールアドレス
                              const emailMatch = rootMessage.to.match(/([a-zA-Z0-9._%+-]+@(?!cross-m\.co\.jp)[^>]+)/i)
                              if (emailMatch) {
                                return emailMatch[1]
                              }
                              
                              // そのまま返す
                              return rootMessage.to
                            }
                          }
                          
                          return '不明'
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="font-medium">レベル</span>
                      <div>
                        {alert?.priority === 'high' && (
                          <Badge variant="destructive">高</Badge>
                        )}
                        {alert?.priority === 'medium' && (
                          <Badge variant="secondary">中</Badge>
                        )}
                        {alert?.priority === 'low' && (
                          <Badge variant="outline">低</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                      <span className="font-medium">日時</span>
                      <span className="text-muted-foreground">
                        {formatDate(alert?.created_at)}
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">部門</span>
                        <div className="text-muted-foreground mt-1 break-words">
                          {alert?.department || '不明'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">CC</span>
                        <div className="text-muted-foreground mt-1 break-words">
                          {(() => {
                            // 1. まずメッセージ配列からCC情報を抽出
                            if (modalMessages && modalMessages.length > 0) {
                              // ルートメッセージからCC情報を抽出
                              const rootMessage = modalMessages.find((m: any) => m.is_root === true) || modalMessages[0]
                              if (rootMessage?.body) {
                                const extractCCInfo = (body: string) => {
                                  if (!body) return 'なし'
                                  
                                  // 複数のパターンでCC情報を検索
                                  const patterns = [
                                    /CC:\s*([^\r\n]+)/i,
                                    /cc:\s*([^\r\n]+)/i,
                                    /Cc:\s*([^\r\n]+)/i,
                                    /BCC:\s*([^\r\n]+)/i,
                                    /bcc:\s*([^\r\n]+)/i,
                                    /Bcc:\s*([^\r\n]+)/i
                                  ]
                                  
                                  for (const pattern of patterns) {
                                    const match = body.match(pattern)
                                    if (match && match[1]) {
                                      const ccContent = match[1].trim()
                                      // 長すぎる場合は省略表示（文字数を増やす）
                                      return ccContent.length > 150 
                                        ? ccContent.substring(0, 150) + '...'
                                        : ccContent
                                    }
                                  }
                                  
                                  return 'なし'
                                }
                                
                                return extractCCInfo(rootMessage.body)
                              }
                            }
                            
                            return 'なし'
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 既存セグメント分類結果 */}
            {alert?.existing_segment_id && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">既存セグメント分類</CardTitle>
                  <CardDescription>
                    感情分析による既存セグメントシステムへの自動分類結果
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">分類セグメント</span>
                        <Badge 
                          variant="default"
                          className={`${alert.existing_segment_color || 'bg-gray-100 text-gray-800'}`}
                        >
                          {alert.existing_segment_name || '未分類'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">セグメント説明</span>
                        <span className="text-sm text-muted-foreground text-right">
                          {alert.existing_segment_description || '説明なし'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">セグメント優先度</span>
                        <Badge 
                          variant={
                            alert.existing_segment_priority === 'high' ? "destructive" :
                            alert.existing_segment_priority === 'medium' ? "secondary" : "outline"
                          }
                        >
                          {alert.existing_segment_priority === 'high' ? '高' :
                           alert.existing_segment_priority === 'medium' ? '中' : '低'}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">マッピング信頼度</span>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={(alert.mapping_confidence || 0) * 100} 
                            className="w-20" 
                          />
                          <Badge variant="secondary">
                            {((alert.mapping_confidence || 0) * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">マッピング理由</span>
                        <span className="text-sm text-muted-foreground text-right">
                          {alert.mapping_reason || '理由なし'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">感情分析結果</span>
                        <Badge 
                          variant={
                            alert.sentiment === 'urgent' ? "destructive" :
                            alert.sentiment === 'negative' ? "secondary" :
                            alert.sentiment === 'positive' ? "default" : "outline"
                          }
                        >
                          {alert.sentiment === 'urgent' ? '緊急' :
                           alert.sentiment === 'negative' ? 'ネガティブ' :
                           alert.sentiment === 'positive' ? 'ポジティブ' : '中立'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* 検知カテゴリ */}
                  {alert?.detected_categories && alert.detected_categories.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="space-y-2">
                        <span className="text-sm font-medium">検知カテゴリ</span>
                        <div className="flex flex-wrap gap-2">
                          {alert.detected_categories.map((category: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {category}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* スコアリング結果 */}
            {alert?.detection_score && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI検知結果</CardTitle>
                  <CardDescription>
                    日本語NLP分析による検知パターンとスコア
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">検知スコア</span>
                        <div className="flex items-center gap-2">
                          <Progress value={alert.detection_score * 100} className="w-20" />
                          <Badge variant="secondary">
                            {(alert.detection_score * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">検知パターン</span>
                        <Badge variant="outline" className="capitalize">
                          {alert.detected_pattern || '不明'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">リスクスコア</span>
                        <Badge 
                          variant={alert.risk_score > 0.7 ? "destructive" : alert.risk_score > 0.4 ? "secondary" : "outline"}
                        >
                          {(alert.risk_score * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">緊急度</span>
                        <Badge 
                          variant={
                            alert.urgency_level === 'critical' ? "destructive" :
                            alert.urgency_level === 'high' ? "secondary" :
                            alert.urgency_level === 'medium' ? "default" : "outline"
                          }
                        >
                          {alert.urgency_level === 'critical' ? '緊急' :
                           alert.urgency_level === 'high' ? '高' :
                           alert.urgency_level === 'medium' ? '中' : '低'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">ビジネス影響</span>
                        <Badge 
                          variant={
                            alert.business_impact === 'high' ? "destructive" :
                            alert.business_impact === 'medium' ? "secondary" : "outline"
                          }
                        >
                          {alert.business_impact === 'high' ? '高' :
                           alert.business_impact === 'medium' ? '中' : '低'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">感情スコア</span>
                        <Badge 
                          variant={
                            alert.nlp_sentiment_score > 0.3 ? "default" :
                            alert.nlp_sentiment_score < -0.3 ? "destructive" : "outline"
                          }
                        >
                          {alert.nlp_sentiment_score > 0.3 ? 'ポジティブ' :
                           alert.nlp_sentiment_score < -0.3 ? 'ネガティブ' : '中立'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* 検知キーワード */}
                  {alert?.matched_keywords && alert.matched_keywords.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="space-y-2">
                        <span className="text-sm font-medium">検知キーワード</span>
                        <div className="flex flex-wrap gap-2">
                          {alert.matched_keywords.map((keyword: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 推奨アクション */}
                  {alert?.recommended_actions && alert.recommended_actions.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="space-y-2">
                        <span className="text-sm font-medium">推奨アクション</span>
                        <div className="space-y-2">
                          {alert.recommended_actions.map((action: string, index: number) => (
                            <div key={index} className="flex items-start gap-2 text-sm">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span className="text-muted-foreground">{action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* スレッド情報 */}
            {alert?.message_count > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">スレッド情報</CardTitle>
                  <CardDescription>
                    メールスレッドの概要情報
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">メッセージ数</span>
                        <Badge variant="secondary">{alert.message_count}件</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">開始日時</span>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(alert.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">最終更新</span>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(alert.updated_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">スレッドID</span>
                        <span className="text-sm text-muted-foreground font-mono text-xs">
                          {alert.thread_id?.substring(0, 20)}...
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent
            value="message"
            className="overflow-y-auto max-h-[calc(98vh-250px)]"
          >
            {/* メッセージ履歴 */}
            {modalLoading && (
              <Card>
                <CardContent>
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>メッセージを読み込み中...</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {!modalLoading && modalMessages && modalMessages.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">メッセージ履歴</CardTitle>
                      <CardDescription>
                        左: クライアント / 右: 自社（@cross-m.co.jp系）
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openAllMessages}
                        className="text-xs"
                      >
                        すべて開く
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={closeAllMessages}
                        className="text-xs"
                      >
                        すべて閉じる
                      </Button>
                      {modalTotalCount !== null && (modalReturnedCount || 0) < modalTotalCount && (
                        <Button variant="default" size="sm" onClick={refetchFull} className="text-xs">
                          完全表示 ({modalReturnedCount || 0}/{modalTotalCount})
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* ページネーション情報 */}
                  <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                    <span>
                      {(() => {
                        const loaded = modalReturnedCount ?? (modalMessages || []).length
                        const unique = modalUniqueCount ?? (() => {
                          const seen = new Set<string>()
                          let c = 0
                          for (const m of (modalMessages || [])) {
                            const k = (m as any).message_id || (m as any).message_key || ''
                            if (!seen.has(k)) { seen.add(k); c++ }
                          }
                          return c
                        })()
                        const total = modalTotalCount ?? Math.max(loaded, unique)
                        return `表示 ${loaded} / ユニーク ${unique} / 総計 ${total}`
                      })()}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">1ページあたり:</span>
                      <Select 
                        value={String(messagePageSize)} 
                        onValueChange={(value) => setMessagePageSize(Number(value))}
                      >
                        <SelectTrigger className="w-20 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {(() => {
                      const items = modalMessages || []
                      // メッセージを受信・送信別に分類
                      const categorizedMessages = items.map((message: any) => {
                        const sender = message.from || message.sender || ''
                        const to = message.to || ''
                        
                        // より確実な分類ロジック
                        let isFromCompany = false
                        
                        // 転送サービス経由のメールの場合の処理
                        if (sender.includes('via') || sender.includes('Via')) {
                          const viaMatch = sender.match(/['"]([^'"]+)['"]\s+via\s+[^<]+<([^>]+)>/)
                          if (viaMatch) {
                            const forwardingDomain = viaMatch[2]
                            if (forwardingDomain.includes('@cross-m.co.jp')) {
                              isFromCompany = true
                            } else {
                              isFromCompany = sender.match(/@cross-m\.co\.jp/i) !== null
                            }
                          } else {
                            isFromCompany = sender.match(/@cross-m\.co\.jp/i) !== null
                          }
                        }
                        
                        if (!isFromCompany) {
                          if (sender.match(/@cross-m\.co\.jp/i)) {
                            isFromCompany = true
                          }
                        }
                        
                        return {
                          ...message,
                          isFromCompany
                        }
                      })

                      // 重複メッセージ除去（message_keyベース、message_id優先）
                      const seen = new Set<string>()
                      const withKeys = categorizedMessages.map((m: any, idx: number) => ({ m, key: (m.message_id || m.message_key || getMessageKey(m, idx)) as string }))
                      const unique = withKeys.filter(({ key }) => {
                        if (!key) return true
                        if (seen.has(key)) return false
                        seen.add(key)
                        return true
                      })
                      
                      return unique.map(({ m, key }, idx: number) => (
                        <ThreadChatMessage
                          key={key}
                          message={m}
                          isRoot={m.is_root === true}
                          isOpen={openMessages.has(key)}
                          onToggle={() => toggleMessage(key)}
                        />
                      ))
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {!modalLoading && (!modalMessages || modalMessages.length === 0) && (
              <Card>
                <CardContent>
                  <div className="flex items-center justify-between py-8">
                    <div className="text-sm text-muted-foreground">
                      メッセージはまだ読み込まれていません。詳細を開くと自動取得します。
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setModalRetry((n) => n + 1)}>
                      再読み込み
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function AlertsPageInner() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedAlert, setSelectedAlert] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    offset: 0,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })

  // 検索実行用の状態
  const [activeSearchTerm, setActiveSearchTerm] = useState('')

  // フィルター状態
  const [filters, setFilters] = useState({
    status: '',
    assignee: '',
  })

  // 表示密度
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

  // ビュー切替（一覧 or カンバン）
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  // URLクエリから初期フィルタを読み込み（assignee=me等）
  const searchParams = useSearchParams()
  useEffect(() => {
    const qpAssignee = searchParams.get('assignee')
    if (qpAssignee === 'me') {
      // 現状ユーザー識別はBasic認証のユーザー名を仮利用
      const currentUser = 'cmgadmin'
      setFilters(prev => ({ ...prev, assignee: currentUser }))
    }
    const qpStatus = searchParams.get('status')
    if (qpStatus) {
      setFilters(prev => ({ ...prev, status: qpStatus }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // セグメント選択状態
  const [selectedSegment, setSelectedSegment] = useState<string>('all')

  // セグメント選択時のハンドラー
  const handleSegmentSelect = (segment: string) => {
    setSelectedSegment(segment)
    setCurrentPage(1) // ページネーションをリセット
  }

  // APIエンドポイントをスレッド構造用に変更
  const apiEndpoint = '/api/alerts-threaded'

  // HTMLエンティティをデコードする関数
  const decodeHtmlEntities = (text: string) => {
    if (!text) return text
    const textarea = document.createElement('textarea')
    textarea.innerHTML = text
    return textarea.value
  }

  // キーワードをハイライト表示するReactコンポーネント
  const HighlightedText = ({ text, keyword }: { text: string, keyword: string }) => {
    if (!text || !keyword) return <span>{text}</span>
    
    try {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escapedKeyword})`, 'gi')
      const parts = text.split(regex)
      
      return (
        <span>
          {parts.map((part, index) => 
            regex.test(part) ? (
              <mark key={index} className="bg-yellow-200 px-1 rounded font-semibold text-black">
                {part}
              </mark>
            ) : (
              <span key={index}>{part}</span>
            )
          )}
        </span>
      )
    } catch (error) {
      console.error('Highlight error:', error)
      return <span>{text}</span>
    }
  }

  // 日付フォーマット関数
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  // セグメント別フィルタリング関数
  const filterAlertsBySegment = useCallback((alerts: any[], segment: string) => {
    if (segment === 'all') {
      return alerts // 全てのアラートを表示
    } else {
      // 既存セグメントシステムに対応
      return alerts.filter(alert => alert.existing_segment_name === segment)
    }
  }, [])

  const filteredAlerts = useMemo(() => filterAlertsBySegment(alerts, selectedSegment), [alerts, selectedSegment, filterAlertsBySegment])

  // データ取得処理
  const fetchAlerts = useCallback(async (page = 1, resetPage = false) => {
    setLoading(true)
    setLoadingProgress(0)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: resetPage ? '1' : page.toString(),
        limit: '20' // 固定値を使用
      })
      
      if (filters.status) params.append('status', filters.status)
      if (filters.assignee) params.append('assignee', filters.assignee === 'cmgadmin' ? 'me' : filters.assignee)
      if (activeSearchTerm && activeSearchTerm.trim() !== '') {
        params.append('search', activeSearchTerm.trim())
      }

      // 初期ロード負荷軽減: メッセージは含めない（期間はデフォルト未指定で全体から取得）
      params.append('include_messages', 'false')
      
      const response = await fetch(`${apiEndpoint}?${params}`, {
        headers: {
          'Authorization': `Basic ${btoa('cmgadmin:crossadmin')}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        // アラートデータの正規化
        const normalizedAlerts = (data.alerts || []).map((alert: any, index: number) => {
          // 一意のIDを確実に生成
          const uniqueId = alert.id || alert.thread_id || alert.threadId || `alert-${index}-${Date.now()}`
          const uniqueThreadId = alert.thread_id || alert.threadId || `thread-${uniqueId}`
          
          return {
            // スレッド情報を確実に含める
            id: uniqueId,
            thread_id: uniqueThreadId,
            // 件名はAPIから返されるものをそのまま使用（重複を防ぐ）
            subject: alert.subject || alert.description || '件名なし',
            keyword: decodeHtmlEntities(alert.keyword || 'キーワードなし'),
            sender: decodeHtmlEntities(alert.sender || alert.person || '送信者不明'),
            customer_email: decodeHtmlEntities(alert.customer_email || 'メール不明'),
            // 日付フォーマットの統一
            created_at: alert.created_at || alert.datetime,
            updated_at: alert.updated_at || alert.datetime,
            // レベルの正規化
            priority: alert.priority || alert.level || 'medium',
            // ステータスの日本語化
            status: alert.status || 'pending',
            // メッセージ数
            message_count: alert.message_count || 1,
            // その他の必要なフィールド
            body: alert.body || alert.messageBody,
            messages: alert.messages,
            // 感情分析とマッピング結果を保持
            sentiment: alert.sentiment,
            priority_score: alert.priority_score,
            detected_categories: alert.detected_categories,
            detected_categories_english: alert.detected_categories_english,
            keywords_found: alert.keywords_found,
            // 既存セグメントマッピング結果を保持
            existing_segment_id: alert.existing_segment_id,
            existing_segment_name: alert.existing_segment_name,
            existing_segment_description: alert.existing_segment_description,
            existing_segment_color: alert.existing_segment_color,
            existing_segment_priority: alert.existing_segment_priority,
            mapping_reason: alert.mapping_reason,
            mapping_confidence: alert.mapping_confidence
          }
        })
        
        setAlerts(normalizedAlerts)
        
        // ページネーション情報の更新
        if (data.pagination) {
          setPagination({
            page: data.pagination.page || page,
            limit: 20, // 固定値を使用
            offset: data.pagination.offset || 0,
            total: data.pagination.total || 0,
            totalPages: data.pagination.totalPages || Math.ceil((data.pagination.total || 0) / 20),
            hasNext: data.pagination.hasNext || false,
            hasPrev: data.pagination.hasPrev || false
          })
        }
        
        setLoading(false)
      } else {
        throw new Error(data.message || 'データの取得に失敗しました')
      }
    } catch (error: any) {
      console.error('Error fetching alerts:', error)
      setError(error.message)
      setAlerts([])
      setPagination({
        page: 1,
        limit: 20,
        offset: 0,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      })
      
      setLoading(false)
    }
  }, [activeSearchTerm, filters]) // pagination.limitを依存配列から削除

  // ページネーション処理
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchAlerts(page)
  }

  // フィルター変更時の処理
  const handleFilterChange = () => {
    setCurrentPage(1)
    fetchAlerts(1, true)
  }

  // 検索条件変更時のデータ取得
  useEffect(() => {
    if (activeSearchTerm !== searchTerm) {
      setCurrentPage(1)
      fetchAlerts(1, true)
    }
  }, [activeSearchTerm])

  // 検索語が空になった場合の処理
  useEffect(() => {
    if (searchTerm === '' && activeSearchTerm !== '') {
      setActiveSearchTerm('')
      setCurrentPage(1)
      fetchAlerts(1, true)
    }
  }, [searchTerm, activeSearchTerm])

  // フィルター変更時のデータ取得
  useEffect(() => {
    handleFilterChange()
  }, [filters.status])

  // 初期データ取得
  useEffect(() => {
    fetchAlerts(1, true)
  }, []) // 初回のみ実行

  // メモ化されたページネーション計算
  const paginationInfo = useMemo(() => {
    const start = ((pagination.page - 1) * pagination.limit) + 1
    const end = Math.min(pagination.page * pagination.limit, pagination.total)
    return { start, end }
  }, [pagination])

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <Badge variant="destructive">高</Badge>
      case 'medium':
        return <Badge variant="secondary">中</Badge>
      case 'low':
        return <Badge variant="outline">低</Badge>
      default:
        return <Badge variant="outline">{level}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">
            未対応
          </Badge>
        )
      case 'in_progress':
        return (
          <Badge
            variant="secondary"
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            対応中
          </Badge>
        )
      case 'resolved':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            解決済み
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // メール本文から「To」情報を抽出する関数
  const extractToInfo = (body: string) => {
    if (!body) return '不明'
    
    // 複数のパターンで「To」情報を検索
    const patterns = [
      /To:\s*([^\r\n]+)/i,
      /宛先:\s*([^\r\n]+)/i,
      /送信先:\s*([^\r\n]+)/i,
      /for\s+<([^>]+)>/i,
      /Delivered-To:\s*([^\r\n]+)/i
    ]
    
    for (const pattern of patterns) {
      const match = body.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
    
    return '不明'
  }

  const handleAlertClick = (alert: any) => {
    setSelectedAlert(alert)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedAlert(null)
  }

  const handleStatusChange = (id: string, status: string) => {
    setAlerts(prev => 
      prev.map((a: any) => (a.id === id ? { ...a, status } : a))
    )
    setSelectedAlert((prev: any) => {
      if (prev && prev.id === id) {
        return { ...prev, status }
      }
      return prev
    })
  }

  // 高速ページジャンプ
  const handleQuickJump = (direction: 'start' | 'end') => {
    const targetPage = direction === 'start' ? 1 : pagination.totalPages
    handlePageChange(targetPage)
  }

  // スケルトンローディングコンポーネント
  const AlertSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[80%]" />
        </div>
      ))}
    </div>
  )

  // 仮想化のための表示件数制限
  const [displayLimit, setDisplayLimit] = useState(20)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // 無限スクロールの実装
  const loadMore = useCallback(async () => {
    if (isLoadingMore || alerts.length >= pagination.total) return
    
    setIsLoadingMore(true)
    try {
      const newLimit = displayLimit + 20
      setDisplayLimit(newLimit)
      
      const response = await fetch(`/api/alerts-current?limit=${newLimit}&offset=0`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setAlerts(result.data)
        }
      }
    } catch (error) {
      console.error('追加データ読み込みエラー:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, alerts.length, pagination.total, displayLimit])

  // スクロールイベントの監視
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1000) {
        loadMore()
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadMore])

  // ステータス正規化（カンバン用）: フック順序を安定させるため loading 分岐より前に配置
  const normalizeStatus = useCallback((status: string): 'pending' | 'in_progress' | 'resolved' => {
    if (!status) return 'pending'
    if (['pending', '未対応', '新規', 'new'].includes(status)) return 'pending'
    if (['in_progress', '対応中', 'progress'].includes(status)) return 'in_progress'
    if (['resolved', '解決済み', 'done'].includes(status)) return 'resolved'
    return 'pending'
  }, [])

  const kanbanColumns = useMemo(() => {
    const cols: Record<'pending' | 'in_progress' | 'resolved', any[]> = {
      pending: [],
      in_progress: [],
      resolved: [],
    }
    filteredAlerts.forEach(a => {
      cols[normalizeStatus(a.status)].push(a)
    })
    return cols
  }, [filteredAlerts, normalizeStatus])

  // ローディング中の表示
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">アラート一覧</h1>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
        
        {/* プログレスバー */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">データ読み込み中</span>
            <span className="text-sm text-muted-foreground">{Math.round(loadingProgress)}%</span>
          </div>
          <Progress value={loadingProgress} className="w-full" />
        </div>

        {/* スケルトンローディング */}
        <AlertSkeleton />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 px-4 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">アラート分析ダッシュボード</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            セグメント別アラート管理とパターン分析
          </p>
        </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左カラム: セグメント一覧 */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    AI戦略提案（セグメント）
                  </CardTitle>
                  <CardDescription>セールス視点の提案セグメントをワンタップ切替</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 overflow-y-auto max-h-[1078px]">
                  {/* 全てのアラート */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedSegment === 'all'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-gray-50 dark:bg-gray-900/20'
                    }`}
                    onClick={() => handleSegmentSelect('all')}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200 flex-shrink-0">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-sm truncate">全てのアラート</h3>
                          <Badge variant="default" className="text-xs flex-shrink-0 ml-2">
                            {pagination.total}件
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">検知対象・非対象を含む全アラート</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            全体
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>



                  {/* クレーム・苦情系 */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedSegment === 'クレーム・苦情系'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-red-200 dark:border-red-800 hover:border-red-300'
                    }`}
                    onClick={() => handleSegmentSelect('クレーム・苦情系')}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200 flex-shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-sm truncate">クレーム・苦情系</h3>
                          <Badge variant="secondary" className="text-xs flex-shrink-0 ml-2">
                            {alerts.filter(alert => alert.existing_segment_name === 'クレーム・苦情系').length}件
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">顧客からの強い不満や苦情の検出</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">
                            高リスク
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 催促・未対応の不満 */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedSegment === '催促・未対応の不満'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-orange-200 dark:border-orange-800 hover:border-orange-300'
                    }`}
                    onClick={() => handleSegmentSelect('催促・未対応の不満')}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200 flex-shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-sm truncate">催促・未対応の不満</h3>
                          <Badge variant="secondary" className="text-xs flex-shrink-0 ml-2">
                            {alerts.filter(alert => alert.existing_segment_name === '催促・未対応の不満').length}件
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">対応の遅れや催促への不満の検出</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            中リスク
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 社内向け危機通報 */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedSegment === '社内向け危機通報'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-indigo-200 dark:border-indigo-800 hover:border-indigo-300'
                    }`}
                    onClick={() => handleSegmentSelect('社内向け危機通報')}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200 flex-shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-sm truncate">社内向け危機通報</h3>
                          <Badge variant="secondary" className="text-xs flex-shrink-0 ml-2">
                            {alerts.filter(alert => alert.existing_segment_name === '社内向け危機通報').length}件
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">社内での危機的な状況の通報</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">
                            内部危機
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 契約・商談 */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedSegment === '契約・商談'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-green-200 dark:border-green-800 hover:border-green-300'
                    }`}
                    onClick={() => handleSegmentSelect('契約・商談')}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200 flex-shrink-0">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-sm truncate">契約・商談</h3>
                          <Badge variant="secondary" className="text-xs flex-shrink-0 ml-2">
                            {alerts.filter(alert => alert.existing_segment_name === '契約・商談').length}件
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">契約や商談に関するアラート</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs">
                            営業機会
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 営業プロセス */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedSegment === '営業プロセス'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-blue-200 dark:border-blue-800 hover:border-blue-300'
                    }`}
                    onClick={() => handleSegmentSelect('営業プロセス')}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 flex-shrink-0">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-sm truncate">営業プロセス</h3>
                          <Badge variant="secondary" className="text-xs flex-shrink-0 ml-2">
                            {alerts.filter(alert => alert.existing_segment_name === '営業プロセス').length}件
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">営業プロセスに関するアラート</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs">
                            営業
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 顧客サポート */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedSegment === '顧客サポート'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-purple-200 dark:border-purple-800 hover:border-purple-300'
                    }`}
                    onClick={() => handleSegmentSelect('顧客サポート')}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200 flex-shrink-0">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-sm truncate">顧客サポート</h3>
                          <Badge variant="secondary" className="text-xs flex-shrink-0 ml-2">
                            {alerts.filter(alert => alert.existing_segment_name === '顧客サポート').length}件
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">顧客サポートに関するアラート</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            サポート
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>


                </CardContent>
              </Card>
            </div>

            {/* 右カラム: アラート一覧 */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <CardTitle className="text-base">
                        アラート一覧
                                                 {selectedSegment !== 'all' && (
                           <span className="text-sm font-normal text-muted-foreground ml-2">
                             ({filteredAlerts.length}件)
                           </span>
                         )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {selectedSegment === 'all' 
                          ? '全てのアラートデータ'
                          : `${selectedSegment}に該当するアラート`
                        }
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        <Download className="h-3 w-3 mr-2" />
                        エクスポート
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-y-auto max-h-[1078px]">
            {/* エラー表示 */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">エラー:</strong>
                <span className="block sm:inline"> {error}</span>
                <span className="absolute top-0 bottom-0 right-0 px-4 py-3">
                  <button onClick={() => setError(null)} className="text-red-500 hover:text-red-900">
                    <span className="text-2xl">&times;</span>
                  </button>
                </span>
              </div>
            )}

            {/* フィルター */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 sticky top-0 bg-background pt-2 pb-2 z-10">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="件名、送信者、本文で検索（Enterキーで検索実行）..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          setActiveSearchTerm(searchTerm);
                          setCurrentPage(1); // 検索結果を最初のページに戻す
                          fetchAlerts(1, true);
                        }
                      }}
                      className="pl-10 pr-10 h-9"
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchTerm('');
                          setActiveSearchTerm('');
                          setCurrentPage(1);
                          fetchAlerts(1, true);
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setActiveSearchTerm(searchTerm);
                      setCurrentPage(1);
                      fetchAlerts(1, true);
                    }}
                    className="h-9"
                  >
                    検索
                  </Button>
                  <div className="flex gap-2 sm:gap-3">
                    <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger className="w-full sm:w-[140px] h-9">
                        <SelectValue placeholder="対応状況" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべての状況</SelectItem>
                        <SelectItem value="pending">未対応</SelectItem>
                        <SelectItem value="in_progress">対応中</SelectItem>
                        <SelectItem value="resolved">解決済み</SelectItem>
                      </SelectContent>
                    </Select>
                    {/* 表示密度トグル */}
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={density === 'comfortable' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDensity('comfortable')}
                        className="h-9"
                        title="快適"
                      >
                        <Rows className="h-4 w-4 mr-1" />快適
                      </Button>
                      <Button
                        type="button"
                        variant={density === 'compact' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDensity('compact')}
                        className="h-9"
                        title="密"
                      >
                        <List className="h-4 w-4 mr-1" />密
                      </Button>
                    </div>
                    {/* ビュー切替（一覧/カンバン） */}
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={viewMode === 'list' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="h-9"
                        title="一覧"
                      >
                        <Rows className="h-4 w-4 mr-1" />一覧
                      </Button>
                      <Button
                        type="button"
                        variant={viewMode === 'kanban' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('kanban')}
                        className="h-9"
                        title="カンバン"
                      >
                        <LayoutGrid className="h-4 w-4 mr-1" />カンバン
                      </Button>
                    </div>
                    {/* assignee=me が有効なときの表示 */}
                    {filters.assignee && (
                      <Badge variant="outline" className="self-center">自分の担当のみ</Badge>
                    )}
                  </div>
                </div>

            {/* ローディング表示 */}
            {loading && (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <AlertSkeleton key={i} />
                ))}
              </div>
            )}

                {/* アラート一覧 / カンバン */}
            {!loading && (
              <>
                {viewMode === 'list' ? (
                  <div className="space-y-2">
                    {filteredAlerts.map((alert: any, index: number) => (
                      <div
                        key={`${alert.id || (alert.thread_id ? alert.thread_id + '-' + index : index)}`}
                        className={`${density === 'compact' ? 'p-2' : 'p-3'} border rounded-lg hover:shadow-md transition-all cursor-pointer bg-card hover:bg-accent/50 border-l-4 ${
                           alert.priority === 'high'
                             ? 'border-l-red-500'
                             : alert.priority === 'medium'
                             ? 'border-l-yellow-500'
                             : 'border-l-blue-500'
                         }`}
                        onClick={() => handleAlertClick(alert)}
                      >
                        {/* メイン情報行 */}
                        <div className={`flex flex-col sm:flex-row sm:items-center justify-between ${density === 'compact' ? 'gap-1 mb-1' : 'gap-2 mb-2'}`}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {alert.priority === 'high' ? (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              ) : alert.priority === 'medium' ? (
                                <AlertCircle className="w-4 h-4 text-yellow-500" />
                              ) : (
                                <Info className="w-4 h-4 text-blue-500" />
                              )}
                              <div className={`${density === 'compact' ? 'text-xs' : 'text-sm'} font-semibold text-foreground`}>
                                 {alert.id}
                               </div>
                             </div>

                            <div className={`flex items-center ${density === 'compact' ? 'gap-1' : 'gap-2'} flex-1 min-w-0`}>
                              <h4 className={`font-medium ${density === 'compact' ? 'text-xs' : 'text-sm'} truncate`}>
                                <HighlightedText 
                                  text={alert.subject || alert.keyword} 
                                  keyword={alert.keyword} 
                                />
                              </h4>
                              {getLevelBadge(alert.priority)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {getStatusBadge(alert.status)}
                            {/* スレッド情報 */}
                            <div className={`${density === 'compact' ? 'text-[10px] px-1 py-0.5' : 'text-xs px-2 py-1'} text-muted-foreground bg-muted rounded`}>
                               {alert.message_count || 1}件
                             </div>
                          </div>
                        </div>

                        {/* 詳細情報行 */}
                        <div className={`flex flex-col sm:flex-row sm:items-center justify-between ${density === 'compact' ? 'text-[10px]' : 'text-xs'} text-muted-foreground gap-1 sm:gap-0`}>
                           <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                             <span>{formatDate(alert.created_at)}</span>
                             <span>送信者: {alert.sender}</span>
                             {alert.message_count > 1 && (
                               <span>最終更新: {formatDate(alert.updated_at)}</span>
                             )}
                           </div>
                           <span>詳細を表示 →</span>
                         </div>

                        {/* 説明と顧客情報 */}
                        <div className={`${density === 'compact' ? 'mt-1 pt-1' : 'mt-2 pt-2'} border-t border-border/50`}>
                           <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                             <p className={`${density === 'compact' ? 'text-[10px]' : 'text-xs'} text-muted-foreground flex-1 line-clamp-2`}>
                               {alert.subject}
                             </p>
                             <div className="text-xs text-muted-foreground flex-shrink-0 sm:text-right">
                               顧客: {alert.customer_email}
                             </div>
                           </div>
                         </div>

                        {/* 既存セグメント分類表示 */}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {([
                      { key: 'pending', title: '未対応', color: 'border-red-300', badgeVariant: 'destructive' },
                      { key: 'in_progress', title: '対応中', color: 'border-yellow-300', badgeVariant: 'secondary' },
                      { key: 'resolved', title: '解決済み', color: 'border-green-300', badgeVariant: 'default' },
                    ] as const).map(col => (
                      <div key={col.key} className={`rounded-lg border ${col.color} bg-card`}>
                        <div className="p-3 border-b flex items-center justify-between">
                          <div className="text-sm font-semibold">{col.title}</div>
                          <Badge variant="outline" className="text-xs">
                            {kanbanColumns[col.key].length}件
                          </Badge>
                        </div>
                        <div className="p-3 space-y-2">
                          {kanbanColumns[col.key].map((alert: any, index: number) => (
                            <div
                              key={`${alert.id || (alert.thread_id ? alert.thread_id + '-' + index : index)}`}
                              className="border rounded p-2 bg-background hover:bg-accent/50 cursor-pointer"
                              onClick={() => handleAlertClick(alert)}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="text-xs font-semibold truncate max-w-[180px]">
                                    <HighlightedText text={alert.subject || alert.keyword} keyword={alert.keyword} />
                                  </div>
                                  {getLevelBadge(alert.priority)}
                                </div>
                                <div className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {alert.message_count || 1}件
                                </div>
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                <span>{formatDate(alert.created_at)}</span>
                                <span className="truncate max-w-[140px]">{alert.sender}</span>
                              </div>
                            </div>
                          ))}
                          {kanbanColumns[col.key].length === 0 && (
                            <div className="text-xs text-muted-foreground text-center py-4">
                              該当なし
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

                {/* ページネーション */}
                {(selectedSegment === 'all' ? pagination.totalPages > 1 : filteredAlerts.length > pagination.limit) && (
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t gap-4">
                    <div className="text-sm text-muted-foreground">
                      {selectedSegment === 'all' ? (
                        <>
                          {pagination.total.toLocaleString()}件中 {paginationInfo.start.toLocaleString()}〜
                          {paginationInfo.end.toLocaleString()}件を表示
                        </>
                      ) : (
                        <>
                          {filteredAlerts.length.toLocaleString()}件中 {Math.min((currentPage - 1) * pagination.limit + 1, filteredAlerts.length).toLocaleString()}〜
                          {Math.min(currentPage * pagination.limit, filteredAlerts.length).toLocaleString()}件を表示
                        </>
                      )}
                    </div>
                    
                                         <div className="flex items-center gap-2 flex-wrap">
                       {/* 最初・最後へのジャンプボタン */}
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleQuickJump('start')}
                         disabled={selectedSegment === 'all' ? pagination.page === 1 : currentPage === 1}
                         className="hidden sm:flex"
                       >
                        <SkipBack className="w-4 h-4" />
                        最初
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                                                 onClick={() => handlePageChange((selectedSegment === 'all' ? pagination.page : currentPage) - 1)}
                         disabled={selectedSegment === 'all' ? !pagination.hasPrev : currentPage <= 1}
                       >
                        <ChevronLeft className="w-4 h-4" />
                        前へ
                      </Button>
                      
                                              {/* ページ番号表示（レスポンシブ対応） */}
                                                <div className="flex items-center gap-1">
                          {selectedSegment === 'all' ? (
                            <>
                              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                let page: number
                                if (pagination.totalPages <= 5) {
                                  page = i + 1
                                } else {
                                  const start = Math.max(1, pagination.page - 2)
                                  const end = Math.min(pagination.totalPages, start + 4)
                                  const adjustedStart = Math.max(1, end - 4)
                                  page = adjustedStart + i
                                }
                                if (page <= pagination.totalPages) {
                                  return (
                                    <Button
                                      key={page}
                                      variant={page === pagination.page ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => handlePageChange(page)}
                                      className="w-8 h-8 p-0"
                                    >
                                      {page}
                                    </Button>
                                  )
                                }
                                return null
                              })}
                              {pagination.totalPages > 5 && pagination.page < pagination.totalPages - 2 && (
                                <>
                                  <span className="text-muted-foreground">...</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(pagination.totalPages)}
                                    className="w-8 h-8 p-0"
                                  >
                                    {pagination.totalPages}
                                  </Button>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              {Array.from({ length: Math.ceil(filteredAlerts.length / pagination.limit) }).map((_, i) => (
                                <Button
                                  key={i + 1}
                                  variant={i + 1 === currentPage ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(i + 1)}
                                  className="w-8 h-8 p-0"
                                >
                                  {i + 1}
                                </Button>
                              ))}
                            </>
                          )}
                        </div>

                      <Button
                        variant="outline"
                        size="sm"
                                                 onClick={() => handlePageChange((selectedSegment === 'all' ? pagination.page : currentPage) + 1)}
                         disabled={selectedSegment === 'all' ? !pagination.hasNext : currentPage * pagination.limit >= filteredAlerts.length}
                       >
                        次へ
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickJump('end')}
                        disabled={pagination.page === pagination.totalPages}
                        className="hidden sm:flex"
                      >
                        最後
                        <SkipForward className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {alerts.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">該当するアラートが見つかりません</h3>
                    <p className="text-sm">検索条件を変更するか、フィルターをリセットしてください</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => {
                        setSearchTerm('')
                        setActiveSearchTerm('')
                        setFilters(prev => ({ ...prev, status: '' }))
                        setCurrentPage(1)
                        fetchAlerts(1, true)
                      }}
                    >
                      フィルターをリセット
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* アラート詳細モーダル */}
      <AlertDetailModal
        alert={selectedAlert}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">読み込み中...</div>}>
      <AlertsPageInner />
    </Suspense>
  )
}

// 自社グループドメイン判定用
const COMPANY_DOMAIN_REGEX = /@(?:ml\.)?cross-m\.co\.jp/i

// 引用部除去（新規本文抽出）
function extractNewContent(raw: string): string {
  if (!raw) return ''
  try {
    // 最も一般的な区切りで先頭部分を抽出
    const separators = [
      /\n-{2,}\s*Original Message\s*-{2,}/i,
      /\nOn .* wrote:\n/i,
      /\nFrom:\s.*\nSent:\s.*\nTo:\s.*\nSubject:\s.*/i,
      /\n> .*/,
      /\n-----\s*Forwarded message\s*-----/i,
      /\n開始メッセージ:/, // 日本語系パターン（ダミー）
    ]
    for (const sep of separators) {
      const idx = raw.search(sep)
      if (idx > 0) return raw.slice(0, idx).trim()
    }
    // フォールバック: 先頭の引用行（>）を除去
    const lines = raw.split(/\r?\n/)
    const cleaned = lines.filter((l) => !/^>/.test(l.trim())).join('\n').trim()
    return cleaned || raw
  } catch {
    return raw
  }
}
