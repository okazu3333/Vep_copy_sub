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
    Settings,
    Users
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

const menuItems = [
  { href: "/alerts", label: "アラート一覧", icon: AlertTriangle },
  { href: "/keywords/segments", label: "フレーズ設定", icon: Settings },
  { href: "/users", label: "ユーザー管理", icon: Users },
  { href: "/notifications", label: "通知管理", icon: Bell },
  { href: "/dashboard", label: "レポート", icon: BarChart3 },
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
        {!collapsed && <h1 className="text-xl font-bold text-gray-900 dark:text-white">SalesGuard</h1>}
        <Button variant="ghost" size="sm" onClick={() => setCollapsed(!collapsed)} className="ml-auto">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="mt-6">
        <ul className="space-y-2 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
                  )}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
