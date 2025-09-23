"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, Moon, Sun, User, LogOut, LayoutDashboard, Search } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"

export function Header() {
  const { theme, setTheme } = useTheme()

  return (
    <header className="bg-white/90 backdrop-blur border-b border-gray-200 dark:bg-gray-800/70 dark:border-gray-700 px-6 py-3">
      <div className="flex items-center gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-900 dark:text-white">
            <LayoutDashboard className="h-5 w-5" />
            <h2 className="text-base font-semibold leading-none">SalesGuard</h2>
          </Link>
        </div>

        {/* Search */}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-2xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="検索（件名・本文・顧客・担当者）" />
          </div>
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Bell className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                  <AvatarFallback>田中</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">田中太郎</p>
                  <p className="text-xs leading-none text-muted-foreground">tanaka@company.com</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>プロフィール</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>ログアウト</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
