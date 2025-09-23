"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Building,
    Edit,
    Mail,
    Plus,
    Search,
    Trash2,
    Users
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="destructive">管理者</Badge>
      case "manager":
        return <Badge variant="secondary">マネージャー</Badge>
      case "user":
      case "agent":
        return <Badge variant="outline">一般ユーザー</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  const getStatusBadge = (active: boolean) => {
    return active
      ? <Badge variant="default" className="bg-green-500 hover:bg-green-600">アクティブ</Badge>
      : <Badge variant="secondary">非アクティブ</Badge>
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const resp = await fetch(`/api/users?${params.toString()}`, { headers: { 'Authorization': `Basic ${btoa('cmgadmin:crossadmin')}` }})
      const json = await resp.json()
      if (json?.success) setData(json.users)
      else setData([])
    } catch {
      setData([])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])
  useEffect(() => { const t = setTimeout(fetchUsers, 300); return () => clearTimeout(t) }, [searchTerm, roleFilter, statusFilter])

  const filteredUsers = useMemo(() => data, [data])

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">ユーザー管理</h1>
        <p className="text-muted-foreground mt-2">
          ユーザーアカウントとグループの管理を行います
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            ユーザー管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>ユーザー一覧</CardTitle>
                  <CardDescription>登録されているユーザーの管理</CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  ユーザー追加
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* フィルター */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="名前、メールアドレスで検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="権限" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての権限</SelectItem>
                    <SelectItem value="admin">管理者</SelectItem>
                    <SelectItem value="manager">マネージャー</SelectItem>
                    <SelectItem value="user">一般ユーザー</SelectItem>
                    <SelectItem value="agent">エージェント</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="ステータス" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのステータス</SelectItem>
                    <SelectItem value="active">アクティブ</SelectItem>
                    <SelectItem value="inactive">非アクティブ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ユーザー一覧 */}
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div key={user.user_id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src="/placeholder-user.jpg" />
                        <AvatarFallback>{(user.display_name || user.email || '?').charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{user.display_name || user.email}</h3>
                          {getRoleBadge(user.role)}
                          {getStatusBadge(!!user.is_active)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                          <div className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {user.department || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(!loading && filteredUsers.length === 0) && (
                  <div className="text-sm text-muted-foreground">ユーザーが見つかりませんでした。</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 