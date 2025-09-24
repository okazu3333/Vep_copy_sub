"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    AlertTriangle,
    Bell,
    ChevronLeft,
    ChevronRight,
    Database,
    LayoutDashboard,
    Settings,
    Users,
    Shield
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

const menuItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/alerts", label: "アラート一覧", icon: AlertTriangle },
  // レポートメニューを削除
  { href: "/keywords/segments", label: "フレーズ設定", icon: Settings },
  { href: "/users", label: "ユーザー管理", icon: Users },
  { href: "/notifications", label: "通知管理", icon: Bell },
  { href: "/customers", label: "顧客情報管理", icon: Database },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header with SalesGuard logo - aligned with main header height */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 h-[73px]">
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
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
