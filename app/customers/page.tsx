"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Upload, Download, Search, Building2, Users } from "lucide-react"

const customersData = [
  {
    id: "CUST-001",
    name: "株式会社サンプル",
    contact: "田中太郎",
    email: "tanaka@sample.co.jp",
    phone: "03-1234-5678",
    status: "active",
    lastContact: "2024-01-15",
    assignedTo: "佐藤一郎",
  },
  {
    id: "CUST-002",
    name: "テスト商事株式会社",
    contact: "山田花子",
    email: "yamada@test.co.jp",
    phone: "03-8765-4321",
    status: "prospect",
    lastContact: "2024-01-14",
    assignedTo: "田中花子",
  },
  {
    id: "CUST-003",
    name: "デモ株式会社",
    contact: "鈴木次郎",
    email: "suzuki@demo.co.jp",
    phone: "03-5555-1111",
    status: "inactive",
    lastContact: "2024-01-10",
    assignedTo: "山田太郎",
  },
]

export default function CustomersPage() {
  const [customers, setCustomers] = useState(customersData)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">アクティブ</Badge>
      case "prospect":
        return <Badge variant="secondary">見込み客</Badge>
      case "inactive":
        return <Badge variant="outline">非アクティブ</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">顧客情報管理</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">顧客情報の登録・管理とCRM連携を行えます</p>
      </div>

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList>
          <TabsTrigger value="list">顧客一覧</TabsTrigger>
          <TabsTrigger value="import">データインポート</TabsTrigger>
          <TabsTrigger value="integration">CRM連携</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>顧客一覧</CardTitle>
                  <CardDescription>登録済みの顧客情報を管理できます</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    エクスポート
                  </Button>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    新規追加
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="顧客名、担当者名、メールアドレスで検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>顧客ID</TableHead>
                      <TableHead>会社名</TableHead>
                      <TableHead>担当者</TableHead>
                      <TableHead>メールアドレス</TableHead>
                      <TableHead>電話番号</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>最終接触日</TableHead>
                      <TableHead>担当営業</TableHead>
                      <TableHead>アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.id}</TableCell>
                        <TableCell>{customer.name}</TableCell>
                        <TableCell>{customer.contact}</TableCell>
                        <TableCell>{customer.email}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>{getStatusBadge(customer.status)}</TableCell>
                        <TableCell>{customer.lastContact}</TableCell>
                        <TableCell>{customer.assignedTo}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            編集
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle>CSVインポート</CardTitle>
              <CardDescription>CSVファイルから顧客情報を一括インポートできます</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">CSVファイルをアップロード</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  ファイルをドラッグ&ドロップするか、クリックして選択してください
                </p>
                <Button>ファイルを選択</Button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">CSVフォーマット</h4>
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                  以下の列を含むCSVファイルをアップロードしてください：
                </p>
                <code className="text-xs bg-white dark:bg-gray-800 p-2 rounded block">
                  会社名,担当者名,メールアドレス,電話番号,ステータス,担当営業
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integration">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="h-5 w-5 mr-2" />
                  Salesforce連携
                </CardTitle>
                <CardDescription>Salesforceから顧客データを同期します</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">接続状況</span>
                    <Badge variant="outline">未接続</Badge>
                  </div>
                  <Button className="w-full">Salesforceに接続</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  HubSpot連携
                </CardTitle>
                <CardDescription>HubSpotから顧客データを同期します</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">接続状況</span>
                    <Badge variant="outline">未接続</Badge>
                  </div>
                  <Button className="w-full">HubSpotに接続</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Customer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>新規顧客追加</DialogTitle>
            <DialogDescription>新しい顧客情報を入力してください</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="company-name" className="text-right">
                会社名
              </Label>
              <Input id="company-name" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="contact-name" className="text-right">
                担当者名
              </Label>
              <Input id="contact-name" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                メール
              </Label>
              <Input id="email" type="email" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                電話番号
              </Label>
              <Input id="phone" className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={() => setIsDialogOpen(false)}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
