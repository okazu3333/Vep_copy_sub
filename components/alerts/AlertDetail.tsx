'use client';

import React from 'react';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/types';
import { X, MessageCircle, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_WEIGHTS } from '@/lib/advanced-scoring';
import { calculateUnifiedScore } from '@/lib/unified-scoring';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { INTERNAL_EMAIL_DOMAINS } from '@/lib/constants/internal-domains';
import { getSegmentMeta } from '@/lib/segments';
import type { AiSuggestedSummary, SimilarCase } from '@/types/ai';
import { RawEvent } from '@/lib/detection/models';
import { buildFollowUpBody } from '@/lib/follow-template';

interface AlertDetailProps {
  alert: Alert;
  onClose: () => void;
  onRefresh?: () => void;
  onFollowCreated?: (newAlertId?: string) => void;
  isWorkerView?: boolean;
}

const USE_DUMMY_DATA = process.env.NEXT_PUBLIC_USE_DUMMY_ALERTS !== '0';

export function AlertDetail({ alert, onClose, onRefresh, onFollowCreated, isWorkerView = false }: AlertDetailProps) {
  const [status, setStatus] = useState(alert.status);
  const [loadingBodyIds, setLoadingBodyIds] = useState<Record<string, boolean>>({});
  const [bodyCache, setBodyCache] = useState<Record<string, string>>({});
  const [currentWeights] = useState(DEFAULT_WEIGHTS);
  const [activeTab, setActiveTab] = useState('insights');
  const [aiSummary, setAiSummary] = useState<AiSuggestedSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [openMessageId, setOpenMessageId] = useState<string | null>(null);
  const [followStatus, setFollowStatus] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setAiLoading(true);
      setAiError(null);
      try {
        const segment = alert.primarySegment ?? undefined;
        if (USE_DUMMY_DATA) {
          const mod = await import('@/data/mock/aiRecommendations');
          if (cancelled) return;
          setAiSummary(mod.getMockAiSummary(segment));
          return;
        }

        const summaryRes = await fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segment, thread_id: alert.threadId }),
        });

        if (cancelled) return;

        if (!summaryRes.ok) {
          throw new Error('AI要約の取得に失敗しました');
        }
        const summaryJson = await summaryRes.json();
        setAiSummary(summaryJson.summary ?? null);
      } catch (error) {
        console.error(error);
        setAiError(error instanceof Error ? error.message : 'AI解析の取得に失敗しました');
      } finally {
        if (!cancelled) {
          setAiLoading(false);
        }
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [alert.id, alert.primarySegment, alert.threadId]);

  const allEmails = Array.isArray(alert.emails) ? alert.emails : [];
  const sortedEmails = [...allEmails].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const extractDomain = (s: string): string | null => {
    if (!s) return null;
    const m = s.toLowerCase().match(/@([^>\s]+)>?$/);
    return m ? m[1] : null;
  };

  const isInternal = (addr: string): boolean => {
    const domain = extractDomain(addr);
    return !!domain && INTERNAL_EMAIL_DOMAINS.includes(domain);
  };

  const getInternalAssignee = () => {
    const internalSenders = sortedEmails
      .filter((email) => isInternal(email.sender || ''))
      .map((email) => email.sender || '')
      .filter(Boolean);
    if (!internalSenders.length) {
      return alert.assignee || '未割当';
    }
    const senderCounts: Record<string, number> = {};
    internalSenders.forEach((sender) => {
      senderCounts[sender] = (senderCounts[sender] || 0) + 1;
    });
    const frequent = Object.entries(senderCounts).sort((a, b) => b[1] - a[1])[0];
    return frequent?.[0] || alert.assignee || '未割当';
  };

  const internalAssignee = getInternalAssignee();

  const getSeverityColor = (severity: 'A' | 'B' | 'C') => {
    switch (severity) {
      case 'A':
        return 'bg-red-500 text-white';
      case 'B':
        return 'bg-orange-500 text-white';
      case 'C':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('ja-JP');
  };

  const handleStatusUpdate = () => {
    const prev = alert.status;
    alert.status = status as Alert['status'];
    toast.success('対応ステータスを更新しました', {
      action: {
        label: '元に戻す',
        onClick: () => {
          alert.status = prev;
          setStatus(prev);
          toast('変更を取り消しました');
        },
      },
    });
  };

  const handleEscalation = () => {
    toast('経営陣への緊急報告を送信しました', {
      description: '15分以内に対応方針を決定してください。',
    });
  };

  const fetchSentimentScoreForText = async (text: string): Promise<number> => {
    if (!text.trim()) return 0;
    try {
      const resp = await fetch('/api/huggingface-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return deriveSentimentScoreFromResult(data?.sentiment);
    } catch (error) {
      console.error('follow sentiment failed', error);
      return 0.3;
    }
  };

  const deriveSentimentScoreFromResult = (result: any): number => {
    if (!result) return 0;
    const label = (result.label ?? result.dominantEmotion ?? '').toString().toLowerCase();
    if (label.includes('positive')) return 0.5;
    if (label.includes('negative')) return -0.6;
    if (label.includes('urgent')) return -0.4;
    if (label.includes('neutral')) return 0;
    if (Array.isArray(result.scores)) {
      const findScore = (keyword: string) =>
        result.scores?.find((entry: any) => entry?.label?.toString().toLowerCase().includes(keyword))
          ?.score ?? 0;
      const positive = findScore('positive');
      const negative = findScore('negative');
      const urgent = findScore('urgent');
      const score = positive - negative - urgent * 0.5;
      return Math.max(-1, Math.min(1, score));
    }
    if (typeof result.score === 'number') return result.score;
    if (typeof result.generatedScore === 'number') return result.generatedScore;
    return 0;
  };

  const handleFollowResponse = async () => {
    if (followLoading) return;
    setFollowStatus(null);
    setFollowLoading(true);
    const followBody = buildFollowUpBody(alert);
    const sentimentScore = await fetchSentimentScoreForText(followBody);

    const followEvent: RawEvent = {
      id: `follow-${alert.id}-${Date.now()}`,
      subject: alert.subject ? `Re: ${alert.subject}` : 'フォローアップのご連絡',
      body: followBody,
      summary: 'フォローアップ報告',
      customer: alert.customer || '営業顧客',
      channel: 'email',
      direction: 'outbound',
      assignee: alert.assignee || 'success@cross-m.co.jp',
      sentimentScore,
      occurredAt: new Date().toISOString(),
      hoursSinceLastReply: 1,
      keywords: ['フォロー', '改善', '共有'],
      urgencyHints: ['フォロー'],
      language: 'ja',
      threadId: alert.threadId || `thread-${alert.id}`,
      priorAlerts: [alert.id],
    };

    try {
      const resp = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followEvent),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const newAlertId =
        Array.isArray(data.alerts) && data.alerts.length ? data.alerts[0]?.id ?? null : null;
      setFollowStatus(`フォローメールを送信しました（アラート生成: ${data.created}件）`);
      toast.success('フォローアップを記録しました');
      onRefresh?.();
      onFollowCreated?.(newAlertId ?? undefined);
    } catch (error) {
      console.error(error);
      setFollowStatus(
        `送信に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
      toast.error('フォロー送信に失敗しました');
    } finally {
      setFollowLoading(false);
    }
  };

  const loadEmailBody = async (messageKey: string, messageId?: string | null) => {
    if (!messageId || bodyCache[messageKey] || loadingBodyIds[messageKey]) return;
    setLoadingBodyIds((prev) => ({ ...prev, [messageKey]: true }));
    try {
      const email = sortedEmails.find((item) => item.id === messageId);
      const fallback =
        email?.body ||
        email?.ai_summary ||
        `件名: ${email?.subject || '不明'}\n※ 本文の詳細は取得できませんでした。`;
      setBodyCache((prev) => ({ ...prev, [messageKey]: fallback }));
    } finally {
      setLoadingBodyIds((prev) => ({ ...prev, [messageKey]: false }));
    }
  };

  const detectionScore =
    typeof alert.detection_score === 'number' ? Math.round(alert.detection_score) : undefined;
  const urgencyScore =
    typeof alert.urgencyScore === 'number' ? Math.round(alert.urgencyScore) : undefined;
  const phrasesKeywords = Array.isArray(alert.phrases)
    ? alert.phrases
    : typeof alert.phrases === 'string'
    ? alert.phrases.split(',').map((s) => s.trim())
    : [];
  const highlightKeywords = Array.isArray(alert.highlightKeywords)
    ? alert.highlightKeywords
    : alert.highlightKeywords
    ? [alert.highlightKeywords]
    : [];
  const allKeywords = [...new Set([...highlightKeywords, ...phrasesKeywords])];

  const segmentMeta = getSegmentMeta(alert.primarySegment ?? undefined);
  const unifiedScore = calculateUnifiedScore(alert, currentWeights);
  const finalScore = unifiedScore.score;
  const computedScore = detectionScore ?? Math.round(finalScore);
  const detectionReasons = alert.detectionReasons || [];
  const directionDetails =
    detectionReasons.length > 0 ? detectionReasons : unifiedScore.explanation.slice(0, 2);
  const directionSummary = segmentMeta?.actionLabel ?? '対応方針が未設定です。';

  const resolution = alert.resolutionPrediction;
  const quality = alert.quality;
  const qualitySignals = quality?.signals || [];
  const phaseCData = (alert as any).phaseC;
  const phaseDData = (alert as any).phaseD;
  const detectionRuleData = (alert as any).detectionRule;

  const metricHighlights: string[] = [];
  metricHighlights.push(`統合スコア ${finalScore}`);
  if (typeof urgencyScore === 'number') {
    metricHighlights.push(`緊急度 ${urgencyScore}`);
  }
  if (phaseCData?.p_resolved_24h) {
    metricHighlights.push(`24h鎮火確率 ${(phaseCData.p_resolved_24h * 100).toFixed(0)}%`);
  } else if (resolution?.probability !== undefined) {
    metricHighlights.push(`鎮火確率 ${Math.round(resolution.probability * 100)}%`);
  }
  if (phaseCData?.ttr_pred_min) {
    metricHighlights.push(`予測TTR 約 ${Math.round(phaseCData.ttr_pred_min / 60)}h`);
  } else if (typeof resolution?.ttrHours === 'number') {
    metricHighlights.push(`予測TTR 約 ${Math.round(resolution.ttrHours)}h`);
  }
  if (detectionRuleData?.hours_since_last_activity) {
    const hours = detectionRuleData.hours_since_last_activity;
    metricHighlights.push(`未応答 ${Math.floor(hours / 24)}日 ${Math.round(hours % 24)}時間`);
  }

  const qualitySummary = (() => {
    if (phaseDData) {
      return {
        title: `返信品質 ${phaseDData.quality_level}`,
        detail:
          typeof phaseDData.quality_score === 'number'
            ? `${phaseDData.quality_score.toFixed(0)}点`
            : 'スコア未計測',
        signals: qualitySignals,
      };
    }
    if (quality) {
      return {
        title: `返信品質 ${quality.level}`,
        detail: `${Math.round(quality.score)}点`,
        signals: qualitySignals,
      };
    }
    return {
      title: '品質データ未取得',
      detail: '分析モデルからの品質スコアがまだ連携されていません。',
      signals: [] as string[],
    };
  })();

  const latestEmail = sortedEmails[0];
  const hasDetection = finalScore > 0;
  const displaySeverity = hasDetection ? alert.severity : 'C';
  const primaryReason =
    directionDetails.length > 0
      ? directionDetails[0]
      : segmentMeta?.detectionLabel ?? '検知理由の詳細はありません。';
  const toggleHistory = () => {
    setActiveTab((prev) => (prev === 'history' ? 'insights' : 'history'));
  };

  const handleToggleMessage = (messageKey: string, messageId?: string | null) => {
    if (openMessageId === messageKey) {
      setOpenMessageId(null);
      return;
    }
    setOpenMessageId(messageKey);
    loadEmailBody(messageKey, messageId);
  };

  return (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 md:p-4 z-50">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
      <div className="bg-slate-800 text-white px-4 py-4 flex-shrink-0 border-b border-slate-700">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-200">
              <Badge className={cn('text-[10px] px-2 py-0.5', getSeverityColor(displaySeverity))}>
                緊急度 {displaySeverity}
              </Badge>
              {segmentMeta && (
                <Badge className={cn('text-[10px] px-2 py-0.5 border', segmentMeta.badgeClass)}>
                  {segmentMeta.category.label} / {segmentMeta.label}
                </Badge>
              )}
            </div>
            <h2 className="text-xl font-semibold">{alert.subject || 'アラート詳細'}</h2>
            <p className="text-sm text-slate-200">
              {alert.customer || '顧客未設定'} ・ 担当 {internalAssignee} ・ 更新 {formatDateTime(alert.updated_at)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-slate-700 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {alert.primarySegment !== 'follow' && (
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3 space-y-2">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-blue-800">
                  このアラートに対してフォローアップメールを送信し、感情/セグメント遷移を確認できます。
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleFollowResponse}
                  disabled={followLoading}
                >
                  {followLoading ? '送信中…' : 'フォローアップを送信'}
                </Button>
              </div>
              {followStatus && <p className="text-xs text-blue-700">{followStatus}</p>}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card className="border-slate-200">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>検知概要</span>
                  <Badge className={cn('text-[10px] px-1.5 py-0.5', unifiedScore.color)}>{unifiedScore.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-sm space-y-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">検知理由</div>
                  <p className="text-slate-800 leading-relaxed">{primaryReason}</p>
                </div>
                {detectionRuleData && (
                  <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded p-2">
                    <div className="font-semibold mb-1">検知ルール</div>
                    <div className="space-y-0.5">
                      <div>
                        {detectionRuleData.rule_type === 'inactivity_72h' && '72時間放置検知'}
                        {detectionRuleData.rule_type === 'sentiment_urgency' && '感情ダウン + 催促'}
                        {detectionRuleData.rule_type === 'tone_frequency_drop' && 'トーン×頻度低下'}
                        {detectionRuleData.rule_type === 'night_reply_rate' && '夜間返信異常'}
                        {detectionRuleData.rule_type === 'recovery_monitoring' && '沈静化監視'}
                        {detectionRuleData.rule_type === 'topic_repetition_tone_drop' && 'トピック繰り返し'}
                        {!['inactivity_72h','sentiment_urgency','tone_frequency_drop','night_reply_rate','recovery_monitoring','topic_repetition_tone_drop'].includes(detectionRuleData.rule_type) && 'カスタムルール'}
                      </div>
                      {typeof detectionRuleData.score === 'number' && (
                        <div>スコア {detectionRuleData.score.toFixed(0)}点</div>
                      )}
                      {typeof detectionRuleData.hours_since_last_activity === 'number' && (
                        <div>
                          未対応 {Math.floor(detectionRuleData.hours_since_last_activity / 24)}日{' '}
                          {Math.round(detectionRuleData.hours_since_last_activity % 24)}時間
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-slate-500 mb-1">主要キーワード</div>
                  <div className="flex flex-wrap gap-2">
                    {allKeywords.length > 0 ? (
                      allKeywords.map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="text-[11px]">
                          {keyword}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">キーワードの抽出はありません</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">担当・アクション</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500 mb-1">担当者</div>
                  <div className="font-semibold text-slate-900">{internalAssignee}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Alert['status'])}
                    className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="unhandled">未対応</option>
                    <option value="in_progress">対応中</option>
                    <option value="completed">完了</option>
                  </select>
                  <Button size="sm" onClick={handleStatusUpdate} className="min-w-[72px]">
                    更新
                  </Button>
                </div>
                {segmentMeta?.actionLabel && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-900">
                    <div className="font-semibold text-blue-800 text-sm mb-1">推奨アクション</div>
                    <p className="leading-relaxed">{segmentMeta.actionLabel}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleEscalation} className="flex-1">
                    緊急共有
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card className="border-slate-200">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">最新の顧客シグナル</CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-sm space-y-3">
                {latestEmail ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {latestEmail.sender} → {latestEmail.recipient}
                      </span>
                      <span>{formatDateTime(latestEmail.timestamp)}</span>
                    </div>
                    <div className="font-semibold text-slate-900">{latestEmail.subject}</div>
                    <p className="text-slate-700 leading-relaxed">
                      {latestEmail.ai_summary || latestEmail.body?.slice(0, 180) || '詳細本文は表示できません。'}
                    </p>
                      <Button variant="link" size="sm" onClick={toggleHistory} className="px-0">
                        {activeTab === 'history' ? '履歴を閉じる' : '履歴を開く'}
                      </Button>
                  </>
                ) : (
                  <p className="text-slate-500">直近のメッセージ情報はまだありません。</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">主要指標</CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-sm space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-[11px]">
                    検知スコア {computedScore}点
                  </Badge>
                  {typeof urgencyScore === 'number' && (
                    <Badge variant="secondary" className="text-[11px]">
                      緊急度 {urgencyScore}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[11px]">
                    統合スコア {finalScore}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {metricHighlights.length ? (
                    metricHighlights.map((metric, idx) => (
                      <div key={`metric-${idx}`} className="text-slate-700 flex items-start gap-2 text-xs">
                        <span className="mt-0.5 text-slate-400">・</span>
                        <span>{metric}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">追加の指標はまだありません。</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3 h-9">
              <TabsTrigger value="insights" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">詳細インサイト</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">スレッド履歴</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="insights" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">AIインサイト</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-sm">
                  {aiLoading ? (
                    <p className="text-slate-500">AIが分析しています...</p>
                  ) : aiError ? (
                    <p className="text-red-600 text-sm">{aiError}</p>
                  ) : (
                    <>
                      {aiSummary ? (
                        <div className="space-y-2">
                          <div className="font-semibold">{aiSummary.headline}</div>
                          <ul className="list-disc list-inside text-slate-700 space-y-1">
                            {aiSummary.keyFindings.map((finding, idx) => (
                              <li key={`finding-${idx}`}>{finding}</li>
                            ))}
                          </ul>
                          <div className="text-xs text-slate-500">
                            リスク: {aiSummary.riskLevel} / 信頼度 {Math.round(aiSummary.confidence * 100)}%
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500">AI要約はまだ生成されていません。</p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">詳細メトリクス</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-sm">
                  <div className="text-xs text-slate-500">{directionSummary}</div>
                  {qualitySummary && (
                    <div className="p-3 bg-slate-50 border rounded text-xs text-slate-700">
                      <div className="font-semibold text-slate-900 text-sm mb-1">{qualitySummary.title}</div>
                      <div>{qualitySummary.detail}</div>
                      {qualitySummary.signals.length > 0 && (
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          {qualitySummary.signals.map((signal, idx) => (
                            <li key={`signal-${idx}`}>{signal}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-3 mt-3">
              <div className="text-right">
                <Button variant="outline" size="sm" onClick={() => setActiveTab('insights')}>
                  サマリーに戻る
                </Button>
              </div>
              <Card>
                <CardHeader className="py-2.5 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    コミュニケーション履歴
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                      {sortedEmails.length}件
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  {sortedEmails.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      コミュニケーション履歴が見つかりませんでした
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sortedEmails.map((email, index) => {
                        const messageKey = `message-${index}`;
                        const isLoading = loadingBodyIds[messageKey];
                        const cachedBody = bodyCache[messageKey];
                        const isInternalEmail = isInternal(email.sender || '');
                        const isOpen = openMessageId === messageKey;

                        return (
                          <div
                            key={messageKey}
                            className={cn(
                              'border rounded-lg overflow-hidden transition-all',
                              isInternalEmail
                                ? 'border-l-4 border-l-green-500 bg-green-50/50'
                                : 'border-l-4 border-l-blue-500 bg-blue-50/50'
                            )}
                          >
                            <div className="px-3 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <Badge variant="outline" className="text-[11px]">
                                      {isInternalEmail ? '社内' : '顧客'}
                                    </Badge>
                                    <span className="font-semibold text-slate-900 truncate">{email.sender}</span>
                                    <ArrowRight className="h-3 w-3 text-slate-400" />
                                    <span className="text-slate-700 truncate">{email.recipient}</span>
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {formatDateTime(email.timestamp)} ／ 件名: {email.subject || '（件名なし）'}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  onClick={() => handleToggleMessage(messageKey, email.id)}
                                >
                                  {isOpen ? '閉じる' : '本文を表示'}
                                </Button>
                              </div>
                            </div>
                            {isOpen && (
                              <div className="border-t bg-white px-3 py-2 text-sm whitespace-pre-line">
                                {isLoading && (
                                  <div className="text-xs text-slate-400">読み込み中...</div>
                                )}
                                {!isLoading && cachedBody && <div>{cachedBody}</div>}
                                {!isLoading && !cachedBody && (
                                  <div className="text-slate-500">
                                    {email.ai_summary || email.body || '本文を取得できませんでした'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  </div>
);
}
