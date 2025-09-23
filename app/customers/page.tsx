"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Plus, Upload, Download, Search, ChevronLeft, ChevronRight } from "lucide-react"

export default function CustomersPage() {
  const [rows, setRows] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      params.set('page', String(page))
      params.set('limit', String(limit))
      const resp = await fetch(`/api/customers?${params.toString()}`, { headers: { 'Authorization': `Basic ${btoa('cmgadmin:crossadmin')}` }})
      const json = await resp.json()
      if (json?.success) {
        setRows(json.customers)
        const pg = json.pagination
        setTotal(Number(pg?.total || 0))
        setTotalPages(Number(pg?.totalPages || 1))
      } else {
        setRows([]); setTotal(0); setTotalPages(1)
      }
    } catch {
      setRows([]); setTotal(0); setTotalPages(1)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchCustomers() }, [])
  useEffect(() => { const t = setTimeout(fetchCustomers, 300); return () => clearTimeout(t) }, [searchTerm, page])

  // 重複除去（customer_id -> email -> company_id -> domain の優先順でキー化）
  const unique = useMemo(() => {
    const map = new Map<string, any>()
    for (const r of rows) {
      const k = String(r.customer_id || r.email || r.company_id || r.domain || `${r.company_name || 'row'}`)
      if (!map.has(k)) map.set(k, r)
    }
    return Array.from(map.values())
  }, [rows])

  const filtered = useMemo(() => unique, [unique])

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
                    placeholder="会社名、担当者名、メールアドレスで検索..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
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
                      <TableHead>作成日時</TableHead>
                      <TableHead>アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c, idx) => (
                      <TableRow key={`${c.customer_id || c.email || c.company_id || c.domain}-idx-${idx}`}>
                        <TableCell className="font-medium">{c.customer_id}</TableCell>
                        <TableCell>{c.company_name || c.domain}</TableCell>
                        <TableCell>{c.display_name || '—'}</TableCell>
                        <TableCell>{c.email}</TableCell>
                        <TableCell>{c.created_at || '—'}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">編集</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!loading && filtered.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm text-muted-foreground">顧客が見つかりませんでした。</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">全{total}件</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> 前へ
                  </Button>
                  <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={loading || page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                    次へ <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
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
            </CardContent>
          </Card>
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
              <Label htmlFor="company-name" className="text-right">会社名</Label>
              <Input id="company-name" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="contact-name" className="text-right">担当者名</Label>
              <Input id="contact-name" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">メール</Label>
              <Input id="email" type="email" className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={() => setIsDialogOpen(false)}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
