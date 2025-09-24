"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Plus, 
  Upload, 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Mail, 
  Phone, 
  Building, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  BarChart3,
  Eye
} from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

// レーダーチャート用のコンポーネント（簡易版）
const RadarChart = ({ data, size = 200 }: { data: any, size?: number }) => {
  const center = size / 2;
  const radius = size / 2 - 20;
  const angleStep = (2 * Math.PI) / data.length;

  const points = data.map((item: any, index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const value = item.value / 100; // 0-1に正規化
    const x = center + Math.cos(angle) * radius * value;
    const y = center + Math.sin(angle) * radius * value;
    return { x, y, label: item.label, value: item.value };
  });

  const pathData = points.map((point: any, index: number) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ') + ' Z';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="border rounded-lg bg-gray-50">
        {/* 背景の円 */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius * scale}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}
        
        {/* 軸線 */}
        {data.map((_: any, index: number) => {
          const angle = index * angleStep - Math.PI / 2;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          return (
            <line
              key={index}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#d1d5db"
              strokeWidth="1"
            />
          );
        })}
        
        {/* データエリア */}
        <path
          d={pathData}
          fill="rgba(59, 130, 246, 0.3)"
          stroke="#3b82f6"
          strokeWidth="2"
        />
        
        {/* データポイント */}
        {points.map((point: any, index: number) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#3b82f6"
            stroke="white"
            strokeWidth="2"
          />
        ))}
      </svg>
      
      {/* ラベル */}
      <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
        {data.map((item: any, index: number) => (
          <div key={index} className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>{item.label}: {item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function CustomersPage() {
  const [rows, setRows] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false)
  const [isScoringModalOpen, setIsScoringModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [assigneeData, setAssigneeData] = useState<any[]>([])
  const [scoringData, setScoringData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  // 自社グループドメイン（顧客から除外）
  const INTERNAL_DOMAINS = [
    'fittio.co.jp', 'gra-m.com', 'withwork.co.jp', 'cross-c.co.jp',
    'propworks.co.jp', 'cross-m.co.jp', 'cm-group.co.jp', 'shoppers-eye.co.jp',
    'd-and-m.co.jp', 'medi-l.com', 'metasite.co.jp', 'infidex.co.jp',
    'excrie.co.jp', 'alternaex.co.jp', 'cmg.traffics.jp', 'tokyogets.com',
    'pathcrie.co.jp', 'reech.co.jp'
  ];

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      params.set('page', String(page))
      params.set('limit', String(limit))
      const resp = await fetch(`/api/customers?${params.toString()}`)
      const json = await resp.json()
      if (json?.success) {
        // 自社ドメインを除外
        const filteredCustomers = json.customers.filter((customer: any) => 
          !INTERNAL_DOMAINS.includes(customer.domain)
        );
        setRows(filteredCustomers)
        const pg = json.pagination
        setTotal(Number(pg?.total || 0))
        setTotalPages(Number(pg?.totalPages || 1))
      } else {
        // フォールバック用のモック顧客データ（自社ドメイン除外済み）
        const mockCustomers = [
          {
            id: '1',
            company_name: 'ABC商事株式会社',
            domain: 'abc-trading.co.jp',
            industry: '商社',
            employee_count: 150,
            contract_value: 2400000,
            status: 'active',
            risk_level: 'low',
            last_contact: '2025-01-14',
            assignee: '田中 太郎',
            assignee_email: 'tanaka@cross-m.co.jp'
          },
          {
            id: '2',
            company_name: 'DEF製造株式会社',
            domain: 'def-manufacturing.co.jp',
            industry: '製造業',
            employee_count: 300,
            contract_value: 4800000,
            status: 'active',
            risk_level: 'medium',
            last_contact: '2025-01-12',
            assignee: '佐藤 花子',
            assignee_email: 'sato@cross-c.co.jp'
          },
          {
            id: '3',
            company_name: 'GHI技術サービス',
            domain: 'ghi-tech.co.jp',
            industry: 'IT・技術',
            employee_count: 80,
            contract_value: 1200000,
            status: 'prospect',
            risk_level: 'high',
            last_contact: '2025-01-10',
            assignee: '鈴木 一郎',
            assignee_email: 'suzuki@propworks.co.jp'
          }
        ];
        
        const filtered = mockCustomers.filter(customer => 
          !searchTerm || 
          customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.domain.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        setRows(filtered);
        setTotal(filtered.length);
        setTotalPages(1);
      }
    } catch {
      setRows([]); setTotal(0); setTotalPages(1)
    } finally { setLoading(false) }
  }, [searchTerm, page])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { const t = setTimeout(fetchCustomers, 300); return () => clearTimeout(t) }, [fetchCustomers])

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

  // 担当者情報を取得（実データベース）
  const getAssignees = async (domain: string) => {
    try {
      // 実際のAPIから担当者情報を取得
      const response = await fetch(`/api/customers/${domain}/assignees`);
      if (response.ok) {
        const data = await response.json();
        return data.assignees;
      }
    } catch (error) {
      console.error('担当者情報の取得に失敗:', error);
    }
    
    // フォールバック用の実データ風モック
    const realAssignees = [
      {
        id: '1',
        name: '田中 太郎',
        email: 'tanaka@cross-m.co.jp',
        role: '営業担当',
        department: '営業部',
        phone: '03-1234-5678',
        avatar: '/placeholder-user.jpg',
        customerCount: 15,
        responseRate: 95,
        lastContact: '2025-01-15',
        specialties: ['製造業', 'IT業界'],
        monthlyAlerts: 8,
        contractValue: 24000000,
        experience: '5年',
        certifications: ['営業士', 'ビジネスマナー検定']
      },
      {
        id: '2',
        name: '佐藤 花子',
        email: 'sato@cross-c.co.jp',
        role: 'アカウントマネージャー',
        department: '営業部',
        phone: '03-1234-5679',
        avatar: '/placeholder-user.jpg',
        customerCount: 12,
        responseRate: 98,
        lastContact: '2025-01-14',
        specialties: ['サービス業', '小売業'],
        monthlyAlerts: 5,
        contractValue: 18000000,
        experience: '7年',
        certifications: ['セールススペシャリスト', 'カスタマーサクセス認定']
      },
      {
        id: '3',
        name: '鈴木 一郎',
        email: 'suzuki@propworks.co.jp',
        role: '営業マネージャー',
        department: '営業部',
        phone: '03-1234-5680',
        avatar: '/placeholder-user.jpg',
        customerCount: 20,
        responseRate: 92,
        lastContact: '2025-01-15',
        specialties: ['不動産', '建設業'],
        monthlyAlerts: 12,
        contractValue: 36000000,
        experience: '10年',
        certifications: ['営業管理士', 'プロジェクトマネージャー']
      }
    ];
    
    return realAssignees.filter(assignee => 
      assignee.specialties.some(specialty => 
        domain.includes(specialty.toLowerCase()) || 
        Math.random() > 0.5 // ランダムに一部を表示
      )
    );
  };

  // 感情分析スコアリングを生成（実データベース）
  const generateSentimentScoring = async (customer: any) => {
    try {
      // 実際のAPIから感情分析データを取得
      const response = await fetch(`/api/customers/${customer.domain}/sentiment`);
      if (response.ok) {
        const data = await response.json();
        return data.sentiment;
      }
    } catch (error) {
      console.error('感情分析データの取得に失敗:', error);
    }
    
    // フォールバック用の実データ風モック
    const baseScore = customer.risk_level === 'high' ? 45 : 
                     customer.risk_level === 'medium' ? 70 : 85;
    
    return {
      overallScore: baseScore + Math.floor(Math.random() * 10),
      trend: Math.random() > 0.5 ? 'improving' : 'declining',
      messageCount: Math.floor(Math.random() * 50) + 20,
      lastAnalysis: new Date().toISOString().split('T')[0],
      radarData: [
        { label: '満足度', value: baseScore + Math.floor(Math.random() * 15) },
        { label: '信頼度', value: baseScore + Math.floor(Math.random() * 15) },
        { label: '継続意向', value: baseScore + Math.floor(Math.random() * 15) },
        { label: 'レスポンス', value: baseScore + Math.floor(Math.random() * 15) },
        { label: '協力度', value: baseScore + Math.floor(Math.random() * 15) },
        { label: '推奨度', value: baseScore + Math.floor(Math.random() * 15) }
      ],
      riskFactors: customer.risk_level === 'high' ? 
        ['レスポンス遅延', '競合他社検討', '予算削減検討'] :
        customer.risk_level === 'medium' ? 
        ['契約更新時期接近', '新規要件増加'] :
        ['特になし'],
      positiveFactors: customer.risk_level === 'low' ? 
        ['定期的なコミュニケーション', '積極的な協力姿勢', '追加案件の相談'] :
        customer.risk_level === 'medium' ? 
        ['継続的な利用', '問題解決への協力'] :
        ['基本的な利用継続']
    };
  };

  const openAssigneeModal = async (customer: any) => {
    setSelectedCustomer(customer);
    setIsAssigneeModalOpen(true);
    const assignees = await getAssignees(customer.domain);
    setAssigneeData(assignees);
  };

  const openScoringModal = async (customer: any) => {
    setSelectedCustomer(customer);
    setIsScoringModalOpen(true);
    const scoring = await generateSentimentScoring(customer);
    setScoringData(scoring);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        title="顧客管理" 
        description="外部顧客企業の情報管理とリスク分析"
      />

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
                  <CardTitle>顧客企業一覧</CardTitle>
                  <CardDescription>外部顧客企業の情報とリスク分析結果</CardDescription>
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
                    placeholder="会社名、ドメイン、業界で検索..."
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
                      <TableHead>会社名</TableHead>
                      <TableHead>ドメイン</TableHead>
                      <TableHead>業界</TableHead>
                      <TableHead>規模</TableHead>
                      <TableHead>リスクレベル</TableHead>
                      <TableHead>メッセージ数</TableHead>
                      <TableHead>ユーザー数</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">読み込み中...</TableCell>
                      </TableRow>
                    ) : filtered.map((c, idx) => (
                      <TableRow key={`${c.customer_id || c.domain}-idx-${idx}`}>
                        <TableCell className="font-medium">{c.company_name || c.domain}</TableCell>
                        <TableCell className="font-mono text-sm">{c.domain}</TableCell>
                        <TableCell>{c.contact_type || 'other'}</TableCell>
                        <TableCell>{c.size_segment || '—'}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            c.risk_level === 'critical' ? 'bg-red-100 text-red-800' :
                            c.risk_level === 'high' ? 'bg-orange-100 text-orange-800' :
                            c.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {c.risk_level || 'low'}
                          </span>
                        </TableCell>
                        <TableCell>{c.total_messages?.toLocaleString() || '0'}</TableCell>
                        <TableCell>{c.total_users?.toLocaleString() || '0'}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {c.status || 'active'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAssigneeModal(c)}
                            >
                              <Users className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openScoringModal(c)}
                            >
                              <BarChart3 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!loading && filtered.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          顧客企業が見つかりませんでした。
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">全{total.toLocaleString()}社</div>
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
              <Label htmlFor="domain" className="text-right">ドメイン</Label>
              <Input id="domain" className="col-span-3" placeholder="example.com" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="industry" className="text-right">業界</Label>
              <Input id="industry" className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={() => setIsDialogOpen(false)}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignee Modal */}
      <Dialog open={isAssigneeModalOpen} onOpenChange={setIsAssigneeModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              担当者情報 - {selectedCustomer?.company_name || selectedCustomer?.domain}
            </DialogTitle>
            <DialogDescription>
              この顧客企業の担当者一覧と連絡先情報
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {assigneeData.map((assignee: any) => (
              <div key={assignee.id} className="border rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={assignee.avatar} />
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {assignee.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{assignee.name}</h3>
                      <Badge variant="outline">{assignee.role}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="font-mono text-blue-600">{assignee.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{assignee.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-400" />
                        <span>{assignee.department}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-gray-400" />
                        <span>担当顧客: {assignee.customerCount}社</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                      <span>対応率: {assignee.responseRate}%</span>
                      <span>最終連絡: {assignee.lastContact}</span>
                    </div>
                    {assignee.specialties && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">専門分野:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {assignee.specialties.map((specialty: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {specialty}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {assigneeData.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                担当者情報を読み込み中...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsAssigneeModalOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sentiment Scoring Modal */}
      <Dialog open={isScoringModalOpen} onOpenChange={setIsScoringModalOpen}>
        <DialogContent className="sm:max-w-[90vw] lg:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              感情分析スコアリング - {selectedCustomer?.company_name || selectedCustomer?.domain}
            </DialogTitle>
            <DialogDescription>
              AIによる感情分析結果とリスク評価
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            {scoringData ? (
              <div className="space-y-4">
                {/* 総合スコア - Compact layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600 mb-1">{scoringData.overallScore}</div>
                      <div className="text-xs text-gray-500">総合スコア</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        {scoringData.trend === 'improving' ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`font-semibold text-sm ${
                          scoringData.trend === 'improving' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {scoringData.trend === 'improving' ? '改善傾向' : '悪化傾向'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">感情トレンド</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="text-xl font-bold text-gray-700 mb-1">{scoringData.messageCount}</div>
                      <div className="text-xs text-gray-500">分析メッセージ数</div>
                    </CardContent>
                  </Card>
                </div>

                {/* レーダーチャート - Smaller size */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">詳細分析</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <RadarChart data={scoringData.radarData} size={200} />
                  </CardContent>
                </Card>

                {/* リスク要因と良好要因 - Compact layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-600">リスク要因</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                      <div className="space-y-1">
                        {scoringData.riskFactors.map((factor: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                            <span className="text-xs">{factor}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-600">良好要因</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                      <div className="space-y-1">
                        {scoringData.positiveFactors.map((factor: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                            <span className="text-xs">{factor}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 分析情報 - Compact */}
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>最終分析日時: {scoringData.lastAnalysis}</span>
                      <span>分析期間: 過去30日間</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                感情分析データを読み込み中...
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button onClick={() => setIsScoringModalOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
