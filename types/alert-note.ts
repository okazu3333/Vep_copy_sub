export interface AlertNote {
  id: string
  alertId: string
  author: string
  content: string
  createdAt: string
  parentId?: string | null // スレッド用: 親コメントのID（nullの場合はトップレベル）
  resolved?: boolean // 解決フラグ
  resolvedAt?: string | null // 解決日時
  resolvedBy?: string | null // 解決したユーザー
}
