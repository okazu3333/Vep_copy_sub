"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    AlertTriangle,
    BarChart3,
    Bell,
    ChevronLeft,
    ChevronRight,
    Database,
    LayoutDashboard,
    Settings,
    Users
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
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {!collapsed && <h1 className="text-sm font-semibold text-foreground">SalesGuard</h1>}
        <Button variant="ghost" size="sm" onClick={() => setCollapsed(!collapsed)} className="ml-auto">
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
                    "group relative flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors border border-transparent",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-200 dark:border-indigo-900"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800",
                  )}
                >
                  <Icon className={cn("h-5 w-5 mr-3 flex-shrink-0",
                    isActive ? "text-indigo-700 dark:text-indigo-300" : "text-gray-500 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-100"
                  )} />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
