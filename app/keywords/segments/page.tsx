"use client"

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
import { AlertTriangle, Clock, Edit2, Send, Settings, Target, XCircle, AlertCircle, Sparkles, Loader2, Shield } from "lucide-react"
import { useState, useEffect } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { toast } from "sonner"

// AIエージェントのメッセージ型定義
interface AIMessage {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
  type: 'text' | 'suggestion' | 'action' | 'analysis'
  analysis?: {
    sentiment: 'positive' | 'negative' | 'neutral' | 'urgent'
    intent: 'inquiry' | 'complaint' | 'request' | 'negotiation' | 'escalation' | 'follow_up'
    urgency: 'low' | 'medium' | 'high' | 'critical'
    confidence: number
    keywords: string[]
    suggestedActions: string[]
  }
}

// LLMレコメンド結果の型定義
interface LLMRecommendation {
  keywords: string[]
  segment: string
  priority: 'high' | 'medium' | 'low'
  reasoning: string
  confidence: number
}

// リクエスト状態の型定義
interface PhraseRequest {
  id: string
  userCase: string
  useCaseExample: string
  segment: string
  phrases: string
  priority: string
  responseDays: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: Date
}

// 検知パターンセグメント定義（フレーズ設定専用）
const segments = [
  {
    id: "urgent_response",
    name: "緊急対応",
    description: "即座に対応が必要な緊急アラート（解約・キャンセル・クレーム等）",
    icon: AlertTriangle,
    color: "bg-red-500 text-white",
    borderColor: "border-red-500",
    scenarios: [
      {
        name: "緊急対応検出",
        phrases: ["解約", "キャンセル", "中止", "クレーム", "不具合", "トラブル", "問題", "故障", "エラー", "対応して"],
        trigger: "解約・キャンセル・クレーム等の緊急事態が発生した場合",
        delay: 0,
        level: "high",
        useCase: "緊急対応",
        isSalesRequest: false
      }
    ]
  },
  {
    id: "churn_risk",
    name: "解約リスク",
    description: "顧客離脱の可能性が高いアラート（競合検討・不満表明等）",
    icon: AlertCircle,
    color: "bg-orange-500 text-white",
    borderColor: "border-orange-500",
    scenarios: [
      {
        name: "解約リスク検出",
        phrases: ["他社", "競合", "比較", "見直し", "変更", "移行", "不満", "期待外れ", "改善要求"],
        trigger: "競合他社への移行や不満表明が示された場合",
        delay: 0,
        level: "high",
        useCase: "解約リスク",
        isSalesRequest: false
      }
    ]
  },
  {
    id: "competitive_threat",
    name: "競合脅威",
    description: "競合他社からの脅威や提案に関するアラート",
    icon: Shield,
    color: "bg-yellow-500 text-white",
    borderColor: "border-yellow-500",
    scenarios: [
      {
        name: "競合脅威検出",
        phrases: ["競合", "他社提案", "比較検討", "優位性", "差別化", "価格競争"],
        trigger: "競合他社からの提案や比較検討が示された場合",
        delay: 1,
        level: "medium",
        useCase: "競合脅威",
        isSalesRequest: false
      }
    ]
  },
  {
    id: "contract_related",
    name: "契約関連",
    description: "契約・更新・条件変更に関するアラート",
    icon: Clock,
    color: "bg-blue-500 text-white",
    borderColor: "border-blue-500",
    scenarios: [
      {
        name: "契約関連検出",
        phrases: ["契約", "更新", "条件", "署名", "合意", "締結", "修正", "見積もり"],
        trigger: "契約や更新に関する重要な話題が出た場合",
        delay: 1,
        level: "medium",
        useCase: "契約関連",
        isSalesRequest: true
      }
    ]
  },
  {
    id: "revenue_opportunity",
    name: "売上機会",
    description: "アップセル・クロスセル等の売上機会に関するアラート",
    icon: Target,
    color: "bg-green-500 text-white",
    borderColor: "border-green-500",
    scenarios: [
      {
        name: "売上機会検出",
        phrases: ["追加", "拡張", "アップグレード", "新機能", "提案", "デモ", "説明"],
        trigger: "追加売上の機会が示された場合",
        delay: 2,
        level: "low",
        useCase: "売上機会",
        isSalesRequest: true
      }
    ]
  }
]

// Mock LLM API function
const generateKeywordRecommendations = async (useCase: string): Promise<LLMRecommendation> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Simple keyword extraction and categorization logic (mock)
  const lowerCase = useCase.toLowerCase();
  
  let keywords: string[] = [];
  let segment = "addreq";
  let priority: 'high' | 'medium' | 'low' = "medium";
  let reasoning = "";
  
  // 緊急対応関連
  if (lowerCase.includes('解約') || lowerCase.includes('キャンセル') || lowerCase.includes('中止') || 
      lowerCase.includes('クレーム') || lowerCase.includes('トラブル') || lowerCase.includes('問題')) {
    keywords = ["解約", "キャンセル", "中止", "クレーム", "不具合", "トラブル", "問題", "故障", "エラー"];
    segment = "urgent_response";
    priority = "high";
    reasoning = "緊急対応が必要なキーワードが検出されました。解約・クレーム・トラブル等の緊急事態のため、最優先で対応が必要です。";
  }
  // 解約リスク関連
  else if (lowerCase.includes('他社') || lowerCase.includes('競合') || lowerCase.includes('不満') || 
           lowerCase.includes('見直し') || lowerCase.includes('変更') || lowerCase.includes('移行')) {
    keywords = ["他社", "競合", "比較", "見直し", "変更", "移行", "不満", "期待外れ", "改善要求"];
    segment = "churn_risk";
    priority = "high";
    reasoning = "顧客離脱のリスクが検出されました。競合検討や不満表明があるため、優先的な対応が必要です。";
  }
  // 競合脅威関連
  else if (lowerCase.includes('競合') || lowerCase.includes('比較検討') || lowerCase.includes('優位性') || 
           lowerCase.includes('差別化') || lowerCase.includes('価格競争')) {
    keywords = ["競合", "他社提案", "比較検討", "優位性", "差別化", "価格競争"];
    segment = "competitive_threat";
    priority = "medium";
    reasoning = "競合他社からの脅威が検出されました。競合分析と対策の検討が必要です。";
  }
  // 契約関連
  else if (lowerCase.includes('契約') || lowerCase.includes('更新') || lowerCase.includes('見積もり') || 
           lowerCase.includes('条件') || lowerCase.includes('署名') || lowerCase.includes('合意')) {
    keywords = ["契約", "更新", "条件", "署名", "合意", "締結", "修正", "見積もり"];
    segment = "contract_related";
    priority = "medium";
    reasoning = "契約や更新に関するキーワードが検出されました。適切なタイミングでのフォローアップが重要です。";
  }
  // 売上機会関連
  else if (lowerCase.includes('追加') || lowerCase.includes('拡張') || lowerCase.includes('アップグレード') || 
           lowerCase.includes('新機能') || lowerCase.includes('提案') || lowerCase.includes('デモ')) {
    keywords = ["追加", "拡張", "アップグレード", "新機能", "提案", "デモ", "説明"];
    segment = "revenue_opportunity";
    priority = "low";
    reasoning = "売上機会に関するキーワードが検出されました。アップセル・クロスセルの機会として活用できます。";
  }
  // デフォルト（売上機会）
  else {
    keywords = ["追加", "拡張", "アップグレード", "新機能", "提案", "デモ", "説明"];
    segment = "revenue_opportunity";
    priority = "low";
    reasoning = "一般的な要望や相談に関する内容と判断されました。売上機会として活用できる可能性があります。";
  }
  
  return {
    keywords,
    segment,
    priority,
    reasoning,
    confidence: 0.85
  };
};

export default function SegmentsPage() {
  const [selectedSegment, setSelectedSegment] = useState<any>(null)
  const [selectedScenario, setSelectedScenario] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [userInput, setUserInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [recommendation, setRecommendation] = useState<LLMRecommendation | null>(null)
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false)
  const setAiMessages = useState<AIMessage[]>([])[1]
  const setSuggestedKeywords = useState<string[]>([])[1]
  const [isKeywordConfirmationOpen, setIsKeywordConfirmationOpen] = useState(false)
  const [pendingScenario, setPendingScenario] = useState<any>(null)
  const [isRequestConfirmationOpen, setIsRequestConfirmationOpen] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<string>("")
  
  // リクエスト関連の状態
  const [requests, setRequests] = useState<PhraseRequest[]>([])
  

  const handleSegmentSelect = (segment: any) => {
    console.log('🔍 セグメント選択:', segment)
    setSelectedSegment(segment)
    setSelectedScenario(null)
  }

  const handleScenarioSelect = (scenario: any) => {
    console.log('🔍 シナリオ選択:', scenario)
    setSelectedScenario(scenario)
    setIsEditing(true)
  }

  const handleSaveScenario = () => {
    // シナリオの保存処理
    setIsEditing(false)
    setSelectedScenario(null)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setSelectedScenario(null)
  }

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "high":
        return <Badge variant="destructive">高</Badge>
      case "medium":
        return <Badge variant="secondary">中</Badge>
      case "low":
        return <Badge variant="outline">低</Badge>
      default:
        return <Badge variant="outline">{level}</Badge>
    }
  }

  // LLMキーワード生成機能
  const handleGenerateKeywords = async () => {
    if (!userInput.trim()) {
      toast.error('ユースケースを入力してください');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateKeywordRecommendations(userInput);
      setRecommendation(result);
      setIsRecommendationOpen(true);
      toast.success('キーワードを生成しました');
    } catch (error) {
      toast.error('キーワード生成に失敗しました');
      console.error('Keyword generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // レコメンド結果の採用
  const handleAcceptRecommendation = () => {
    if (!recommendation) return;

    const targetSegment = segments.find(s => s.id === recommendation.segment);
    if (!targetSegment) return;

    const newScenario = {
      id: Date.now().toString(),
      name: `${userInput.slice(0, 30)}...の検知`,
      phrases: recommendation.keywords,
      trigger: userInput,
      delay: 0,
      level: recommendation.priority,
      useCase: userInput,
      isSalesRequest: true,
      reasoning: recommendation.reasoning
    };

    // 新しいリクエストを作成
    const newRequest: PhraseRequest = {
      id: Date.now().toString(),
      userCase: userInput,
      useCaseExample: newScenario.name,
      segment: targetSegment.name,
      phrases: recommendation.keywords.join(', '),
      priority: recommendation.priority === 'high' ? 'High' : recommendation.priority === 'medium' ? 'Medium' : 'Low',
      responseDays: '即時',
      status: 'approved',
      createdAt: new Date()
    };

    setRequests(prev => [...prev, newRequest]);
    
    // フォームをリセット
    setUserInput('');
    setRecommendation(null);
    setIsRecommendationOpen(false);
    
    toast.success('キーワード設定が完了しました', {
      description: `${targetSegment.name}セグメントに${recommendation.keywords.length}個のキーワードを追加しました`
    });
  };

  const handleSendMessage = () => {
    if (userInput.trim()) {
      setPendingRequest(userInput)
      setIsRequestConfirmationOpen(true)
    }
  }

  const handleConfirmKeywords = async () => {
    if (pendingScenario) {
      // リクエスト受け付けメッセージを即座に表示
      const requestMessage: AIMessage = {
        id: Date.now().toString(),
        content: `📝 テンプレートリクエストを受け付けました

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 リクエスト内容
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 テンプレート名: ${pendingScenario.name}
🔍 検知フレーズ: ${pendingScenario.phrases ? pendingScenario.phrases.join(', ') : ''}
⚡ 優先度: ${pendingScenario.level === 'high' ? '高（緊急対応）' : pendingScenario.level === 'medium' ? '中（通常対応）' : '低（要監視）'}
⏰ 通知タイミング: ${pendingScenario.delay === 0 ? '即時通知' : `検知から${pendingScenario.delay}日後に通知`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ 処理状況: テンプレート作成中...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

しばらくお待ちください。処理が完了すると詳細をお知らせします。`,
        sender: 'ai',
        timestamp: new Date(),
        type: 'text'
      }
      
      setAiMessages(prev => [...prev, requestMessage])
      
      // リクエストリストに追加
      const newRequest: PhraseRequest = {
        id: Date.now().toString(),
        userCase: pendingScenario.trigger,
        useCaseExample: pendingScenario.name,
        segment: selectedSegment?.name || 'その他',
        phrases: pendingScenario.phrases ? pendingScenario.phrases.join(', ') : '',
        priority: pendingScenario.level === 'high' ? 'High' : pendingScenario.level === 'medium' ? 'Medium' : 'Low',
        responseDays: pendingScenario.delay === 0 ? '即時' : `${pendingScenario.delay}日`,
        status: 'pending',
        createdAt: new Date()
      }
      
      setRequests(prev => [...prev, newRequest])
    }
    
    setIsKeywordConfirmationOpen(false)
    setSuggestedKeywords([])
    setPendingScenario(null)
  }

  const handleRejectKeywords = () => {
    setIsKeywordConfirmationOpen(false)
    setSuggestedKeywords([])
    setPendingScenario(null)
  }

  const handleConfirmRequest = () => {
    if (pendingRequest) {
      // リクエストリストに追加
      const newRequest: PhraseRequest = {
        id: Date.now().toString(),
        userCase: pendingRequest,
        useCaseExample: pendingRequest,
        segment: '要確認',
        phrases: '要設定',
        priority: '要確認',
        responseDays: '要確認',
        status: 'pending',
        createdAt: new Date()
      }
      
      setRequests(prev => [...prev, newRequest])
      setUserInput("")
    }
    
    setIsRequestConfirmationOpen(false)
    setPendingRequest("")
  }

  const handleCancelRequest = () => {
    setIsRequestConfirmationOpen(false)
    setPendingRequest("")
  }

  const handleEditRequest = (id: string) => {
    const request = requests.find(req => req.id === id)
    if (request) {
      setPendingRequest(request.userCase)
      setIsRequestConfirmationOpen(true)
      // 既存のリクエストを削除
      setRequests(prev => prev.filter(req => req.id !== id))
    }
  }

  const handleDeleteRequest = (id: string) => {
    setRequests(prev => prev.filter(req => req.id !== id))
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        title="フレーズ設定" 
        description="AIセグメント検知のためのフレーズ管理とテンプレート設定"
      />

      <Tabs defaultValue="ai-assistant" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ai-assistant" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AIキーワード生成
          </TabsTrigger>
          <TabsTrigger value="segments" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            セグメント設定
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-assistant" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                AIキーワード生成
              </CardTitle>
              <CardDescription>
                ユースケースを入力すると、AIが最適なキーワードを自動生成します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 入力例エリア */}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                    💡 入力例
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-100 dark:border-blue-900">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>例1:</strong> 「顧客から『解約』や『キャンセル』という言葉が出たら、すぐにアラートが上がるようにキーワードを設定してください。」
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-100 dark:border-blue-900">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>例2:</strong> 「『競合』や『他社』といった単語を含むメールを自動で検知して、担当営業に通知する設定をお願いします。」
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-100 dark:border-blue-900">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>例3:</strong> 「メール本文に『値引き』や『コスト』といったキーワードが入っていたら、優先度を高く設定したいです。」
                      </p>
                    </div>
                  </div>
                </div>

                {/* 入力エリア */}
                <div className="space-y-3">
                  <Label htmlFor="usecase" className="text-base font-medium">ユースケース入力</Label>
                  <div className="relative">
                    <Textarea
                      id="usecase"
                      placeholder="どのような場面でアラートを受け取りたいか、具体的に入力してください。AIが最適なキーワードを提案します。"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      className="resize-none pr-32"
                      rows={4}
                    />
                    <div className="absolute bottom-2 right-2 flex gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Button 
                            onClick={handleGenerateKeywords} 
                            disabled={!userInput.trim() || isGenerating}
                            size="sm"
                            className="w-full"
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                生成中...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-1" />
                                AI生成
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        AIが自動でキーワードを生成し、適切なセグメントと優先度を提案します
                      </p>
                    </div>
                  </div>
                </div>

                {/* 生成されたリクエスト履歴 */}
                {requests.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-base font-medium">生成履歴</Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {requests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={
                                  request.status === 'approved' ? 'bg-green-100 text-green-800' :
                                  request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }>
                                  {request.status === 'approved' ? '承認済み' :
                                   request.status === 'rejected' ? '却下' : '処理中'}
                                </Badge>
                                <Badge variant="outline">{request.segment}</Badge>
                              </div>
                              <p className="text-sm font-medium">{request.useCaseExample}</p>
                              <p className="text-xs text-gray-600 mt-1">{request.phrases}</p>
                            </div>
                            <div className="text-xs text-gray-500">
                              {request.createdAt.toLocaleDateString('ja-JP')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左カラム: セグメント一覧 */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    セグメント一覧
                  </CardTitle>
                  <CardDescription>監視対象のセグメントを選択してください（営業リクエストで作成されたテンプレートは緑色で表示）</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 overflow-y-auto max-h-[1078px]">
                  {segments.map((segment) => {
                    const Icon = segment.icon;
                    const isActive = selectedSegment?.id === segment.id;
                    
                    return (
                      <div
                        key={segment.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                          isActive 
                            ? `${segment.borderColor} border-2 bg-opacity-50` 
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                        onClick={() => handleSegmentSelect(segment)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${segment.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-sm">{segment.name}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{segment.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                {segment.scenarios.length} テンプレート
                              </Badge>
                              {/* 営業リクエストで作成されたテンプレート数を表示 */}
                              {segment.scenarios.filter((s: any) => s.useCase === "キーワードリクエストで作成されたテンプレート").length > 0 && (
                                <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                                  {segment.scenarios.filter((s: any) => s.useCase === "キーワードリクエストで作成されたテンプレート").length} 営業リクエスト
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* 右カラム: シナリオ詳細 */}
            <div className="lg:col-span-2">
              {selectedSegment ? (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <selectedSegment.icon className="w-5 h-5" />
                          {selectedSegment.name}
                        </CardTitle>
                        <CardDescription>{selectedSegment.description}</CardDescription>
                      </div>
                      <Button variant="outline" size="sm">
                        <Edit2 className="w-4 h-4 mr-2" />
                        セグメント編集
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {selectedSegment.scenarios.map((scenario: any, scenarioIndex: number) => (
                        <div
                          key={scenarioIndex}
                          className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                            selectedScenario?.id === scenario.id 
                              ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                          onClick={() => handleScenarioSelect(scenario)}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-medium">{scenario.name}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{scenario.trigger}</p>
                              {scenario.useCase && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">
                                  例: {scenario.useCase}
                                </p>
                              )}
                              {/* テンプレート作成元の表示 */}
                              <div className="flex items-center gap-2 mt-2">
                                {scenario.isSalesRequest ? (
                                  <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                    営業リクエスト
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                                    初期テンプレート
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getLevelBadge(scenario.level)}
                              <Badge variant="outline">
                                {scenario.delay === 0 ? '即時通知' : 
                                 scenario.delay === 1 ? '検知から1日後に通知' : 
                                 scenario.delay === 2 ? '検知から2日後に通知' : 
                                 `検知から${scenario.delay}日後に通知`}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {scenario.phrases && Array.isArray(scenario.phrases) ? (
                              scenario.phrases.map((phrase: string, phraseIndex: number) => (
                                <Badge key={phraseIndex} variant="secondary" className="text-xs">
                                  {phrase}
                                </Badge>
                              ))
                            ) : scenario.keywords && Array.isArray(scenario.keywords) ? (
                              scenario.keywords.map((keyword: string, keywordIndex: number) => (
                                <Badge key={keywordIndex} variant="secondary" className="text-xs">
                                  {keyword}
                                </Badge>
                              ))
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">セグメントを選択してください</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* AIレコメンド結果ダイアログ */}
      <Dialog open={isRecommendationOpen} onOpenChange={setIsRecommendationOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              AIキーワード生成結果
            </DialogTitle>
            <DialogDescription>
              入力されたユースケースから最適なキーワードを生成しました
            </DialogDescription>
          </DialogHeader>
          {recommendation && (
            <div className="space-y-6">
              {/* 分析結果サマリー */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h4 className="font-medium text-blue-800 dark:text-blue-200">AI分析結果</h4>
                  <Badge variant="outline" className="text-xs">
                    信頼度: {Math.round(recommendation.confidence * 100)}%
                  </Badge>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {recommendation.reasoning}
                </p>
              </div>

              {/* 推奨セグメント */}
              <div>
                <Label className="text-base font-medium">推奨セグメント</Label>
                <div className="mt-2">
                  {(() => {
                    const targetSegment = segments.find(s => s.id === recommendation.segment);
                    return targetSegment ? (
                      <div className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className={`p-2 rounded-lg ${targetSegment.color}`}>
                          <targetSegment.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium">{targetSegment.name}</div>
                          <div className="text-sm text-muted-foreground">{targetSegment.description}</div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* 生成されたキーワード */}
              <div>
                <Label className="text-base font-medium">生成されたキーワード</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {recommendation.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                      {keyword}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  これらのキーワードが含まれるメールを自動検知します
                </p>
              </div>

              {/* 設定詳細 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>優先度</Label>
                  <div className="mt-1">
                    {getLevelBadge(recommendation.priority)}
                  </div>
                </div>
                <div>
                  <Label>通知タイミング</Label>
                  <p className="text-sm font-medium mt-1">即時通知</p>
                </div>
              </div>

              {/* 入力されたユースケース */}
              <div>
                <Label>入力されたユースケース</Label>
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-sm">{userInput}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecommendationOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAcceptRecommendation} className="bg-blue-600 hover:bg-blue-700">
              <Sparkles className="w-4 h-4 mr-2" />
              キーワード設定を適用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* その他の既存ダイアログ... */}
      {/* テンプレート確認ダイアログ */}
      <Dialog open={isKeywordConfirmationOpen} onOpenChange={setIsKeywordConfirmationOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>テンプレートの確認</DialogTitle>
            <DialogDescription>
              生成されたテンプレートをリクエストしますか？
            </DialogDescription>
          </DialogHeader>
          {pendingScenario && pendingScenario.phrases && Array.isArray(pendingScenario.phrases) && (
            <div className="space-y-6">
              <div>
                <Label>テンプレート名</Label>
                <p className="text-sm font-medium">{pendingScenario.name}</p>
              </div>
              
              {pendingScenario.phrases && Array.isArray(pendingScenario.phrases) && pendingScenario.phrases.length > 0 && (
                <div>
                  <Label className="flex items-center gap-2">
                    <span>検知フレーズ</span>
                    <Badge variant="outline" className="text-xs">精密監視</Badge>
                  </Label>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pendingScenario.phrases.map((phrase: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    フレーズが含まれるメッセージを検知します
                  </p>
                </div>
              )}
              
              <div>
                <Label>トリガー条件</Label>
                <p className="text-sm text-muted-foreground">{pendingScenario.trigger}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>優先度</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getLevelBadge(pendingScenario.level)}
                    <span className="text-sm text-muted-foreground">
                      {pendingScenario.level === 'high' ? '高' : pendingScenario.level === 'medium' ? '中' : '低'}
                    </span>
                  </div>
                </div>
                <div>
                  <Label>通知タイミング</Label>
                  <p className="text-sm font-medium mt-1">
                    {pendingScenario.delay === 0 ? '即時通知' : 
                     pendingScenario.delay === 1 ? '検知から1日後に通知' : 
                     pendingScenario.delay === 2 ? '検知から2日後に通知' : 
                     `検知から${pendingScenario.delay}日後に通知`}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleRejectKeywords}>
              キャンセル
            </Button>
            <Button onClick={handleConfirmKeywords}>
              テンプレートリクエスト
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* テンプレート編集ダイアログ */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>テンプレート編集</DialogTitle>
            <DialogDescription>
              テンプレートの設定を変更できます
            </DialogDescription>
          </DialogHeader>
          {selectedScenario && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">テンプレート名</Label>
                <Input
                  id="name"
                  value={selectedScenario.name}
                  onChange={(e) => setSelectedScenario({ ...selectedScenario, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="trigger">トリガー条件</Label>
                <Textarea
                  id="trigger"
                  value={selectedScenario.trigger}
                  onChange={(e) => setSelectedScenario({ ...selectedScenario, trigger: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="delay">通知タイミング</Label>
                  <Select
                    value={selectedScenario.delay.toString()}
                    onValueChange={(value) => setSelectedScenario({ ...selectedScenario, delay: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">即時通知</SelectItem>
                      <SelectItem value="1">検知から1日後に通知</SelectItem>
                      <SelectItem value="2">検知から2日後に通知</SelectItem>
                      <SelectItem value="3">検知から3日後に通知</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="level">重要度</Label>
                  <Select
                    value={selectedScenario.level}
                    onValueChange={(value) => setSelectedScenario({ ...selectedScenario, level: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              キャンセル
            </Button>
            <Button onClick={handleSaveScenario}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* リクエスト確認ダイアログ */}
      <Dialog open={isRequestConfirmationOpen} onOpenChange={setIsRequestConfirmationOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>リクエスト確認</DialogTitle>
            <DialogDescription>
              下記ユースケースをリクエストしますか？
            </DialogDescription>
          </DialogHeader>
          {pendingRequest && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">リクエスト内容</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {pendingRequest}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/20 p-3 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>次のステップ:</strong> リクエストが送信されると、管理者がキーワード設定を行います。
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelRequest}>
              キャンセル
            </Button>
            <Button onClick={handleConfirmRequest}>
              リクエスト送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 