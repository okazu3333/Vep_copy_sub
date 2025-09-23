'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert } from '@/types';
import { X, Clock, User, Building2, MessageCircle, TrendingUp, AlertTriangle, MoreHorizontal, Send, Gauge, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface AlertDetailProps {
  alert: Alert;
  onClose: () => void;
  isWorkerView?: boolean;
}

export function AlertDetail({ alert, onClose, isWorkerView = false }: AlertDetailProps) {
  const [status, setStatus] = useState(alert.status);
  const [comment, setComment] = useState('');
  const [loadingBodyIds, setLoadingBodyIds] = useState<Record<string, boolean>>({});
  const [bodyCache, setBodyCache] = useState<Record<string, string>>({});

  // 社内ドメイン判定（暫定リスト）
  const INTERNAL_DOMAINS = [
    'fittio.co.jp','gra-m.com','withwork.co.jp','cross-c.co.jp','propworks.co.jp','cross-m.co.jp',
    'cm-group.co.jp','shoppers-eye.co.jp','d-and-m.co.jp','medi-l.com','metasite.co.jp','infidex.co.jp',
    'excrie.co.jp','alternaex.co.jp','cmg.traffics.jp','tokyogets.com','pathcrie.co.jp','reech.co.jp'
  ];
  const extractDomain = (s: string): string | null => {
    if (!s) return null;
    const m = s.toLowerCase().match(/@([^>\s]+)>?$/);
    return m ? m[1] : null;
  };
  const isInternal = (addr: string): boolean => {
    const d = extractDomain(addr);
    return !!d && INTERNAL_DOMAINS.includes(d);
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

  const getSentimentColor = (sentiment: 'positive' | 'negative' | 'neutral') => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'negative':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP');
  };

  const handleStatusUpdate = () => {
    const prev = alert.status;
    alert.status = status as Alert['status'];
    const t = toast.success('対応ステータスを更新しました', {
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

  // 2カラム表示用に仕分け（左=外部/クライアント、右=社内）
  const allEmails = Array.isArray(alert.emails) ? alert.emails : [];
  const isInternalMessage = (sender: string, recipient: string) => {
    if (sender) return isInternal(sender);
    if (recipient) return isInternal(recipient); // フォールバック
    return false;
  };
  const leftEmails = allEmails.filter(e => !isInternalMessage(e.sender, e.recipient));
  const rightEmails = allEmails.filter(e => isInternalMessage(e.sender, e.recipient));

  const toggleAllAccordions = () => {
    ['thread-accordion-left', 'thread-accordion-right'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const details = el.querySelectorAll('button[aria-controls]');
      details.forEach((btn) => (btn as HTMLButtonElement).click());
    });
  };

  const loadBodyIfNeeded = async (messageKey: string, messageId?: string | null) => {
    if (!messageId || bodyCache[messageKey] || loadingBodyIds[messageKey]) return;
    setLoadingBodyIds(prev => ({ ...prev, [messageKey]: true }));
    try {
      const res = await fetch(`/api/alerts-threaded/message?message_id=${encodeURIComponent(messageId)}`, {
        headers: { 'Authorization': `Basic ${btoa('cmgadmin:crossadmin')}` },
      });
      if (res.ok) {
        const data = await res.json();
        const body = data?.message?.body_preview as string | undefined;
        if (body) setBodyCache(prev => ({ ...prev, [messageKey]: body }));
      }
    } catch {}
    finally {
      setLoadingBodyIds(prev => ({ ...prev, [messageKey]: false }));
    }
  };

  const defaultLeft = leftEmails.length ? [`lmsg-0`] : [];
  const defaultRight = rightEmails.length ? [`rmsg-0`] : [];

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800 text-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">リスクアラート詳細分析</h2>
            <div className="flex items-center gap-2">
              {!isWorkerView && (
                <>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleEscalation}>
                    🚨 エスカレーション
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleStatusUpdate}>
                    <Send className="h-4 w-4 mr-1" /> ステータス更新
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>📊 役員会資料に追加</DropdownMenuItem>
                      <DropdownMenuItem>📝 タスク化（モック）</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Summary + Risk Cards on top */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Summary Card */}
            <Card className="border-slate-200 bg-slate-50">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>アラート概要</span>
                  <Badge className={cn('text-xs', getSeverityColor(alert.severity))}>
                    {alert.severity === 'A' ? 'クリティカル' : alert.severity === 'B' ? '重要' : '注意'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 text-sm space-y-2">
                <div>
                  <div className="text-xs text-slate-500">アラート件名</div>
                  <div className="font-semibold text-slate-900 truncate">{alert.subject || '—'}</div>
                </div>
                {firstEmailSubject && firstEmailSubject !== alert.subject && (
                  <div>
                    <div className="text-xs text-slate-500">メール件名</div>
                    <div className="text-slate-900 truncate">{firstEmailSubject}</div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500">会社名</div>
                    <div className="text-slate-900 font-medium truncate">{alert.company || 'unknown.co'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">関係顧客</div>
                    <div className="text-slate-900 font-medium truncate">{alert.customer}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">最終更新</div>
                  <div className="text-slate-900">{formatDateTime(alert.updated_at)}</div>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Hash className="h-3 w-3" />{alert.id}
                </div>
              </CardContent>
            </Card>

            {/* Risk Card */}
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-base flex items-center">
                  <TrendingUp className="mr-1 h-4 w-4 text-purple-500" />
                  リスク指標（根拠付き）
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs text-purple-700">
                    <span>検知スコア</span>
                    <span className="font-semibold text-purple-900">{computedScore}</span>
                  </div>
                  <div className="mt-1 h-2 w-full bg-purple-100 rounded">
                    <div className="h-2 bg-purple-500 rounded" style={{ width: `${Math.max(0, Math.min(100, computedScore))}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-purple-700 mb-1">検知理由</div>
                  {matched.length ? (
                    <div className="flex flex-wrap gap-1">
                      {matched.map((p, i) => (
                        <Badge key={i} variant="secondary" className="text-[11px] py-0.5 px-2">{p}（{RULE_WEIGHTS[p]}）</Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[12px] text-gray-700">{alert.ai_summary || '—'}</div>
                  )}
                </div>
                <div className="text-[11px] text-gray-600">
                  算定式: 合計重み {ruleScore.toFixed(1)} × 30 → 上限100（表示 {computedScore}）
                </div>
                {typeof sentimentScore === 'number' && (
                  <div className="text-[12px] text-purple-800">
                    感情: {sentimentLabel || 'neutral'}（{sentimentScore.toFixed(2)}）
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* メッセージヘッダはカード化に伴い簡略化 */}

          <div className="grid grid-cols-1 gap-6">
            {/* Main Content */}
            <div className="space-y-6">
              {/* Email Thread */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <MessageCircle className="mr-2 h-5 w-5 text-blue-500" />
                    コミュニケーション履歴
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {allEmails && allEmails.length > 0 ? (
                    <>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm text-gray-600">1リプライ単位・左右分離表示</div>
                        <Button variant="outline" size="sm" onClick={toggleAllAccordions}>全て開閉</Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left: Client/External */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary">クライアント</Badge>
                          </div>
                          <Accordion type="multiple" id="thread-accordion-left" className="space-y-2" defaultValue={defaultLeft}>
                            {leftEmails.map((email, idx) => {
                              const header = (
                                <div className="w-full flex items-center justify-between">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Badge variant="secondary">顧客 → 社内</Badge>
                                    <span className="font-semibold text-gray-900 truncate max-w-[18rem]">{email.sender || 'Unknown'}</span>
                                    <span className="text-gray-500">→</span>
                                    <span className="font-semibold text-gray-900 truncate max-w-[18rem]">{email.recipient || 'Unknown'}</span>
                                    {email.subject && <span className="text-gray-600 truncate max-w-[20rem]">｜{email.subject}</span>}
                                  </div>
                                  <span className="text-sm text-gray-500">{formatDateTime(email.timestamp)}</span>
                                </div>
                              );
                              const bodyKey = email.id;
                              const bodyLoaded = !!bodyCache[bodyKey];
                              const loading = !!loadingBodyIds[bodyKey];
                              return (
                                <AccordionItem key={email.id} value={`lmsg-${idx}`} className="rounded-lg border shadow-sm bg-white border-gray-200">
                                  <AccordionTrigger className="px-4" onClick={() => loadBodyIfNeeded(bodyKey, email.messageId)}>{header}</AccordionTrigger>
                                  <AccordionContent className="px-4 pb-4">
                                    <div className="text-xs text-gray-500 mb-2">{loading ? '本文を読み込み中…' : (bodyLoaded ? '本文を表示中' : 'プレビュー表示')}</div>
                                    <div className="text-sm text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">{bodyLoaded ? bodyCache[bodyKey] : email.ai_summary}</div>
                                    {typeof email.replyLevel === 'number' && (
                                      <div className="mt-2 text-xs text-gray-500">返信レベル: {email.replyLevel}{email.inReplyTo ? `｜In-Reply-To: ${email.inReplyTo}` : ''}</div>
                                    )}
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        </div>

                        {/* Right: Internal */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-blue-600">社内</Badge>
                          </div>
                          <Accordion type="multiple" id="thread-accordion-right" className="space-y-2" defaultValue={defaultRight}>
                            {rightEmails.map((email, idx) => {
                              const header = (
                                <div className="w-full flex items-center justify-between">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Badge className="bg-blue-600">社内 → 顧客</Badge>
                                    <span className="font-semibold text-gray-900 truncate max-w-[18rem]">{email.sender || 'Unknown'}</span>
                                    <span className="text-gray-500">→</span>
                                    <span className="font-semibold text-gray-900 truncate max-w-[18rem]">{email.recipient || 'Unknown'}</span>
                                    {email.subject && <span className="text-gray-600 truncate max-w-[20rem]">｜{email.subject}</span>}
                                  </div>
                                  <span className="text-sm text-gray-500">{formatDateTime(email.timestamp)}</span>
                                </div>
                              );
                              const bodyKey = email.id;
                              const bodyLoaded = !!bodyCache[bodyKey];
                              const loading = !!loadingBodyIds[bodyKey];
                              return (
                                <AccordionItem key={email.id} value={`rmsg-${idx}`} className="rounded-lg border shadow-sm bg-blue-50 border-blue-200">
                                  <AccordionTrigger className="px-4" onClick={() => loadBodyIfNeeded(bodyKey, email.messageId)}>{header}</AccordionTrigger>
                                  <AccordionContent className="px-4 pb-4">
                                    <div className="text-xs text-gray-500 mb-2">{loading ? '本文を読み込み中…' : (bodyLoaded ? '本文を表示中' : 'プレビュー表示')}</div>
                                    <div className="text-sm text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">{bodyLoaded ? bodyCache[bodyKey] : email.ai_summary}</div>
                                    {typeof email.replyLevel === 'number' && (
                                      <div className="mt-2 text-xs text-gray-500">返信レベル: {email.replyLevel}{email.inReplyTo ? `｜In-Reply-To: ${email.inReplyTo}` : ''}</div>
                                    )}
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded p-4">
                      コミュニケーション履歴が見つかりませんでした。時間をおいて再度お試しください。
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar removed to give messages full width */}
          </div>
        </div>
      </div>
    </div>
  );
} 