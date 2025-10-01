'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/types';
import { X, MessageCircle, TrendingUp, MoreHorizontal, Send, Hash, User, Building2, Mail, ArrowRight, ArrowLeft, Reply, Clock } from 'lucide-react';
import { HighlightText } from '@/components/ui/HighlightText';
import { DetectionReasons } from '@/components/ui/DetectionReasons';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { INTERNAL_EMAIL_DOMAINS } from '@/lib/constants/internal-domains';

interface AlertDetailProps {
  alert: Alert;
  onClose: () => void;
  isWorkerView?: boolean;
}

export function AlertDetail({ alert, onClose, isWorkerView = false }: AlertDetailProps) {
  const [status, setStatus] = useState(alert.status);
  const [loadingBodyIds, setLoadingBodyIds] = useState<Record<string, boolean>>({});
  const [bodyCache, setBodyCache] = useState<Record<string, string>>({});

  // 社内ドメイン判定（暫定リスト）
  const INTERNAL_DOMAINS = INTERNAL_EMAIL_DOMAINS;
  
  const extractDomain = (s: string): string | null => {
    if (!s) return null;
    const m = s.toLowerCase().match(/@([^>\s]+)>?$/);
    return m ? m[1] : null;
  };
  
  const isInternal = (addr: string): boolean => {
    const d = extractDomain(addr);
    return !!d && INTERNAL_DOMAINS.includes(d);
  };

  // 担当者を自社ドメインアドレスから抽出
  const getInternalAssignee = (): string => {
    const allEmails = Array.isArray(alert.emails) ? alert.emails : [];
    const internalSenders = allEmails
      .filter(email => isInternal(email.sender || ''))
      .map(email => email.sender || '')
      .filter(Boolean);
    
    // 最も頻繁に出現する内部アドレスを担当者とする
    const senderCounts: Record<string, number> = {};
    internalSenders.forEach(sender => {
      senderCounts[sender] = (senderCounts[sender] || 0) + 1;
    });
    
    const mostFrequentSender = Object.entries(senderCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    return mostFrequentSender || alert.assignee || '未割当';
  };

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
        }
      }
    });
  };

  const handleEscalation = () => {
    toast('経営陣への緊急報告を送信しました', { description: '15分以内に対応方針を決定してください。' });
  };

  const detectionScore = typeof alert.detection_score === 'number' ? Math.round(alert.detection_score) : undefined;
  const urgencyScore = typeof alert.urgencyScore === 'number' ? Math.round(alert.urgencyScore) : undefined;
  const apiDetectionReasons = alert.detectionReasons || [];
  const apiHighlightKeywords = alert.highlightKeywords || [];

  // メールを時系列順にソートし、リプライ階層を構築
  const allEmails = Array.isArray(alert.emails) ? alert.emails : [];
  const sortedEmails = [...allEmails].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const loadBodyIfNeeded = async (messageKey: string, messageId?: string | null) => {
    if (!messageId || bodyCache[messageKey] || loadingBodyIds[messageKey]) return;
    setLoadingBodyIds(prev => ({ ...prev, [messageKey]: true }));
    
    try {
      // Try to get email body from BigQuery directly
      const directQuery = `/api/email-body?message_id=${encodeURIComponent(messageId)}`;
      
      const res = await fetch(directQuery);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.body) {
          setBodyCache(prev => ({ ...prev, [messageKey]: data.body }));
          return;
        }
      }
      
      // Fallback: Try multiple API endpoints
      const endpoints = [
        `/api/alerts-threaded/message?message_id=${encodeURIComponent(messageId)}`,
        `/api/alerts/${alert.id}/message?message_id=${encodeURIComponent(messageId)}`,
        `/api/alerts-bigquery?message_id=${encodeURIComponent(messageId)}`
      ];
      
      let body = null;
      
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint);
          if (res.ok) {
            const data = await res.json();
            // Try multiple body field names
            body = data?.message?.body || 
                   data?.message?.body_preview || 
                   data?.message?.content || 
                   data?.message?.body_text ||
                   data?.body || 
                   data?.content ||
                   data?.body_preview;
            
            if (body && body.trim()) {
              break; // Found valid body content
            }
          }
        } catch (endpointError) {
          console.warn(`Failed to fetch from ${endpoint}:`, endpointError);
          continue;
        }
      }
      
      if (body && body.trim()) {
        setBodyCache(prev => ({ ...prev, [messageKey]: body }));
      } else {
        // Try to get body from the email object itself
        const email = sortedEmails.find(e => e.id === messageId);
        const fallbackBody = email?.body || 
                           email?.ai_summary || 
                           (email as any)?.body_preview ||
                           (email as any)?.content;
        
        if (fallbackBody && fallbackBody.trim()) {
          setBodyCache(prev => ({ ...prev, [messageKey]: fallbackBody }));
        } else {
          // Mark as unavailable but with a helpful message
          setBodyCache(prev => ({ 
            ...prev, 
            [messageKey]: `件名: ${email?.subject || '不明'}\n\n※ メール本文の詳細情報は現在利用できません。\n※ システム管理者にお問い合わせください。` 
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load email body:', error);
      // Provide a helpful error message
      setBodyCache(prev => ({ 
        ...prev, 
        [messageKey]: 'メール本文の読み込みに失敗しました。\nネットワーク接続を確認してから再度お試しください。' 
      }));
    } finally {
      setLoadingBodyIds(prev => ({ ...prev, [messageKey]: false }));
    }
  };

  // 検知ロジックの重み（UI表示用）
  const RULE_WEIGHTS: Record<string, number> = {
    'クレーム': 1.0, '苦情': 1.0, '不満': 1.0,
    '緊急': 1.5, '至急': 1.5, '急ぎ': 1.5,
    'キャンセル': 1.2, '解約': 1.2,
    '高い': 0.8, '料金': 0.8, '価格': 0.8,
    '不良': 1.3, '不具合': 1.3, '故障': 1.3,
    'まだですか': 1.1, '対応して': 1.1, '返事がない': 1.1,
  };
  
  const riskPhrases: string[] = Array.isArray(alert.phrases) ? alert.phrases : [];
  const matched = riskPhrases.filter(p => RULE_WEIGHTS[p] !== undefined);
  const ruleScore = matched.reduce((acc, p) => acc + (RULE_WEIGHTS[p] || 0), 0);
  const computedScore = typeof detectionScore === 'number' ? detectionScore : Math.min(100, Math.round(ruleScore * 30));

  const firstEmailSubject = (allEmails[0] && allEmails[0].subject) ? allEmails[0].subject : undefined;
  const sentimentLabel = (alert as any).sentiment_label as string | null | undefined;
  const sentimentScore = (alert as any).sentiment_score as number | null | undefined;
  const internalAssignee = getInternalAssignee();

  // 検知スコアが0の場合の処理
  const hasDetection = computedScore > 0;
  const displaySeverity = hasDetection ? alert.severity : 'C';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 text-white p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">アラート詳細</h2>
            <div className="flex items-center gap-2">
              {/* Status Update Buttons */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">ステータス:</span>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value as Alert['status'])}
                  className="bg-white text-gray-900 px-3 py-1 rounded text-sm border"
                >
                  <option value="pending">未対応</option>
                  <option value="in_progress">対応中</option>
                  <option value="resolved">解決済み</option>
                  <option value="closed">完了</option>
                </select>
                <Button size="sm" variant="secondary" onClick={handleStatusUpdate}>
                  更新
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-slate-700">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Summary + Risk Cards on top */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Summary Card */}
              <Card className="border-slate-200 bg-slate-50">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>アラート概要</span>
                    <Badge className={cn('text-xs', getSeverityColor(displaySeverity))}>
                      {displaySeverity === 'A' ? 'クリティカル' : displaySeverity === 'B' ? '重要' : '注意'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-sm space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">アラート件名</div>
                    <div className="font-semibold text-slate-900">
                      <HighlightText 
                        text={alert.subject || '—'} 
                        keywords={alert.highlightKeywords || []}
                      />
                    </div>
                  </div>
                  {firstEmailSubject && firstEmailSubject !== alert.subject && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">メール件名</div>
                      <div className="text-slate-900">{firstEmailSubject}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">顧客</div>
                      <div className="text-slate-900 font-medium">{alert.customer || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">担当者</div>
                      <div className="text-slate-900 font-medium">{internalAssignee}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Indicator Card */}
              <Card className={cn("border-red-200", hasDetection ? "bg-red-50" : "bg-gray-50")}>
                <CardHeader className="py-3 px-4">
                  <CardTitle className={cn("text-base", hasDetection ? "text-red-800" : "text-gray-600")}>
                    リスク指標
                    {!hasDetection && (
                      <Badge className="ml-2 bg-gray-100 text-gray-600">検知なし</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-sm space-y-4">
                  {/* スコア表示 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className={cn("text-xs mb-1", hasDetection ? "text-red-600" : "text-gray-500")}>検知スコア</div>
                      <div className={cn("font-bold text-lg", hasDetection ? "text-red-800" : "text-gray-600")}>
                        {computedScore}/100
                      </div>
                    </div>
                    <div>
                      <div className={cn("text-xs mb-1", hasDetection ? "text-red-600" : "text-gray-500")}>感情分析</div>
                      <div className={cn("font-semibold", hasDetection ? "text-red-800" : "text-gray-600")}>
                        {sentimentLabel || 'neutral'} ({sentimentScore?.toFixed(2) || '0.00'})
                      </div>
                    </div>
                  </div>

                  {/* 検知理由の説明 */}
                  <div className={cn("p-3 rounded-lg border", hasDetection ? "bg-red-25 border-red-200" : "bg-gray-25 border-gray-200")}>
                    <div className={cn("text-xs font-medium mb-2", hasDetection ? "text-red-700" : "text-gray-600")}>
                      なぜこのスコアになったのか
                    </div>
                    <div className={cn("text-sm leading-relaxed", hasDetection ? "text-red-800" : "text-gray-700")}>
                      {hasDetection ? (
                        <>
                          このアラートは<span className="font-semibold text-red-900">リスクレベル{urgencyScore || computedScore}点</span>と判定されました。
                          {apiDetectionReasons.length > 0 && (
                            <>
                              システムが「<span className="font-semibold">{apiDetectionReasons.join('」「')}</span>」を検知し、
                            </>
                          )}
                          {apiHighlightKeywords.length > 0 && (
                            <>
                              メール内容から「<span className="font-semibold">{apiHighlightKeywords.join('」「')}</span>」などの
                              <span className="font-semibold text-red-900">注意が必要なキーワード</span>が検出されています。
                            </>
                          )}
                          {sentimentScore && sentimentScore < -0.3 && (
                            <>
                              また、感情分析により<span className="font-semibold text-red-900">ネガティブな感情</span>
                              （スコア: {sentimentScore.toFixed(2)}）が検出されており、
                            </>
                          )}
                          {(urgencyScore || computedScore) >= 80 ? (
                            <span className="font-semibold text-red-900">緊急対応が必要</span>
                          ) : (urgencyScore || computedScore) >= 50 ? (
                            <span className="font-semibold text-orange-700">早急な対応が推奨</span>
                          ) : (urgencyScore || computedScore) >= 30 ? (
                            <span className="font-semibold text-yellow-700">注意深い対応が必要</span>
                          ) : (
                            <span className="font-semibold text-blue-700">通常対応で問題なし</span>
                          )}
                          な状況と判断されます。
                        </>
                      ) : (
                        <>
                          このメールは<span className="font-semibold text-gray-700">通常のコミュニケーション</span>と判定されました。
                          リスクを示すキーワードや強いネガティブ感情は検出されていないため、
                          <span className="font-semibold text-green-700">標準的な対応</span>で問題ありません。
                        </>
                      )}
                    </div>
                  </div>

                  {/* 新しいAPIベースの検知理由表示 */}
                  {apiDetectionReasons.length > 0 && (
                    <DetectionReasons 
                      reasons={apiDetectionReasons} 
                      score={urgencyScore || computedScore}
                    />
                  )}

                  {/* 従来の検知フレーズ詳細（フォールバック） */}
                  {matched.length > 0 && apiDetectionReasons.length === 0 && (
                    <div>
                      <div className="text-xs text-red-600 mb-2">検知されたリスクキーワード</div>
                      <div className="flex flex-wrap gap-1">
                        {matched.map((phrase, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-red-100 text-red-700 border-red-200">
                            {phrase} (重要度×{RULE_WEIGHTS[phrase]})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 対応推奨アクション */}
                  {hasDetection && (
                    <div className={cn("p-3 rounded-lg border-l-4", 
                      (urgencyScore || computedScore) >= 80 ? "bg-red-50 border-red-400" :
                      (urgencyScore || computedScore) >= 50 ? "bg-orange-50 border-orange-400" :
                      "bg-yellow-50 border-yellow-400"
                    )}>
                      <div className={cn("text-xs font-medium mb-1",
                        (urgencyScore || computedScore) >= 80 ? "text-red-700" :
                        (urgencyScore || computedScore) >= 50 ? "text-orange-700" :
                        "text-yellow-700"
                      )}>
                        推奨アクション
                      </div>
                      <div className={cn("text-sm",
                        (urgencyScore || computedScore) >= 80 ? "text-red-800" :
                        (urgencyScore || computedScore) >= 50 ? "text-orange-800" :
                        "text-yellow-800"
                      )}>
                        {(urgencyScore || computedScore) >= 80 ? (
                          "即座に顧客に連絡を取り、問題の詳細を確認してください。必要に応じて上司やチームリーダーに報告し、迅速な解決策を検討してください。"
                        ) : (urgencyScore || computedScore) >= 50 ? (
                          "24時間以内に顧客に連絡を取り、状況を確認してください。問題が深刻化する前に適切な対応を行うことが重要です。"
                        ) : (
                          "通常の業務時間内に対応してください。顧客の要望や懸念を丁寧に聞き取り、適切なサポートを提供してください。"
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Communication History */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  コミュニケーション履歴
                  <Badge variant="secondary" className="ml-2">
                    {sortedEmails.length}件のメッセージ
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {sortedEmails.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    コミュニケーション履歴が見つかりませんでした
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Message Thread View - Each reply as separate unit */}
                    {sortedEmails.map((email, index) => {
                      const messageKey = `message-${index}`;
                      const isLoading = loadingBodyIds[messageKey];
                      const cachedBody = bodyCache[messageKey];
                      const isInternalEmail = isInternal(email.sender || '');
                      const replyLevel = email.replyLevel || 0;
                      
                      return (
                        <div key={messageKey} className="border rounded-lg overflow-hidden shadow-sm">
                          {/* Message Header */}
                          <div className={cn(
                            "px-4 py-3 border-b",
                            isInternalEmail 
                              ? "bg-green-50 border-green-200" 
                              : "bg-blue-50 border-blue-200"
                          )}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                {/* Message Number and Reply Level */}
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    #{index + 1}
                                  </Badge>
                                  {replyLevel > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      <Reply className="h-3 w-3 mr-1" />
                                      Re: {replyLevel}
                                    </Badge>
                                  )}
                                  <Badge 
                                    variant={isInternalEmail ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {isInternalEmail ? "内部" : "顧客"}
                                  </Badge>
                                </div>
                                
                                {/* Subject */}
                                <div className={cn(
                                  "font-medium text-sm mb-2",
                                  isInternalEmail ? "text-green-900" : "text-blue-900"
                                )}>
                                  {email.subject || '件名なし'}
                                </div>
                                
                                {/* From/To */}
                                <div className={cn(
                                  "text-sm",
                                  isInternalEmail ? "text-green-700" : "text-blue-700"
                                )}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {email.sender}
                                    </span>
                                    <ArrowRight className="h-3 w-3" />
                                    <span>{email.recipient}</span>
                                  </div>
                                </div>
                                
                                {/* Timestamp */}
                                <div className={cn(
                                  "text-xs mt-1 flex items-center gap-1",
                                  isInternalEmail ? "text-green-600" : "text-blue-600"
                                )}>
                                  <Clock className="h-3 w-3" />
                                  {formatDateTime(email.timestamp)}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Message Body */}
                          <Accordion type="single" collapsible>
                            <AccordionItem value={messageKey} className="border-none">
                              <AccordionTrigger 
                                className="px-4 py-3 hover:no-underline text-sm font-medium"
                                onClick={() => loadBodyIfNeeded(messageKey, email.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <MessageCircle className="h-4 w-4" />
                                  メール本文を表示
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-4 pb-4">
                                <div className="bg-gray-50 rounded-lg p-4 border">
                                  {isLoading ? (
                                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                                      本文を読み込み中…
                                    </div>
                                  ) : cachedBody ? (
                                    <div className="text-gray-900 text-sm whitespace-pre-wrap leading-relaxed">
                                      {cachedBody}
                                    </div>
                                  ) : (
                                    <div className="text-gray-900 text-sm whitespace-pre-wrap leading-relaxed">
                                      {/* Try multiple fallback sources for email content */}
                                      {email.body || 
                                       email.ai_summary || 
                                       (email as any).body_preview ||
                                       (email as any).content ||
                                       email.subject ? `件名: ${email.subject}\n\n※ 本文の詳細は読み込めませんでした。\n※ システム管理者にお問い合わせください。` : 
                                       '※ 本文が見つかりません'}
                                    </div>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 
