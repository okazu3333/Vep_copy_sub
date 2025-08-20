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
    UserPlus,
    Users
} from "lucide-react"
import { useState } from "react"

// ダミーデータ
const users = [
  {
    id: 1,
    name: "田中太郎",
    email: "tanaka@example.com",
    role: "admin",
    department: "営業部",
    group: "営業チームA",
    status: "active",
    lastLogin: "2024-12-15 10:30:00",
    avatar: "/placeholder-user.jpg"
  },
  {
    id: 2,
    name: "鈴木花子",
    email: "suzuki@example.com",
    role: "user",
    department: "インサイドセールス",
    group: "インサイドチーム",
    status: "active",
    lastLogin: "2024-12-15 09:15:00",
    avatar: "/placeholder-user.jpg"
  },
  {
    id: 3,
    name: "佐藤次郎",
    email: "sato@example.com",
    role: "manager",
    department: "営業部",
    group: "営業チームB",
    status: "inactive",
    lastLogin: "2024-12-10 16:45:00",
    avatar: "/placeholder-user.jpg"
  },
  {
    id: 4,
    name: "高橋美咲",
    email: "takahashi@example.com",
    role: "user",
    department: "インサイドセールス",
    group: "インサイドチーム",
    status: "active",
    lastLogin: "2024-12-15 11:20:00",
    avatar: "/placeholder-user.jpg"
  },
  {
    id: 5,
    name: "伊藤健一",
    email: "ito@example.com",
    role: "user",
    department: "営業部",
    group: "営業チームA",
    status: "active",
    lastLogin: "2024-12-15 08:30:00",
    avatar: "/placeholder-user.jpg"
  }
]

const groups = [
  {
    id: 1,
    name: "営業チームA",
    description: "大手企業担当営業チーム",
    memberCount: 8,
    department: "営業部",
    status: "active"
  },
  {
    id: 2,
    name: "営業チームB",
    description: "中堅企業担当営業チーム",
    memberCount: 6,
    department: "営業部",
    status: "active"
  },
  {
    id: 3,
    name: "インサイドチーム",
    description: "インサイドセールスチーム",
    memberCount: 12,
    department: "インサイドセールス",
    status: "active"
  },
  {
    id: 4,
    name: "管理チーム",
    description: "管理職チーム",
    memberCount: 4,
    department: "管理部",
    status: "active"
  }
]

const departments = [
  { id: 1, name: "営業部" },
  { id: 2, name: "インサイドセールス" },
  { id: 3, name: "管理部" },
  { id: 4, name: "技術部" }
]

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="destructive">管理者</Badge>
      case "manager":
        return <Badge variant="secondary">マネージャー</Badge>
      case "user":
        return <Badge variant="outline">一般ユーザー</Badge>
      default:
        return <Badge variant="outline">{role}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">アクティブ</Badge>
      case "inactive":
        return <Badge variant="secondary">非アクティブ</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === "" || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    const matchesDepartment = departmentFilter === "all" || user.department === departmentFilter

    return matchesSearch && matchesRole && matchesStatus && matchesDepartment
  })

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
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            グループ管理
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
                  <UserPlus className="w-4 h-4 mr-2" />
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
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="部署" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての部署</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ユーザー一覧 */}
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{user.name}</h3>
                          {getRoleBadge(user.role)}
                          {getStatusBadge(user.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                          <div className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {user.department}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {user.group}
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>グループ一覧</CardTitle>
                  <CardDescription>ユーザーグループの管理</CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  グループ作成
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((group) => (
                  <div key={group.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{group.name}</h3>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{group.description}</p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {group.memberCount}名
                      </div>
                      <div className="flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {group.department}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 