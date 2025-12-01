"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    AlertTriangle,
    Bell,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Database,
    LayoutDashboard,
    Settings,
    Users,
    Shield,
    User,
    FolderTree
} from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

const menuItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  // アラート一覧は展開可能メニューとして後で処理
]

// マスタ管理配下のメニュー
const masterMenuItems = [
  { href: "/users", label: "ユーザー管理", icon: Users },
  { href: "/customers", label: "顧客情報管理", icon: Database },
  { href: "/notifications", label: "通知管理", icon: Bell },
  { href: "/rules", label: "検知ルール管理", icon: Settings },
]

interface Member {
  id: string;
  name: string;
  email: string;
  department?: string;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [masterOpen, setMasterOpen] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentAssignee = searchParams.get('assignee')

  // マスタ管理ページにいる場合は展開
  useEffect(() => {
    if (pathname === '/users' || pathname === '/customers' || pathname === '/notifications' || pathname === '/rules') {
      setMasterOpen(true)
    }
  }, [pathname])

  // アラートページにいる場合は展開
  useEffect(() => {
    if (pathname === '/alerts') {
      setAlertsOpen(true)
    }
  }, [pathname])

  // メンバー一覧を取得
  useEffect(() => {
    if (!collapsed && alertsOpen) {
      fetchMembers()
    }
  }, [collapsed, alertsOpen])

  const fetchMembers = async () => {
    if (members.length > 0) return // 既に取得済み
    setLoadingMembers(true)
    try {
      // ダミーデータを使用（管理者が自チームメンバーのアラート状況を確認するため）
      const { DUMMY_MEMBERS } = await import('@/data/mock/dummyMembers')
      const memberList = DUMMY_MEMBERS.map((m) => ({
        id: m.email,
        name: m.name,
        email: m.email,
        department: m.department
      }))
        .sort((a: Member, b: Member) => {
          // 部署名でソート、次に名前でソート
          if (a.department && b.department) {
            if (a.department !== b.department) {
              return a.department.localeCompare(b.department, 'ja')
            }
          }
          return a.name.localeCompare(b.name, 'ja')
        })
      setMembers(memberList)
    } catch (error) {
      console.error('Failed to fetch members:', error)
      // フォールバック: ダミーメンバーを直接使用
      const fallbackMembers: Member[] = [
        { id: 'tanaka@cross-m.co.jp', name: '田中太郎', email: 'tanaka@cross-m.co.jp', department: '営業部' },
        { id: 'sato@cross-m.co.jp', name: '佐藤花子', email: 'sato@cross-m.co.jp', department: '営業部' },
        { id: 'yamada@cross-m.co.jp', name: '山田次郎', email: 'yamada@cross-m.co.jp', department: '営業部' },
        { id: 'suzuki@cross-m.co.jp', name: '鈴木一郎', email: 'suzuki@cross-m.co.jp', department: 'エンタープライズ営業' },
        { id: 'ito@cross-m.co.jp', name: '伊藤美咲', email: 'ito@cross-m.co.jp', department: 'アカウント営業' },
      ]
      setMembers(fallbackMembers)
    } finally {
      setLoadingMembers(false)
    }
  }

  const isAlertsPage = pathname === '/alerts'
  const isAlertsActive = isAlertsPage && !currentAssignee
  const isMasterPage = pathname === '/users' || pathname === '/customers' || pathname === '/notifications'

  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header with SalesGuard logo - aligned with main header height */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 h-[73px] bg-white/95 backdrop-blur dark:bg-gray-800/95">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-3 text-gray-900 dark:text-white hover:text-blue-600 transition-colors">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-none">SalesGuard</h1>
              <span className="text-xs text-gray-500 dark:text-gray-400">リスク監視システム</span>
            </div>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="flex items-center justify-center">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
          </Link>
        )}
        <Button variant="ghost" size="sm" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="mt-3">
        <ul className="space-y-1 px-2">
          {/* ダッシュボード */}
          <li>
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                pathname === "/dashboard"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
              )}
            >
              <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>ダッシュボード</span>}
            </Link>
          </li>

          {/* アラート一覧（展開可能） */}
          {!collapsed ? (
            <Collapsible open={alertsOpen} onOpenChange={setAlertsOpen}>
              <li>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isAlertsPage
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>アラート一覧</span>
                    </div>
                    {alertsOpen ? (
                      <ChevronUp className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-3 py-1">
                    <li>
                      <Link
                        href="/alerts"
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors",
                          isAlertsActive
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-medium"
                            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50",
                        )}
                      >
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        <span>すべて</span>
                      </Link>
                    </li>
                    {loadingMembers && (
                      <li className="px-2 py-1.5 text-xs text-gray-500">
                        読み込み中...
                      </li>
                    )}
                    {!loadingMembers && members.length === 0 && (
                      <li className="px-2 py-1.5 text-xs text-gray-500">
                        メンバーが見つかりません
                      </li>
                    )}
                    {members.map((member) => {
                      const isActive = currentAssignee === member.email
                      return (
                        <li key={member.id}>
                          <Link
                            href={`/alerts?assignee=${encodeURIComponent(member.email)}`}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors",
                              isActive
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-medium"
                                : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50",
                            )}
                          >
                            <User className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{member.name}</span>
                            {member.department && (
                              <span className="text-[10px] text-gray-400 truncate">
                                ({member.department})
                              </span>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </CollapsibleContent>
              </li>
            </Collapsible>
          ) : (
            <li>
              <Link
                href="/alerts"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  isAlertsPage
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
                )}
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              </Link>
            </li>
          )}

          {/* マスタ管理（展開可能） */}
          {!collapsed ? (
            <Collapsible open={masterOpen} onOpenChange={setMasterOpen}>
              <li>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isMasterPage
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <FolderTree className="h-4 w-4 flex-shrink-0" />
                      <span>マスタ管理</span>
                    </div>
                    {masterOpen ? (
                      <ChevronUp className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-3 py-1">
                    {masterMenuItems.map((item) => {
                      const Icon = item.icon
                      const isActive = pathname === item.href
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors",
                              isActive
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-medium"
                                : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50",
                            )}
                          >
                            <Icon className="h-3 w-3 flex-shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </CollapsibleContent>
              </li>
            </Collapsible>
          ) : (
            <li>
              <Link
                href="/users"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  isMasterPage
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
                )}
              >
                <FolderTree className="h-4 w-4 flex-shrink-0" />
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </div>
  )
}
