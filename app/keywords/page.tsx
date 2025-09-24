"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Edit, Plus, CheckCircle, XCircle, Clock } from "lucide-react"
import { useState } from "react"

// 検知パターンセグメント定義
const segments = [
  {
    id: "complaint-urgent",
    name: "クレーム・苦情系",
    description: "顧客からの強い不満や苦情の検出",
    color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200",
    scenarios: [
      {
        name: "クレーム・苦情検出",
        keywords: ["クレーム", "不具合", "トラブル", "おかしい", "問題", "故障", "エラー", "動かない", "困っている", "対応して"],
        trigger: "顧客からの強い不満や苦情が示された場合",
        delay: 0,
        level: "high"
      }
    ]
  },
  {
    id: "follow-up-dissatisfaction",
    name: "催促・未対応の不満",
    description: "対応の遅れや催促への不満の検出",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200",
    scenarios: [
      {
        name: "催促・未対応不満検出",
        keywords: ["まだですか", "いつまで", "対応して", "返事がない", "待っています", "遅い", "早く", "急いで"],
        trigger: "対応の遅れや催促への不満が示された場合",
        delay: 0,
        level: "medium"
      }
    ]
  }
]

// リクエスト状態の型定義
interface KeywordRequest {
  id: string
  userCase: string
  useCaseExample: string
  segment: string
  keywords: string
  priority: string
  responseDays: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: Date
}

export default function KeywordsPage() {
  const [segmentList, setSegmentList] = useState(segments)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  // const [editingSegment, setEditingSegment] = useState<any>(null)
  const [scenarioForm, setScenarioForm] = useState({
    segmentId: "",
    scenarioIndex: -1,
    name: "",
    keywords: "",
    trigger: "",
    delay: 0,
    level: "medium"
  })
  
  // キーワードリクエスト関連の状態
  const [requests, setRequests] = useState<KeywordRequest[]>([])
  const [userCaseInput, setUserCaseInput] = useState("")
  const [generatedTemplate, setGeneratedTemplate] = useState<any>(null)

  // セグメント編集開始
  const handleEditSegment = (segmentId: string, scenarioIndex: number) => {
    const segment = segmentList.find(s => s.id === segmentId)
    if (!segment) return
    const scenario = segment.scenarios[scenarioIndex]
    setScenarioForm({
      segmentId,
      scenarioIndex,
      name: scenario.name,
      keywords: scenario.keywords.join(", "),
      trigger: scenario.trigger,
      delay: scenario.delay,
      level: scenario.level
    })
    // setEditingSegment(segment)
    setIsDialogOpen(true)
  }

  // シナリオ保存
  const handleSaveScenario = () => {
    setSegmentList(prev => prev.map(segment => {
      if (segment.id !== scenarioForm.segmentId) return segment
      const newScenarios = [...segment.scenarios]
      newScenarios[scenarioForm.scenarioIndex] = {
        ...newScenarios[scenarioForm.scenarioIndex],
        name: scenarioForm.name,
        keywords: scenarioForm.keywords.split(",").map(k => k.trim()),
        trigger: scenarioForm.trigger,
        delay: scenarioForm.delay,
        level: scenarioForm.level
      }
      return { ...segment, scenarios: newScenarios }
    }))
    setIsDialogOpen(false)
  }

  // ユースケースからテンプレート生成
  const generateTemplate = () => {
    if (!userCaseInput.trim()) return

    const keywords = extractKeywords(userCaseInput)
    const segment = determineSegment(userCaseInput)
    const priority = determinePriority(userCaseInput)
    const responseDays = determineResponseDays(userCaseInput)

    const template = {
      userCase: userCaseInput,
      useCaseExample: generateUseCaseExample(userCaseInput),
      segment: segment,
      keywords: keywords.join(", "),
      priority: priority,
      responseDays: responseDays
    }

    setGeneratedTemplate(template)
  }

  // キーワード抽出
  const extractKeywords = (text: string): string[] => {
    const commonKeywords = [
      "解約", "キャンセル", "終了", "見直し", "他社", "変更", "移行",
      "競合", "比較", "提案", "優位性", "差別化", "検討",
      "価格", "値引き", "割引", "コスト", "予算", "料金", "厳しい",
      "契約", "契約書", "条項", "条件", "署名", "合意", "締結", "修正",
      "見積もり", "見積書", "お見積り", "金額", "費用", "急ぐ",
      "資料", "プレゼン", "デモ", "説明", "紹介", "会議",
      "返信", "回答", "ご連絡", "お返事", "確認", "返答", "連絡がない",
      "納期", "期限", "予定", "間に合う", "遅延", "延期",
      "担当変更", "交代", "別の人", "引き継ぎ", "合わない", "不満",
      "クレーム", "対応が悪い", "期待外れ", "改善要求", "説明と違う", "品質",
      "予算削減", "コストカット", "投資見送り", "凍結", "経費削減", "見送り",
      "効果が出ない", "費用対効果", "ROI", "活用できていない", "成果", "効果"
    ]

    return commonKeywords.filter(keyword => text.includes(keyword))
  }

  // セグメント判定
  const determineSegment = (text: string): string => {
    if (text.includes("解約") || text.includes("キャンセル") || text.includes("競合") || text.includes("契約")) {
      return "契約・商談"
    } else if (text.includes("見積もり") || text.includes("提案書") || text.includes("返信") || text.includes("納期")) {
      return "営業プロセス"
    } else if (text.includes("クレーム") || text.includes("不満") || text.includes("担当変更")) {
      return "クレーム"
    } else if (text.includes("効果") || text.includes("ROI") || text.includes("活用")) {
      return "導入後効果"
    }
    return "営業プロセス"
  }

  // 優先度判定
  const determinePriority = (text: string): string => {
    if (text.includes("解約") || text.includes("競合") || text.includes("クレーム") || text.includes("即時")) {
      return "High"
    } else if (text.includes("見積もり") || text.includes("提案書") || text.includes("返信")) {
      return "Medium"
    }
    return "Low"
  }

  // 対応日数判定
  const determineResponseDays = (text: string): string => {
    if (text.includes("即時") || text.includes("すぐ") || text.includes("緊急")) {
      return "即時"
    } else if (text.includes("1日") || text.includes("1日以内")) {
      return "1"
    } else if (text.includes("2日") || text.includes("2日以内")) {
      return "2"
    }
    return "1"
  }

  // ユースケース例生成
  const generateUseCaseExample = (userCase: string): string => {
    if (userCase.includes("解約")) {
      return "サービスの解約を検討しています。他社に移行する予定です。"
    } else if (userCase.includes("競合")) {
      return "他社から新しい提案を受けています。比較検討中です。"
    } else if (userCase.includes("見積もり")) {
      return "先日お願いしたお見積りはいつ頃いただけますか？急いでいます。"
    } else if (userCase.includes("クレーム")) {
      return "先日納品された製品の品質に不満があります。説明と違う点について改善要求します。"
    }
    return "具体的なユースケース例を入力してください。"
  }

  // リクエスト送信
  const submitRequest = () => {
    if (!generatedTemplate) return

    const newRequest: KeywordRequest = {
      id: Date.now().toString(),
      userCase: generatedTemplate.userCase,
      useCaseExample: generatedTemplate.useCaseExample,
      segment: generatedTemplate.segment,
      keywords: generatedTemplate.keywords,
      priority: generatedTemplate.priority,
      responseDays: generatedTemplate.responseDays,
      status: 'pending',
      createdAt: new Date()
    }

    setRequests(prev => [newRequest, ...prev])
    setIsRequestDialogOpen(false)
    setUserCaseInput("")
    setGeneratedTemplate(null)
  }

  // リクエストステータス更新
  const updateRequestStatus = (id: string, status: 'approved' | 'rejected') => {
    setRequests(prev => prev.map(req => 
      req.id === id ? { ...req, status } : req
    ))
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">キーワード管理</h1>
          {requests.filter(req => req.status === 'pending').length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              {requests.filter(req => req.status === 'pending').length}件のリクエスト待ち
            </Badge>
          )}
        </div>
        <Button onClick={() => setIsRequestDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          キーワードリクエスト
        </Button>
      </div>

      <Tabs defaultValue="segments" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="segments" className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings w-4 h-4">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            セグメント設定
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            リクエスト中
            {requests.filter(req => req.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {requests.filter(req => req.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">履歴</TabsTrigger>
        </TabsList>

        <TabsContent value="segments" className="mt-6">
          <Accordion type="single" collapsible>
            {segmentList.map(segment => (
              <AccordionItem key={segment.id} value={segment.id}>
                <AccordionTrigger>
                  <div className={`flex items-center gap-2 ${segment.color} px-2 py-1 rounded`}>{segment.name}</div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="mb-2 text-sm text-muted-foreground">{segment.description}</div>
                  {segment.scenarios.map((scenario, idx) => (
                    <Card key={idx} className="mb-4">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{scenario.name}</CardTitle>
                          <CardDescription className="text-xs">トリガー: {scenario.trigger}</CardDescription>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleEditSegment(segment.id, idx)}><Edit className="w-4 h-4 mr-1" />編集</Button>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {scenario.keywords.map((kw: string) => (
                            <Badge key={kw}>{kw}</Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground">通知遅延: {scenario.delay}日 / レベル: {scenario.level}</div>
                      </CardContent>
                    </Card>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>



        <TabsContent value="pending" className="mt-6">
          <div className="space-y-4">
            {requests.filter(req => req.status === 'pending').map(request => (
              <Card key={request.id} className="border-orange-200">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                        {request.segment}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        <strong>ユースケース:</strong> {request.userCase}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => updateRequestStatus(request.id, 'approved')}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        承認
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => updateRequestStatus(request.id, 'rejected')}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        却下
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>キーワード:</strong> {request.keywords}
                    </div>
                    <div>
                      <strong>優先度:</strong> 
                      <Badge variant={request.priority === 'High' ? 'destructive' : request.priority === 'Medium' ? 'secondary' : 'outline'} className="ml-2">
                        {request.priority}
                      </Badge>
                    </div>
                    <div>
                      <strong>対応日数:</strong> {request.responseDays}
                    </div>
                    <div>
                      <strong>作成日:</strong> {request.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {requests.filter(req => req.status === 'pending').length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                承認待ちのリクエストはありません
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="space-y-4">
            {requests.filter(req => req.status !== 'pending').map(request => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{request.segment}</CardTitle>
                      <CardDescription className="mt-2">
                        <strong>ユースケース:</strong> {request.userCase}
                      </CardDescription>
                    </div>
                    <Badge variant={request.status === 'approved' ? 'default' : 'destructive'}>
                      {request.status === 'approved' ? '承認済み' : '却下'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>キーワード:</strong> {request.keywords}
                    </div>
                    <div>
                      <strong>優先度:</strong> 
                      <Badge variant={request.priority === 'High' ? 'destructive' : request.priority === 'Medium' ? 'secondary' : 'outline'} className="ml-2">
                        {request.priority}
                      </Badge>
                    </div>
                    <div>
                      <strong>対応日数:</strong> {request.responseDays}
                    </div>
                    <div>
                      <strong>作成日:</strong> {request.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {requests.filter(req => req.status !== 'pending').length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                履歴はありません
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* シナリオ編集ダイアログ */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>シナリオ編集</DialogTitle>
            <DialogDescription>キーワードやトリガー、通知遅延などを編集できます。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>シナリオ名</Label>
            <Input value={scenarioForm.name} onChange={e => setScenarioForm(f => ({ ...f, name: e.target.value }))} />
            <Label>キーワード（カンマ区切り）</Label>
            <Input value={scenarioForm.keywords} onChange={e => setScenarioForm(f => ({ ...f, keywords: e.target.value }))} />
            <Label>トリガー</Label>
            <Input value={scenarioForm.trigger} onChange={e => setScenarioForm(f => ({ ...f, trigger: e.target.value }))} />
            <Label>通知遅延（日数）</Label>
            <Input type="number" value={scenarioForm.delay} onChange={e => setScenarioForm(f => ({ ...f, delay: Number(e.target.value) }))} />
            <Label>レベル</Label>
            <Select value={scenarioForm.level} onValueChange={v => setScenarioForm(f => ({ ...f, level: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">高</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="low">低</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveScenario}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* キーワードリクエストダイアログ */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>キーワードリクエスト作成</DialogTitle>
            <DialogDescription>ユースケースを入力して、キーワードテンプレートを自動生成します。</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* ユースケース入力 */}
            <div className="space-y-2">
              <Label>ユースケース入力</Label>
              <Textarea 
                placeholder="例: 顧客から『解約』や『キャンセル』という言葉が出たら、すぐにアラートが上がるようにキーワードを設定してください。"
                value={userCaseInput}
                onChange={(e) => setUserCaseInput(e.target.value)}
                rows={3}
              />
              <Button onClick={generateTemplate} disabled={!userCaseInput.trim()}>
                テンプレート生成
              </Button>
            </div>

            {/* 生成されたテンプレート */}
            {generatedTemplate && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold">生成されたテンプレート</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>ユースケース例</Label>
                    <Input value={generatedTemplate.useCaseExample} onChange={(e) => setGeneratedTemplate({...generatedTemplate, useCaseExample: e.target.value})} />
                  </div>
                  <div>
                    <Label>セグメント</Label>
                    <Select value={generatedTemplate.segment} onValueChange={(v) => setGeneratedTemplate({...generatedTemplate, segment: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="契約・商談">契約・商談</SelectItem>
                        <SelectItem value="営業プロセス">営業プロセス</SelectItem>
                        <SelectItem value="クレーム">クレーム</SelectItem>
                        <SelectItem value="導入後効果">導入後効果</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>キーワード</Label>
                    <Input value={generatedTemplate.keywords} onChange={(e) => setGeneratedTemplate({...generatedTemplate, keywords: e.target.value})} />
                  </div>
                  <div>
                    <Label>優先度</Label>
                    <Select value={generatedTemplate.priority} onValueChange={(v) => setGeneratedTemplate({...generatedTemplate, priority: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>対応日数</Label>
                    <Select value={generatedTemplate.responseDays} onValueChange={(v) => setGeneratedTemplate({...generatedTemplate, responseDays: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="即時">即時</SelectItem>
                        <SelectItem value="1">1日</SelectItem>
                        <SelectItem value="2">2日</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={submitRequest} disabled={!generatedTemplate}>
              リクエスト送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
