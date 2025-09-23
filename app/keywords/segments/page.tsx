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
import { AlertTriangle, Bot, Clock, Edit2, Send, Settings, Target, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

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

// 検知パターンセグメント定義
const segments = [
  {
    id: "complaint-urgent",
    name: "クレーム・苦情系",
    description: "顧客からの強い不満や苦情の検出",
    icon: AlertTriangle,
    color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200",
    borderColor: "border-red-200 dark:border-red-800",
    scenarios: [
      {
        name: "クレーム・苦情検出",
        phrases: ["クレーム", "不具合", "トラブル", "おかしい", "問題", "故障", "エラー", "動かない", "困っている", "対応して"],
        trigger: "顧客からの強い不満や苦情が示された場合",
        delay: 0,
        level: "high",
        useCase: "クレーム・苦情系",
        isSalesRequest: false
      }
    ]
  },
  {
    id: "follow-up-dissatisfaction",
    name: "催促・未対応の不満",
    description: "対応の遅れや催促への不満の検出",
    icon: Clock,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200",
    borderColor: "border-orange-200 dark:border-orange-800",
    scenarios: [
      {
        name: "催促・未対応不満検出",
        phrases: ["まだですか", "いつまで", "対応して", "返事がない", "待っています", "遅い", "早く", "急いで"],
        trigger: "対応の遅れや催促への不満が示された場合",
        delay: 0,
        level: "medium",
        useCase: "催促・未対応の不満",
        isSalesRequest: false
      }
    ]
  },
  {
    id: "anxiety-passive-tendency",
    name: "不安・消極的傾向",
    description: "顧客の不安感や消極的な態度の検出",
    icon: AlertCircle,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    scenarios: [
      {
        name: "不安・消極的傾向検出",
        phrases: ["不安", "心配", "大丈夫でしょうか", "どうしよう", "迷っています", "自信がない", "よくわからない"],
        trigger: "顧客の不安感や消極的な態度が示された場合",
        delay: 1,
        level: "low",
        useCase: "不安・消極的傾向",
        isSalesRequest: false
      }
    ]
  },
  {
    id: "positive-engagement",
    name: "積極的関与",
    description: "顧客の積極的な関与や興味の検出",
    icon: Target,
    color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200",
    borderColor: "border-green-200 dark:border-green-800",
    scenarios: [
      {
        name: "積極的関与検出",
        phrases: ["興味があります", "詳しく教えて", "検討したい", "良いですね", "やってみたい", "進めましょう"],
        trigger: "顧客の積極的な関与や興味が示された場合",
        delay: 0,
        level: "low",
        useCase: "積極的関与",
        isSalesRequest: false
      }
    ]
  },
  {
    id: "tone-change-negative",
    name: "トーン急変（ネガへ）",
    description: "会話のトーンが急激にネガティブに変化",
    icon: AlertTriangle,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200",
    borderColor: "border-purple-200 dark:border-purple-800",
    scenarios: [
      {
        name: "トーン急変検出",
        phrases: ["急に", "突然", "一転", "変わった", "違う", "やっぱり", "思ったのと"],
        trigger: "会話のトーンが急激にネガティブに変化した場合",
        delay: 0,
        level: "high",
        useCase: "トーン急変（ネガへ）",
        isSalesRequest: false
      }
    ]
  },
  {
    id: "cancellation-termination",
    name: "キャンセル・取引終了系",
    description: "取引のキャンセルや終了の意向の検出",
    icon: AlertTriangle,
    color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200",
    borderColor: "border-red-300 dark:border-red-800",
    scenarios: [
      {
        name: "キャンセル・取引終了検出",
        phrases: ["キャンセル", "中止", "終了", "やめます", "取り消し", "破棄", "解約", "契約解除"],
        trigger: "取引のキャンセルや終了の意向が示された場合",
        delay: 0,
        level: "high",
        useCase: "キャンセル・取引終了系",
        isSalesRequest: false
      }
    ]
  },
  {
    id: "upsell-opportunity",
    name: "アップセルチャンス",
    description: "追加サービスやアップグレードの機会",
    icon: Target,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200",
    borderColor: "border-blue-200 dark:border-blue-800",
    scenarios: [
      {
        name: "アップセルチャンス検出",
        phrases: ["もっと", "追加で", "他にも", "拡張", "アップグレード", "機能追加", "サービス追加"],
        trigger: "追加サービスやアップグレードの機会が示された場合",
        delay: 1,
        level: "low",
        useCase: "アップセルチャンス",
        isSalesRequest: false
      }
    ]
  },
  {
    id: "cold-rejection-polite",
    name: "冷たい拒絶・塩対応",
    description: "顧客からの冷たい拒絶や塩対応の検出",
    icon: XCircle,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200",
    borderColor: "border-gray-300 dark:border-gray-700",
    scenarios: [
      {
        name: "冷たい拒絶・塩対応検出",
        phrases: ["結構です", "必要ありません", "興味ない", "検討しません", "やめておきます", "他を探します"],
        trigger: "顧客からの冷たい拒絶や塩対応が示された場合",
        delay: 1,
        level: "medium",
        useCase: "冷たい拒絶・塩対応",
        isSalesRequest: false
      }
    ]
  },
  {
    id: "internal-crisis-report",
    name: "社内向け危機通報",
    description: "社内での危機的な状況の通報",
    icon: AlertCircle,
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200",
    borderColor: "border-indigo-200 dark:border-indigo-800",
    scenarios: [
      {
        name: "社内向け危機通報検出",
        phrases: ["緊急", "危機", "問題発生", "トラブル", "事故", "インシデント", "報告", "連絡"],
        trigger: "社内での危機的な状況の通報があった場合",
        delay: 0,
        level: "high",
        useCase: "社内向け危機通報",
        isSalesRequest: false
      }
    ]
  }
]

export default function SegmentsPage() {
  const [segmentList, setSegmentList] = useState(segments)
  const [selectedSegment, setSelectedSegment] = useState<any>(null)
  const [selectedScenario, setSelectedScenario] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [userInput, setUserInput] = useState("")
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const [isKeywordConfirmationOpen, setIsKeywordConfirmationOpen] = useState(false)
  const [pendingScenario, setPendingScenario] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  const [isRequestConfirmationOpen, setIsRequestConfirmationOpen] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<string>("")
  
  // リクエスト関連の状態
  const [requests, setRequests] = useState<PhraseRequest[]>([])

  useEffect(() => {
    setIsClient(true)
  }, [])

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

  const handleEditScenario = () => {
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

  // リクエストステータス更新
  const updateRequestStatus = (id: string, status: 'approved' | 'rejected') => {
    setRequests(prev => prev.map(req => 
      req.id === id ? { ...req, status } : req
    ))
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

  // キーワード候補の生成
  const generateKeywordSuggestions = (event: string) => {
    const keywordMap: { [key: string]: string[] } = {
      // 契約・商談関連
      "解約": ["解約", "キャンセル", "終了", "見直し", "他社", "変更", "移行", "検討"],
      "競合": ["競合", "他社", "比較", "提案", "優位性", "差別化", "代替", "選択"],
      "価格": ["価格", "値引き", "割引", "コスト", "予算", "料金", "費用", "交渉"],
      "契約": ["契約", "契約書", "条項", "条件", "署名", "合意", "締結", "更新", "契約条件"],
      "移行": ["移行", "他社", "乗り換え", "切り替え", "変更", "検討"],
      
      // 営業プロセス関連
      "見積もり": ["見積もり", "見積書", "お見積り", "価格", "コスト", "予算", "金額", "費用"],
      "提案": ["提案書", "提案", "資料", "プレゼン", "デモ", "説明", "紹介", "検討"],
      "返信": ["返信", "回答", "ご連絡", "お返事", "確認", "返答", "催促"],
      "会議": ["会議", "ミーティング", "面談", "打ち合わせ", "日程", "調整"],
      "予算": ["予算", "削減", "コスト", "費用", "節約", "見直し"],
      "デモ": ["デモ", "デモンストレーション", "プレゼン", "説明", "紹介", "実演", "体験"],
      
      // クレーム関連
      "品質": ["品質", "クレーム", "不満", "問題", "改善", "対応", "解決"],
      "担当者": ["担当者", "変更", "交代", "担当", "責任者", "連絡先"],
      "サービス": ["サービス", "不満", "期待", "改善", "対応", "満足"],
      "システム": ["システム", "機能", "改善", "追加", "変更", "不具合"],
      
      // 導入後効果関連
      "効果": ["効果", "成果", "結果", "改善", "向上", "変化", "実感"],
      "ROI": ["ROI", "投資対効果", "費用対効果", "収益", "利益", "回収"],
      "活用": ["活用", "使用", "運用", "利用", "実践", "導入"],
      "検証": ["検証", "確認", "評価", "測定", "分析", "報告"]
    }

    // 行動パターンの定義
    const actionPatterns: { [key: string]: string[] } = {
      // 契約・商談関連
      "解約": [
        "解約の検討",
        "解約の意思表示",
        "他社への移行検討",
        "契約の見直し",
        "解約手続きの開始"
      ],
      "競合": [
        "競合他社の提案",
        "競合との比較",
        "競合からの圧力",
        "競合情報の確認",
        "競合対策の検討"
      ],
      "価格": [
        "価格交渉",
        "価格の見直し",
        "価格の変更要求",
        "値引きの要求",
        "価格の比較"
      ],
      "契約": [
        "契約条件の変更",
        "契約書の確認",
        "契約の更新",
        "契約条件の交渉",
        "契約の締結"
      ],
      "移行": [
        "他社への移行検討",
        "乗り換えの検討",
        "切り替えの検討",
        "他社比較の実施",
        "移行準備の開始"
      ],
      
      // 営業プロセス関連
      "見積もり": [
        "見積もりが遅延している",
        "見積もりの催促",
        "見積もり書の送付",
        "価格の見積もり",
        "見積もり書の確認"
      ],
      "提案": [
        "提案書の作成",
        "提案の検討",
        "提案内容の確認",
        "提案書の送付",
        "提案の比較"
      ],
      "返信": [
        "返信がない",
        "返信の催促",
        "返信の確認",
        "返信の遅延",
        "返信の対応"
      ],
      "予算": [
        "予算削減の通知",
        "コスト見直しの要求",
        "費用削減の検討",
        "予算の変更",
        "コスト最適化"
      ],
      "デモ": [
        "デモンストレーションの要求",
        "システムの実演",
        "機能の説明",
        "体験版の提供",
        "プレゼンテーション"
      ],
      
      // クレーム関連
      "品質": [
        "品質に関するクレーム",
        "品質改善の要求",
        "品質問題の報告",
        "品質確認の要求",
        "品質向上の提案"
      ],
      "担当者": [
        "担当者の変更要求",
        "担当者の交代",
        "担当者の不満",
        "担当者の確認",
        "担当者の紹介"
      ],
      "サービス": [
        "サービスへの不満",
        "サービス改善の要求",
        "サービス品質の確認",
        "サービス内容の変更",
        "サービス満足度の確認"
      ],
      "システム": [
        "システム改善の要求",
        "機能追加の要求",
        "システム不具合の報告",
        "システム変更の要求",
        "システム活用の支援"
      ],
      
      // 導入後効果関連
      "効果": [
        "導入効果が感じられない",
        "効果の確認要求",
        "効果測定の要求",
        "効果向上の提案",
        "効果報告の要求"
      ],
      "ROI": [
        "ROIの確認要求",
        "投資対効果の検証",
        "費用対効果の確認",
        "収益性の確認",
        "投資回収の確認"
      ],
      "活用": [
        "システムを活用できていない",
        "活用方法の確認",
        "活用支援の要求",
        "活用状況の確認",
        "活用促進の提案"
      ],
      "検証": [
        "導入成果の検証",
        "効果測定の実施",
        "結果の確認",
        "評価の要求",
        "分析結果の確認"
      ]
    }

    // 優先度と対応日数のロジック定義
    const priorityLogic: { [key: string]: { priority: string, delay: number, reason: string } } = {
      // 契約・商談関連（高優先度）
      "解約": { priority: "high", delay: 0, reason: "顧客離脱のリスクが高いため即座の対応が必要" },
      "競合": { priority: "high", delay: 1, reason: "競合他社への移行リスクが高いため" },
      "価格": { priority: "high", delay: 1, reason: "価格交渉は迅速な対応が必要" },
      "契約": { priority: "high", delay: 2, reason: "契約関連は重要なため" },
      "移行": { priority: "high", delay: 0, reason: "他社移行は即座の対応が必要" },
      
      // 営業プロセス関連（中優先度）
      "見積もり": { priority: "medium", delay: 2, reason: "営業プロセスの重要なステップ" },
      "提案": { priority: "medium", delay: 3, reason: "提案書は慎重な対応が必要" },
      "返信": { priority: "medium", delay: 1, reason: "コミュニケーションの継続性が重要" },
      "予算": { priority: "medium", delay: 2, reason: "予算関連は重要なため" },
      "デモ": { priority: "medium", delay: 2, reason: "デモンストレーションは営業プロセスの重要ステップ" },
      "会議": { priority: "low", delay: 3, reason: "会議調整は比較的余裕がある" },
      
      // クレーム関連（高優先度）
      "品質": { priority: "high", delay: 1, reason: "品質問題は迅速な対応が必要" },
      "担当者": { priority: "medium", delay: 2, reason: "担当者変更は慎重な対応が必要" },
      "サービス": { priority: "high", delay: 1, reason: "サービス不満は早期対応が必要" },
      "システム": { priority: "high", delay: 1, reason: "システム問題は緊急対応が必要" },
      
      // 導入後効果関連（中優先度）
      "効果": { priority: "medium", delay: 3, reason: "効果確認は定期的な対応" },
      "ROI": { priority: "medium", delay: 3, reason: "ROI確認は重要なため" },
      "活用": { priority: "medium", delay: 2, reason: "活用支援は継続的な対応" },
      "検証": { priority: "low", delay: 3, reason: "検証は定期的な対応" }
    }

    const suggestions: string[] = []
    const actionSuggestions: string[] = []
    const eventLower = event.toLowerCase()

    // 事象に基づいてキーワード候補を生成
    Object.entries(keywordMap).forEach(([category, keywords]) => {
      if (eventLower.includes(category) || keywords.some(k => eventLower.includes(k))) {
        suggestions.push(...keywords)
      }
    })

    // 行動パターンの候補を生成
    Object.entries(actionPatterns).forEach(([category, patterns]) => {
      if (eventLower.includes(category) || patterns.some(p => eventLower.includes(p.split('が')[0]))) {
        actionSuggestions.push(...patterns)
      }
    })

    // 優先度と対応日数を決定
    let priority = "medium"
    let delay = 2
    let reason = "一般的な対応"
    
    // 最も高い優先度のカテゴリを決定
    for (const [category, logic] of Object.entries(priorityLogic)) {
      if (eventLower.includes(category)) {
        priority = logic.priority
        delay = logic.delay
        reason = logic.reason
        break
      }
    }

    // 一般的なキーワードも追加
    if (suggestions.length === 0) {
      suggestions.push("確認", "対応", "検討", "調整", "報告", "連絡", "通知", "管理")
    }

    // 重複を除去して返す
    return {
      keywords: [...new Set(suggestions)],
      patterns: [...new Set(actionSuggestions)],
      priority,
      delay,
      reason
    }
  }

  // テンプレート生成
  const generateTemplate = async (userMessage: string) => {
    // CSVデータに基づくロジックマッチング
    const csvLogic = matchCSVLogic(userMessage)
    
    // 分析結果を含むメッセージを作成
    let responseContent = `📊 **テンプレート生成完了**\n\n`
    
    if (csvLogic) {
      responseContent += `📋 **セグメント**: ${csvLogic.segment}\n`
      responseContent += `🎯 **検知キーワード**: ${csvLogic.keywords}\n`
      responseContent += `⚡ **優先度**: ${csvLogic.priority}\n`
      responseContent += `⏰ **通知タイミング**: ${csvLogic.delay === 0 ? '即時通知' : csvLogic.delay === 1 ? '検知から1日後に通知' : csvLogic.delay === 2 ? '検知から2日後に通知' : `検知から${csvLogic.delay}日後に通知`}\n\n`
      
      responseContent += `📝 **テンプレート内容**:\n`
      responseContent += `• キーワード: ${csvLogic.keywords.split(',').map((k: string) => `"${k.trim()}"`).join(', ')}\n`
      responseContent += `• 優先度: ${csvLogic.priority === 'High' ? '高' : '中'}\n`
      responseContent += `• 通知タイミング: ${csvLogic.delay === 0 ? '即時通知' : csvLogic.delay === 1 ? '検知から1日後に通知' : csvLogic.delay === 2 ? '検知から2日後に通知' : `検知から${csvLogic.delay}日後に通知`}\n\n`
      
      if (csvLogic.useCase) {
        responseContent += `💡 **ユースケース例**:\n`
        responseContent += `"${csvLogic.useCase}"\n\n`
      }
      
      responseContent += `このテンプレートを追加しますか？`
    
    const aiMessage: AIMessage = {
      id: Date.now().toString(),
      content: responseContent,
      sender: 'ai',
      timestamp: new Date(),
      type: 'analysis',
        analysis: {
          sentiment: 'neutral',
          intent: 'request',
          urgency: csvLogic.priority === 'High' ? 'high' : 'medium',
          confidence: 0.9,
          keywords: csvLogic.keywords.split(',').map((k: string) => k.trim()),
          suggestedActions: [`${csvLogic.segment}セグメントでの監視設定を開始`]
        }
    }
    
    setAiMessages(prev => [...prev, aiMessage])
    
    // キーワード候補がある場合は確認ダイアログを表示
      setSuggestedKeywords(csvLogic.keywords.split(',').map((k: string) => k.trim()))
      setPendingScenario({
        name: `${csvLogic.segment}テンプレート`,
        phrases: csvLogic.keywords.split(',').map((k: string) => k.trim()),
        patterns: [],
        trigger: `${csvLogic.segment}関連のフレーズが検知された場合`,
        delay: csvLogic.delay,
        level: csvLogic.priority === 'High' ? 'high' : 'medium',
        useCase: csvLogic.useCase,
        reason: `CSVデータに基づく標準テンプレート`
      })
      setIsKeywordConfirmationOpen(true)
    } else {
      // マッチしない場合のフォールバック
      responseContent += `申し訳ございませんが、入力内容に基づく標準的なテンプレートが見つかりませんでした。\n\n`
      responseContent += `以下のような形式で入力してください：\n`
      responseContent += `• 顧客から『解約』という言葉が出たらテンプレートを追加してください\n`
      responseContent += `• 『競合』や『他社』といった単語を検知するテンプレートをお願いします\n`
      responseContent += `• 『納期』に関する問い合わせを検知するテンプレートを追加したいです\n`
      responseContent += `• 『クレーム』や『不満』に関する連絡を検知するテンプレートを追加してください\n`
      
      const aiMessage: AIMessage = {
        id: Date.now().toString(),
        content: responseContent,
        sender: 'ai',
        timestamp: new Date(),
        type: 'text'
      }
      
      setAiMessages(prev => [...prev, aiMessage])
    }
  }
  
  // CSVデータに基づくロジックマッチング
  const matchCSVLogic = (userMessage: string) => {
    const csvData = [
      {
        inputCase: "顧客から『解約』や『キャンセル』という言葉が出たら、すぐにアラートが上がるようにキーワードを設定してください。",
        useCase: "解約・キャンセル検討",
        segment: "契約・商談",
        keywords: "解約,キャンセル,終了,見直し,他社,変更,移行",
        priority: "High",
        delay: 0
      },
      {
        inputCase: "『競合』や『他社』といった単語を含むメールを自動で検知して、担当営業に通知する設定をお願いします。",
        useCase: "競合他社比較",
        segment: "契約・商談",
        keywords: "競合,他社,比較,提案,優位性,差別化,検討",
        priority: "High",
        delay: 0
      },
      {
        inputCase: "メール本文に『値引き』や『コスト』といったキーワードが入っていたら、優先度を高く設定したいです。",
        useCase: "価格交渉",
        segment: "契約・商談",
        keywords: "価格,値引き,割引,コスト,予算,料金,厳しい",
        priority: "High",
        delay: 0
      },
      {
        inputCase: "『契約書』や『締結』に関するやり取りは、法務部の確認が必要なので、キーワードとして登録しておいてください。",
        useCase: "契約条件検討",
        segment: "契約・商談",
        keywords: "契約,契約書,条項,条件,署名,合意,締結,修正",
        priority: "High",
        delay: 0
      },
      {
        inputCase: "『見積もり』の依頼が来たら、営業担当者に対応を促すリマインダーが飛ぶようにキーワードを設定してください。",
        useCase: "見積もり依頼対応",
        segment: "営業プロセス",
        keywords: "見積もり,見積書,お見積り,価格,コスト,予算,金額,費用,急ぐ",
        priority: "Medium",
        delay: 1
      },
      {
        inputCase: "『提案書』や『デモ』の依頼を検知して、対応状況を管理できるようにキーワードを設定したい。",
        useCase: "提案書・デモ依頼対応",
        segment: "営業プロセス",
        keywords: "提案書,提案,資料,プレゼン,デモ,説明,紹介,会議",
        priority: "Medium",
        delay: 1
      },
      {
        inputCase: "顧客からの『返信がない』という連絡を検知して、対応漏れを防ぐためのキーワードを設定してください。",
        useCase: "返信対応",
        segment: "営業プロセス",
        keywords: "返信,回答,ご連絡,お返事,確認,返答,連絡がない",
        priority: "Medium",
        delay: 1
      },
      {
        inputCase: "『納期』に関する問い合わせは、すぐに担当者に通知がいくようにキーワードを設定してください。",
        useCase: "納期対応",
        segment: "営業プロセス",
        keywords: "納期,期限,予定,間に合う,遅延,延期",
        priority: "Medium",
        delay: 1
      },
      {
        inputCase: "顧客から『担当変更』の要望があった際に、見逃さないようにキーワードを設定しておきたい。",
        useCase: "担当変更要望",
        segment: "クレーム",
        keywords: "担当変更,交代,別の人,引き継ぎ,合わない,不満",
        priority: "High",
        delay: 0
      },
      {
        inputCase: "『クレーム』や『不満』に関する連絡を検知して、迅速に対応できるようにキーワードを設定してください。",
        useCase: "クレーム・不満対応",
        segment: "クレーム",
        keywords: "クレーム,不満,対応が悪い,期待外れ,改善要求,説明と違う,品質",
        priority: "High",
        delay: 0
      },
      {
        inputCase: "『予算削減』や『凍結』といったキーワードを検知して、営業戦略の見直しに活かしたい。",
        useCase: "予算削減・凍結対応",
        segment: "営業プロセス",
        keywords: "予算削減,コストカット,投資見送り,凍結,経費削減,見送り",
        priority: "Low",
        delay: 2
      },
      {
        inputCase: "『効果が出ない』や『活用できていない』という顧客の声を拾い上げられるように、キーワードを設定してください。",
        useCase: "効果検証",
        segment: "導入後効果",
        keywords: "効果が出ない,費用対効果,ROI,期待外れ,活用できていない,成果,効果",
        priority: "Low",
        delay: 2
      }
    ]
    
    // ユーザーメッセージとCSVデータの類似度を計算
    let bestMatch: any = null
    let bestScore = 0
    
    csvData.forEach((item, index) => {
      const inputKeywords = item.inputCase.toLowerCase().match(/『([^』]+)』/g) || []
      const userKeywords = userMessage.toLowerCase().match(/『([^』]+)』/g) || []
      
      // キーワードの一致度を計算
      let score = 0
      userKeywords.forEach(userKeyword => {
        if (inputKeywords.some(inputKeyword => 
          inputKeyword.includes(userKeyword.replace(/『|』/g, '')) || 
          userKeyword.includes(inputKeyword.replace(/『|』/g, ''))
        )) {
          score += 2
        }
      })
      
      // 一般的なキーワードの一致度も計算
      const commonKeywords = ['解約', 'キャンセル', '競合', '他社', '値引き', 'コスト', '契約書', '締結', '見積もり', '提案書', 'デモ', '返信', '納期', '予算削減', '凍結', '担当変更', 'クレーム', '不満', '効果', '活用', '移行', '検討', '厳しい', '修正', '急ぐ', '会議', '連絡がない', '期限', '予定', '間に合う', '遅延', '延期', '対応が悪い', '期待外れ', '改善要求', '説明と違う', '品質', '見送り']
      commonKeywords.forEach(keyword => {
        if (userMessage.toLowerCase().includes(keyword.toLowerCase()) && 
            item.inputCase.toLowerCase().includes(keyword.toLowerCase())) {
          score += 1
        }
      })
      
      if (score > bestScore) {
        bestScore = score
        bestMatch = item
      }
    })
    
    return bestScore > 0 ? bestMatch : null
  }
  
  // 最適なセグメントを見つける
  const findBestMatchingSegment = (text: string) => {
    const lowerText = text.toLowerCase()
    let bestMatch: any = null
    let bestScore = 0
    
    segments.forEach(segment => {
      let score = 0
      segment.scenarios.forEach(scenario => {
        if (scenario.phrases) {
          scenario.phrases.forEach(phrase => {
            if (lowerText.includes(phrase.toLowerCase())) {
              score += 1
            }
          })
        }
      })
      if (score > bestScore) {
        bestScore = score
        bestMatch = segment
      }
    })
    
    return bestMatch
  }

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
      
      // セグメントに新しいシナリオを追加
      const newScenario = {
        ...pendingScenario,
        id: Date.now().toString(),
        useCase: "キーワードリクエストで作成されたテンプレート",
        isSalesRequest: true
      }
      
      // 実際のセグメントデータに追加
      setSegmentList(prev => prev.map(segment => {
        if (segment.id === selectedSegment?.id) {
          return {
            ...segment,
            scenarios: [...segment.scenarios, newScenario]
          }
        }
        return segment
      }))
      
      // ロジックデータをCSVに追加
      try {
        const logicData = {
          ユーザーからの入力ケース: newScenario.trigger,
          ユースケース例: newScenario.name,
          セグメント: selectedSegment?.name || 'その他',
          検知フレーズ: newScenario.phrases ? newScenario.phrases.join(', ') : '',
          優先度: newScenario.level === 'high' ? 'High' : newScenario.level === 'medium' ? 'Medium' : 'Low',
          対応日数: newScenario.delay
        }
        
        const response = await fetch('/api/logic', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: logicData }),
        })
        
        const result = await response.json()
        
        if (result.success) {
          // 成功メッセージをAIに追加
          const confirmationMessage: AIMessage = {
            id: Date.now().toString(),
            content: `🎉 テンプレートの作成が完了しました！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 作成されたテンプレート詳細
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 テンプレート名: ${newScenario.name}
🔍 検知キーワード: ${newScenario.keywords.join(', ')}
⚡ 優先度: ${newScenario.level === 'high' ? '高（緊急対応）' : newScenario.level === 'medium' ? '中（通常対応）' : '低（要監視）'}
⏰ 通知タイミング: ${newScenario.delay === 0 ? '即時通知' : `検知から${newScenario.delay}日後に通知`}
📂 セグメント: ${selectedSegment?.name || 'その他'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 次のステップ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• 「セグメント設定」タブで詳細を確認できます
• 作成されたテンプレートは営業リクエストとして識別されます
• キーワード監視が自動的に開始されます

テンプレートの設定変更が必要な場合は、セグメント設定画面で編集できます。`,
            sender: 'ai',
            timestamp: new Date(),
            type: 'text'
          }
          
          setAiMessages(prev => [...prev, confirmationMessage])
        } else {
          // エラーメッセージをAIに追加
          const errorMessage: AIMessage = {
            id: Date.now().toString(),
            content: `⚠️ テンプレート作成時に問題が発生しました

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 作成状況
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ テンプレート: 正常に作成されました
❌ ロジックデータ: 更新に失敗しました

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 エラー詳細
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

エラー内容: ${result.error}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 対処方法
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• テンプレートは正常に作成されているため、セグメント設定で確認できます
• ロジックデータの更新は後から手動で行うことができます
• 問題が続く場合は、システム管理者にお問い合わせください`,
            sender: 'ai',
            timestamp: new Date(),
            type: 'text'
          }
          
          setAiMessages(prev => [...prev, errorMessage])
        }
      } catch (error) {
        console.error('ロジックデータ更新エラー:', error)
        // エラーメッセージをAIに追加
        const errorMessage: AIMessage = {
          id: Date.now().toString(),
          content: `⚠️ テンプレート作成時にネットワークエラーが発生しました

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 作成状況
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ テンプレート: 正常に作成されました
❌ ロジックデータ: ネットワークエラーにより更新できませんでした

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 エラー詳細
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

エラー内容: ネットワーク接続エラー
• サーバーとの通信に失敗しました
• インターネット接続を確認してください

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 対処方法
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• テンプレートは正常に作成されているため、セグメント設定で確認できます
• インターネット接続を確認してから再度お試しください
• 問題が続く場合は、システム管理者にお問い合わせください`,
          sender: 'ai',
          timestamp: new Date(),
          type: 'text'
        }
        
        setAiMessages(prev => [...prev, errorMessage])
      }
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
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">フレーズ設定</h1>
        <p className="text-muted-foreground mt-2">
          フレーズリクエストによるテンプレート追加とセグメント管理
        </p>
      </div>

      <Tabs defaultValue="ai-assistant" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ai-assistant" className="flex items-center gap-2">
            フレーズリクエスト
          </TabsTrigger>
          <TabsTrigger value="segments" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
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
        </TabsList>

        <TabsContent value="ai-assistant" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                フレーズリクエスト
              </CardTitle>
              <CardDescription>
                ユースケースを入力してフレーズ設定をリクエストします
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



                {/* 入力エリア（下部） */}
                <div className="space-y-3">
                  <Label htmlFor="usecase" className="text-base font-medium">ユースケース入力</Label>
                  <div className="relative">
                    <Textarea
                      id="usecase"
                      placeholder="ご入力いただいたユースケースから、適切なキーワードを設定させて頂きます。少々お待ちください"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      className="resize-none pr-20"
                      rows={4}
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={!userInput.trim()}
                      size="sm"
                      className="absolute bottom-2 right-2"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      リクエスト
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    入力後、右側のボタンをクリックしてキーワード設定をリクエストしてください
                  </p>
                </div>
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
                  {segments.map((segment) => (
                    <div
                      key={segment.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        selectedSegment?.id === segment.id 
                          ? `${segment.borderColor} border-2 bg-opacity-50` 
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => handleSegmentSelect(segment)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${segment.color}`}>
                          <segment.icon className="w-5 h-5" />
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
                  ))}
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

        <TabsContent value="pending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                リクエスト中
              </CardTitle>
              <CardDescription>
                管理者がキーワード設定を行うリクエストを管理します
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                            onClick={() => handleEditRequest(request.id)}
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            修正
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleDeleteRequest(request.id)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            削除
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>フレーズ:</strong> {request.phrases}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              
              {pendingScenario.patterns && Array.isArray(pendingScenario.patterns) && pendingScenario.patterns.length > 0 && (
                <div>
                  <Label className="flex items-center gap-2">
                    <span>行動パターン</span>
                    <Badge variant="outline" className="text-xs">精密監視</Badge>
                  </Label>
                  <div className="space-y-2 mt-2">
                    {pendingScenario.patterns.map((pattern: string, index: number) => (
                      <div key={index} className="p-2 border rounded text-sm bg-gray-50 dark:bg-gray-900">
                        {pattern}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    特定の行動パターンを含むメッセージを検知します
                  </p>
                </div>
              )}
              
              <div>
                <Label>トリガー条件</Label>
                <p className="text-sm text-muted-foreground">{pendingScenario.trigger}</p>
              </div>
              
              {pendingScenario.useCase && (
                <div>
                  <Label className="flex items-center gap-2">
                    <span>ユースケース例</span>
                    <Badge variant="outline" className="text-xs">実際の使用例</Badge>
                  </Label>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg mt-2">
                    <p className="text-sm text-blue-800 dark:text-blue-200 italic">&quot;{pendingScenario.useCase}&quot;</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    このようなメッセージが検知された場合にテンプレートが適用されます
                  </p>
                </div>
              )}
              
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
              
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>テンプレート作成理由:</strong> {pendingScenario.reason || "一般的な対応"}
                </p>
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
                  <strong>次のステップ:</strong> リクエストが送信されると、「リクエスト中」タブで管理できます。管理者がキーワード設定を行います。
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