"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Building,
    Edit,
    Mail,
    Plus,
    Search,
    Trash2,
    Users,
    Phone,
    Calendar,
    Activity,
    FolderPlus
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PageHeader } from "@/components/layout/PageHeader"

// モック営業担当者データ
const mockSalesReps = [
  {
    id: '1',
    name: '田中 太郎',
    email: 'tanaka@cross-m.co.jp',
    role: 'sales',
    department: '営業部',
    phone: '03-1234-5678',
    company_name: 'クロス・マーケティンググループ',
    company_domain: 'cross-m.co.jp',
    status: 'active',
    customer_count: 15,
    monthly_alerts: 8,
    response_rate: 95,
    specialties: '製造業, IT業界',
    last_activity: '2025-01-15'
  },
  {
    id: '2',
    name: '佐藤 花子',
    email: 'sato@cross-c.co.jp',
    role: 'sales',
    department: '営業部',
    phone: '03-1234-5679',
    company_name: 'クロス・コミュニケーション',
    company_domain: 'cross-c.co.jp',
    status: 'active',
    customer_count: 12,
    monthly_alerts: 5,
    response_rate: 98,
    specialties: 'サービス業, 小売業',
    last_activity: '2025-01-14'
  },
  {
    id: '3',
    name: '鈴木 一郎',
    email: 'suzuki@propworks.co.jp',
    role: 'sales_manager',
    department: '営業部',
    phone: '03-1234-5680',
    company_name: 'プロップワークス',
    company_domain: 'propworks.co.jp',
    status: 'active',
    customer_count: 20,
    monthly_alerts: 12,
    response_rate: 92,
    specialties: '不動産, 建設業',
    last_activity: '2025-01-15'
  },
  {
    id: '4',
    name: '山田 美咲',
    email: 'yamada@fittio.co.jp',
    role: 'sales',
    department: '営業部',
    phone: '03-1234-5681',
    company_name: 'フィッティオ',
    company_domain: 'fittio.co.jp',
    status: 'active',
    customer_count: 18,
    monthly_alerts: 7,
    response_rate: 89,
    specialties: 'ヘルスケア, フィットネス',
    last_activity: '2025-01-13'
  },
  {
    id: '5',
    name: '高橋 健',
    email: 'takahashi@gra-m.com',
    role: 'support',
    department: 'サポート部',
    phone: '03-1234-5682',
    company_name: 'グラム',
    company_domain: 'gra-m.com',
    status: 'active',
    customer_count: 8,
    monthly_alerts: 3,
    response_rate: 97,
    specialties: 'テクニカルサポート',
    last_activity: '2025-01-14'
  }
];

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
      case "administrator":
        return <Badge variant="destructive">管理者</Badge>
      case "manager":
      case "sales_manager":
        return <Badge variant="secondary">営業マネージャー</Badge>
      case "sales":
      case "sales_rep":
        return <Badge className="bg-blue-100 text-blue-800">営業担当</Badge>
      case "support":
        return <Badge className="bg-green-100 text-green-800">サポート</Badge>
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

  const getDepartmentBadge = (department: string) => {
    switch (department?.toLowerCase()) {
      case "sales":
      case "営業":
      case "営業部":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">営業部</Badge>
      case "support":
      case "サポート":
      case "サポート部":
        return <Badge className="bg-green-50 text-green-700 border-green-200">サポート部</Badge>
      case "marketing":
      case "マーケティング":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200">マーケティング部</Badge>
      case "engineering":
      case "開発":
        return <Badge className="bg-orange-50 text-orange-700 border-orange-200">開発部</Badge>
      default:
        return <Badge variant="outline">{department || '未設定'}</Badge>
    }
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('page', '1')
      params.set('limit', '100') // Get more users for better display
      
      const resp = await fetch(`/api/users?${params.toString()}`)
      const json = await resp.json()
      
      if (json?.success) {
        setData(json.users)
      } else {
        // フォールバック用のモックデータ
        let filteredData = [...mockSalesReps];
        
        // フィルター適用
        if (searchTerm) {
          filteredData = filteredData.filter(user => 
            user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.company_name.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        if (roleFilter !== 'all') {
          filteredData = filteredData.filter(user => user.role === roleFilter);
        }
        
        if (statusFilter !== 'all') {
          filteredData = filteredData.filter(user => 
            statusFilter === 'active' ? user.status === 'active' : user.status !== 'active'
          );
        }
        
        setData(filteredData);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setData([])
    } finally { 
      setLoading(false) 
    }
  }, [searchTerm, roleFilter, statusFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const filteredUsers = useMemo(() => data, [data])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        title="ユーザー管理" 
        description="自社グループドメインのユーザーアカウント管理と営業担当者情報"
      />

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">総ユーザー数</p>
                <p className="text-2xl font-bold">{filteredUsers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">営業担当者</p>
                <p className="text-2xl font-bold">
                  {filteredUsers.filter(user => user.role === 'sales' || user.role === 'sales_manager').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            ユーザー一覧
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>内部ユーザー一覧</CardTitle>
                  <CardDescription>自社グループドメインのユーザー管理（営業担当者情報含む）</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <FolderPlus className="w-4 h-4 mr-2" />
                        グループ作成
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>グループ作成</DialogTitle>
                        <DialogDescription>
                          ユーザーをグループ化して管理します。グループ名と説明を入力し、メンバーを選択してください。
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="group-name">グループ名 *</Label>
                          <Input
                            id="group-name"
                            placeholder="例: 営業部Aチーム"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="group-description">説明</Label>
                          <Textarea
                            id="group-description"
                            placeholder="グループの説明を入力してください"
                            value={groupDescription}
                            onChange={(e) => setGroupDescription(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>メンバー選択</Label>
                          <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                            {filteredUsers.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                ユーザーが見つかりません
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {filteredUsers.map((user) => (
                                  <label
                                    key={user.id || user.email}
                                    className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedUsers.includes(user.id || user.email)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedUsers([...selectedUsers, user.id || user.email])
                                        } else {
                                          setSelectedUsers(selectedUsers.filter(id => id !== (user.id || user.email)))
                                        }
                                      }}
                                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{user.name}</span>
                                        {getRoleBadge(user.role)}
                                        {getStatusBadge(user.status === 'active')}
                                      </div>
                                      <span className="text-xs text-muted-foreground">{user.email}</span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                          {selectedUsers.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              {selectedUsers.length}名のメンバーが選択されています
                            </p>
                          )}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setGroupDialogOpen(false)
                            setGroupName("")
                            setGroupDescription("")
                            setSelectedUsers([])
                          }}
                        >
                          キャンセル
                        </Button>
                        <Button
                          onClick={() => {
                            // TODO: グループ作成APIを呼び出す
                            console.log('グループ作成:', {
                              name: groupName,
                              description: groupDescription,
                              members: selectedUsers
                            })
                            // 成功したらダイアログを閉じる
                            setGroupDialogOpen(false)
                            setGroupName("")
                            setGroupDescription("")
                            setSelectedUsers([])
                            // TODO: 成功メッセージを表示
                            alert(`グループ「${groupName}」を作成しました`)
                          }}
                          disabled={!groupName.trim() || selectedUsers.length === 0}
                        >
                          作成
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    ユーザー追加
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* フィルター */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="名前、メールアドレス、会社名で検索..."
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
                    <SelectItem value="sales_manager">営業マネージャー</SelectItem>
                    <SelectItem value="sales">営業担当</SelectItem>
                    <SelectItem value="support">サポート</SelectItem>
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
              </div>

              {/* ユーザー一覧 */}
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">読み込み中...</div>
                ) : filteredUsers.map((user) => (
                  <div key={user.id} className="border rounded-lg hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src="/placeholder-user.jpg" />
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                              {(user.name || user.email || '?').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{user.name || user.email}</h3>
                              {getRoleBadge(user.role)}
                              {getStatusBadge(user.status === 'active')}
                            </div>
                            
                            {/* 基本情報 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <span className="font-mono text-blue-600">{user.email}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Building className="w-4 h-4 text-gray-400" />
                                <span>{user.company_name || user.company_domain}</span>
                              </div>
                              {user.department && (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">部署:</span>
                                  {getDepartmentBadge(user.department)}
                                </div>
                              )}
                              {user.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-gray-400" />
                                  <span>{user.phone}</span>
                                </div>
                              )}
                            </div>

                            {/* 営業担当者の追加情報 */}
                            {(user.role === 'sales' || user.role === 'sales_rep' || user.role === 'sales_manager') && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Activity className="w-4 h-4 text-blue-600" />
                                  <span className="font-medium text-blue-800">営業担当者情報</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                  <div>
                                    <span className="text-blue-600 font-medium">担当顧客数:</span>
                                    <span className="ml-1">{user.customer_count || 0}社</span>
                                  </div>
                                  <div>
                                    <span className="text-blue-600 font-medium">今月アラート:</span>
                                    <span className="ml-1">{user.monthly_alerts || 0}件</span>
                                  </div>
                                  <div>
                                    <span className="text-blue-600 font-medium">対応率:</span>
                                    <span className="ml-1">{user.response_rate || 0}%</span>
                                  </div>
                                </div>
                                {user.specialties && (
                                  <div className="mt-2">
                                    <span className="text-blue-600 font-medium text-sm">専門分野:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {user.specialties.split(',').map((specialty: string, index: number) => (
                                        <Badge key={index} variant="outline" className="text-xs">
                                          {specialty.trim()}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 最終活動日時 */}
                            {user.last_activity && (
                              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />
                                <span>最終活動: {new Date(user.last_activity).toLocaleDateString('ja-JP')}</span>
                              </div>
                            )}
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
                    </div>
                  </div>
                ))}
                {(!loading && filteredUsers.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    自社ドメインのユーザーが見つかりませんでした。
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 
