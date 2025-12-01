"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sparkles, Loader2, Save, Settings, List, Plus } from "lucide-react"
import { SEGMENT_META, type SegmentKey } from "@/lib/segments"
import { getSegmentRules, type SegmentRule } from "@/lib/segment-rules"
import { detectSegment } from "@/lib/segment-detector"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UseCaseAnalysis {
  segment: SegmentKey | null
  confidence: number
  score: number
  reason: string
  suggested_keywords: string[]
  suggested_conditions: {
    metric: string
    operator: string
    value: any
  }[]
}

export default function RulesPage() {
  const [activeTab, setActiveTab] = useState("usecase")
  const [userCaseInput, setUserCaseInput] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<UseCaseAnalysis | null>(null)
  const [savedRules, setSavedRules] = useState<SegmentRule[]>(getSegmentRules())

  // ユースケース分析
  const handleAnalyzeUseCase = async () => {
    if (!userCaseInput.trim()) return

    setIsAnalyzing(true)
    try {
      // 簡易的な分析（実際にはAI APIを呼び出す）
      const result = await analyzeUseCase(userCaseInput)
      setAnalysisResult(result)
    } catch (error) {
      console.error("分析エラー:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ユースケースを分析して検知ルールを提案
  const analyzeUseCase = async (usecase: string): Promise<UseCaseAnalysis> => {
    // APIエンドポイントを呼び出し
    const response = await fetch('/api/rules/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ usecase }),
    })

    if (!response.ok) {
      throw new Error('分析に失敗しました')
    }

    const data = await response.json()
    return data.analysis
  }

  // 検知ルールを保存
  const handleSaveRule = async () => {
    if (!analysisResult || !analysisResult.segment) return

    // 新しいルールを作成
    const newRule: SegmentRule = {
      segment: analysisResult.segment,
      category: SEGMENT_META[analysisResult.segment].category.key,
      priority: savedRules.length + 1, // 暫定的な優先順位
      conditions: analysisResult.suggested_conditions.map(cond => ({
        ...cond,
        weight: 1.0 / analysisResult.suggested_conditions.length,
      })),
      confidence_threshold: 0.6,
      min_confidence: 0.5,
    }

    // TODO: APIエンドポイントに保存
    // await fetch('/api/rules', { method: 'POST', body: JSON.stringify(newRule) })

    setSavedRules([...savedRules, newRule])
    setAnalysisResult(null)
    setUserCaseInput("")
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">検知ルール管理</h1>
        <p className="text-muted-foreground">
          ユースケースを入力して、自動的に検知ルールを生成・管理します
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="usecase" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            ユースケース入力
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            検知ルール一覧
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            設定
          </TabsTrigger>
        </TabsList>

        {/* ユースケース入力タブ */}
        <TabsContent value="usecase" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>ユースケース入力</CardTitle>
              <CardDescription>
                どのような場面でアラートを受け取りたいか、具体的に入力してください。
                AIが最適なセグメントと検知条件を提案します。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 入力エリア */}
              <div className="space-y-2">
                <Label htmlFor="usecase">ユースケース</Label>
                <Textarea
                  id="usecase"
                  placeholder="例: 顧客から『解約』や『キャンセル』という言葉が出たら、すぐにアラートが上がるように設定してください。"
                  value={userCaseInput}
                  onChange={(e) => setUserCaseInput(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleAnalyzeUseCase}
                    disabled={!userCaseInput.trim() || isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        分析中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI分析
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* 分析結果 */}
              {analysisResult && (
                <Card className="border-primary">
                  <CardHeader>
                    <CardTitle className="text-lg">分析結果</CardTitle>
                    <CardDescription>
                      推奨されるセグメントと検知条件
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 推奨セグメント */}
                    {analysisResult.segment && (
                      <div className="space-y-2">
                        <Label>推奨セグメント</Label>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-base px-3 py-1">
                            {SEGMENT_META[analysisResult.segment].label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            信頼度: {(analysisResult.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {SEGMENT_META[analysisResult.segment].description}
                        </p>
                      </div>
                    )}

                    {/* 推奨キーワード */}
                    {analysisResult.suggested_keywords.length > 0 && (
                      <div className="space-y-2">
                        <Label>推奨キーワード</Label>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.suggested_keywords.map((kw, idx) => (
                            <Badge key={idx} variant="secondary">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 推奨検知条件 */}
                    {analysisResult.suggested_conditions.length > 0 && (
                      <div className="space-y-2">
                        <Label>推奨検知条件</Label>
                        <div className="space-y-2">
                          {analysisResult.suggested_conditions.map((cond, idx) => (
                            <div key={idx} className="p-3 bg-muted rounded-md text-sm">
                              <div className="font-medium">{cond.metric}</div>
                              <div className="text-muted-foreground">
                                {cond.operator} {JSON.stringify(cond.value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 理由 */}
                    <div className="space-y-2">
                      <Label>分析理由</Label>
                      <p className="text-sm text-muted-foreground">
                        {analysisResult.reason}
                      </p>
                    </div>

                    {/* 保存ボタン */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAnalysisResult(null)
                          setUserCaseInput("")
                        }}
                      >
                        キャンセル
                      </Button>
                      <Button
                        onClick={handleSaveRule}
                        disabled={!analysisResult.segment}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        検知ルールを保存
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 入力例 */}
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-sm">入力例</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <strong>例1:</strong> 顧客から『解約』や『キャンセル』という言葉が出たら、すぐにアラートが上がるように設定してください。
                  </div>
                  <div>
                    <strong>例2:</strong> 『競合』や『他社』といった単語を含むメールを自動で検知して、担当営業に通知する設定をお願いします。
                  </div>
                  <div>
                    <strong>例3:</strong> 提案書を送った後、顧客から『修正』や『変更』という言葉が出たら、提案差異として検知してください。
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 検知ルール一覧タブ */}
        <TabsContent value="rules" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>検知ルール一覧</CardTitle>
              <CardDescription>
                現在登録されている検知ルールの一覧です
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {savedRules.map((rule, idx) => {
                  const segmentMeta = SEGMENT_META[rule.segment]
                  return (
                    <Card key={idx}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-base">
                              {segmentMeta.label}
                            </Badge>
                            <Badge variant="secondary">
                              優先順位: {rule.priority}
                            </Badge>
                            <Badge variant="outline">
                              {segmentMeta.category.label}
                            </Badge>
                          </div>
                        </div>
                        <CardDescription className="mt-2">
                          {segmentMeta.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium">検知条件</Label>
                            <div className="mt-2 space-y-2">
                              {rule.conditions.map((cond, condIdx) => (
                                <div key={condIdx} className="p-2 bg-muted rounded text-sm">
                                  <span className="font-medium">{cond.metric}</span>
                                  <span className="mx-2 text-muted-foreground">
                                    {cond.operator}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {Array.isArray(cond.value)
                                      ? cond.value.join(", ")
                                      : String(cond.value)}
                                  </span>
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    (重み: {cond.weight})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>
                              信頼度閾値: {(rule.confidence_threshold * 100).toFixed(0)}%
                            </span>
                            <span>
                              最小信頼度: {(rule.min_confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 設定タブ */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>設定</CardTitle>
              <CardDescription>
                検知ルールの設定を管理します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                設定機能は今後実装予定です
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

