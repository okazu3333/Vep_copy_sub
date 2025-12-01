import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/types';
import { User, Hash, Gauge, MessagesSquare, TrendingDown, TrendingUp, Minus, Timer, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSegmentMeta } from '@/lib/segments';
import { getAlertCategoryMeta } from '@/lib/alert-categories';
import { formatOwnerLabel } from '@/lib/owner-labels';
import { detectDetailedSegment } from '@/lib/detailed-segments';

interface AlertCardProps {
  alert: Alert & { 
    thread_count?: number; 
    id_count?: number;
    phaseC?: any;
    phaseD?: any;
    detectionRule?: any;
  };
  onClick: () => void;
  isHighlighted?: boolean;
}

export function AlertCard({ alert, onClick, isHighlighted = false }: AlertCardProps) {
  const getSeverityColor = (severity: 'A' | 'B' | 'C') => {
    switch (severity) {
      case 'A':
        return 'bg-red-600 text-white';
      case 'B':
        return 'bg-amber-600 text-white';
      case 'C':
        return 'bg-yellow-600 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  const getSeverityLabel = (severity: 'A' | 'B' | 'C') => {
    switch (severity) {
      case 'A':
        return 'クリティカル';
      case 'B':
        return '重要';
      case 'C':
        return '注意';
      default:
        return '不明';
    }
  };
  
  const getStatusColor = (status: Alert['status']) => {
    switch (status) {
      case 'unhandled':
        return 'bg-red-50 text-red-800 border border-red-200';
      case 'in_progress':
        return 'bg-blue-50 text-blue-800 border border-blue-200';
      case 'completed':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusText = (status: Alert['status']) => {
    switch (status) {
      case 'unhandled':
        return '要対応';
      case 'in_progress':
        return '対応中';
      case 'completed':
        return '解決済み';
      default:
        return '不明';
    }
  };

  const getSentimentColor = (score: number) => {
    if (score < -0.3) return 'text-red-600 font-semibold';
    if (score > 0.3) return 'text-green-600 font-semibold';
    return 'text-gray-600';
  };

  const getSentimentIcon = (score: number) => {
    if (score < -0.3) return <TrendingDown className="h-3 w-3" />;
    if (score > 0.3) return <TrendingUp className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };
  
  const getSlaHours = (severity: 'A' | 'B' | 'C') => {
    if (severity === 'A') return 24;
    if (severity === 'B') return 48;
    return 72;
  };

  const getSlaBadge = () => {
    const updated = new Date(alert.updated_at).getTime();
    const now = Date.now();
    const elapsedHours = (now - updated) / (1000 * 60 * 60);
    const sla = getSlaHours(alert.severity);
    const remaining = Math.ceil(sla - elapsedHours);
    const overdue = remaining < 0;
    const overdueHours = overdue ? Math.abs(remaining) : 0;
    
    // SLA超過が一定基準（24時間）以下の場合は表示しない
    if (overdue && overdueHours <= 24) {
      return null;
    }
    
    const label = overdue ? `SLA超過 ${overdueHours}h` : `SLA残り ${remaining}h`;
    const klass = overdue ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200';
    return (
      <Badge className={cn('text-xs font-medium px-2 py-1 border', klass)}>
        <Timer className="h-3.5 w-3.5 mr-1" />{label}
      </Badge>
    );
  };

  const detectionScore = typeof alert.detection_score === 'number' ? alert.detection_score : undefined;
  const phaseC = (alert as any).phaseC;
  const phaseD = (alert as any).phaseD;
  const detectionRule = (alert as any).detectionRule;
  const categoryMeta = getAlertCategoryMeta(alert);
  const segmentMeta = getSegmentMeta(alert.primarySegment ?? undefined);
  const detailedSegmentMeta = detectDetailedSegment(alert);
  const ownerDisplay = formatOwnerLabel(alert.assignee || '');

  const detectionTags: Array<{ label: string; className: string }> = [];
  if (segmentMeta) {
    detectionTags.push({ label: segmentMeta.label, className: segmentMeta.badgeClass });
  }
  if (alert.severity === 'A') {
    detectionTags.push({ label: '緊急対応', className: 'bg-red-600 text-white border border-red-500' });
  }
  if (detectionRule?.rule_type === 'inactivity_72h') {
    detectionTags.push({ label: '72h未対応', className: 'bg-amber-100 text-amber-700 border border-amber-200' });
  } else if (detectionRule?.rule_type === 'sentiment_urgency') {
    detectionTags.push({ label: '催促アラート', className: 'bg-red-100 text-red-700 border border-red-200' });
  } else if (detectionRule?.rule_type === 'tone_frequency_drop') {
    detectionTags.push({ label: 'トーン低下', className: 'bg-blue-100 text-blue-700 border border-blue-200' });
  }
  const uniqueDetectionTags = Array.from(
    detectionTags.reduce(
      (acc, tag) => {
        if (!acc.has(tag.label)) {
          acc.set(tag.label, tag);
        }
        return acc;
      },
      new Map<string, { label: string; className: string }>()
    ).values()
  );
  
  // Check if there's any actual detection (phrases or segments)
  const hasDetection = (alert.phrases && alert.phrases.length > 0) || 
                      (alert.segments && (alert.segments.lose || alert.segments.rival || alert.segments.addreq || alert.segments.renewal));
  
  // Sync flag with detection - if no detection, show lower severity
  const actualSeverity = hasDetection ? alert.severity : 'C';
  const phraseBadges = (alert.phrases || []).slice(0, 3);

  const bodyPreview =
    (alert as any).body_preview ??
    alert.emails?.[0]?.body ??
    alert.emails?.[0]?.ai_summary ??
    '';

  const headerBadges = [
    {
      key: 'severity',
      node: (
        <Badge className={cn('text-xs font-bold px-2 py-1', getSeverityColor(actualSeverity))}>
          {getSeverityLabel(actualSeverity)}
        </Badge>
      ),
    },
    {
      key: 'status',
      node: (
        <Badge className={cn('text-xs font-medium px-2 py-1', getStatusColor(alert.status))}>
          {getStatusText(alert.status)}
        </Badge>
      ),
    },
    {
      key: 'category',
      node: (
        <Badge className={cn('text-xs font-medium px-2 py-1', categoryMeta.badgeClass)}>
          {categoryMeta.label}
        </Badge>
      ),
    },
    alert.status !== 'completed' && getSlaBadge()
      ? {
          key: 'sla',
          node: getSlaBadge(),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; node: ReactNode }>;

  const tagGroups: Array<{ title: string; badges: Array<{ label: string; className: string }> }> = [];

  // 詳細セグメント（中項目）を表示
  if (detailedSegmentMeta) {
    tagGroups.push({
      title: 'セグメント',
      badges: [{ label: detailedSegmentMeta.label, className: detailedSegmentMeta.badgeClass }],
    });
  } else if (segmentMeta) {
    // フォールバック: 詳細セグメントが判定できない場合は大項目を表示
    tagGroups.push({
      title: 'セグメント',
      badges: [{ label: segmentMeta.label, className: segmentMeta.badgeClass }],
    });
  }

  if (uniqueDetectionTags.length > 0) {
    tagGroups.push({
      title: '検知シグナル',
      badges: uniqueDetectionTags,
    });
  }

  if (phraseBadges.length > 0) {
    tagGroups.push({
      title: 'キーワード',
      badges: phraseBadges.slice(0, 3).map((p) => ({
        label: p,
        className: 'bg-amber-50 text-amber-700 border border-amber-200',
      })),
    });
  }

  const insightCards: Array<{ key: string; label: string; value: ReactNode; className: string }> = [];
  const segmentInfo = getSegmentMeta(alert.primarySegment ?? undefined);
  const isRecovery = segmentInfo?.category.key === 'follow';
  const shouldShowPhaseC = phaseC && isRecovery;

  if (shouldShowPhaseC) {
    insightCards.push({
      key: 'phaseC',
      label: '鎮火確率',
      value: `${(phaseC.p_resolved_24h * 100).toFixed(0)}%`,
      className: 'bg-blue-50 border-blue-200 text-blue-900',
    });
  }

  // 品質表示は削除

  // 検知表示を中項目セグメントに変更
  if (detailedSegmentMeta) {
    insightCards.push({
      key: 'detection',
      label: '検知',
      value: detailedSegmentMeta.label,
      className: 'bg-rose-50 border-rose-200 text-rose-900',
    });
  }

  const metricTiles: Array<{ key: string; icon: ReactNode; label: string; value: ReactNode }> = [
    typeof detectionScore === 'number'
      ? {
          key: 'detectionScore',
          icon: <Gauge className="h-3.5 w-3.5 text-slate-400" />,
          label: '検知スコア',
          value: Math.round(detectionScore),
        }
      : null,
    {
      key: 'sentiment',
      icon: getSentimentIcon(alert.sentiment_score),
      label: '感情スコア',
      value: <span className={cn('font-semibold', getSentimentColor(alert.sentiment_score))}>{alert.sentiment_score.toFixed(1)}</span>,
    },
    typeof alert.thread_count === 'number' && alert.thread_count > 1
      ? {
          key: 'threads',
          icon: <MessagesSquare className="h-3.5 w-3.5 text-blue-500" />,
          label: 'スレッド',
          value: alert.thread_count,
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; icon: React.ReactNode; label: string; value: React.ReactNode }>;

  const summaryBlocks = [
    alert.ai_summary
      ? {
          key: 'summary',
          title: 'AI要約',
          text: alert.ai_summary,
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; title: string; text: string }>;

  return (
    <Card
      data-testid="alert-card"
      className={cn(
        'cursor-pointer transition-all duration-200 border border-slate-200 hover:border-blue-300 hover:shadow-md',
        isHighlighted && 'ring-2 ring-blue-400 shadow-lg'
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-3">
        {/* ヘッダー: 重要度・ステータス・SLA */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {headerBadges.map((badge) => (
              <div key={badge.key}>{badge.node}</div>
            ))}
          </div>
          <Badge variant="outline" className="font-mono text-xs px-2 py-1">
            <Hash className="h-3.5 w-3.5 mr-1" />{alert.id}
          </Badge>
        </div>
        
        {/* 件名 */}
        <div>
          <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 leading-snug">
            {alert.subject}
          </h3>
          {alert.email_subject && alert.email_subject !== alert.subject && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="line-clamp-1 truncate">{alert.email_subject}</span>
            </div>
          )}
        </div>

        {/* 顧客・担当者情報 */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 min-w-0">
            <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="font-medium truncate max-w-[160px]">{alert.customer}</span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="truncate max-w-[140px]">{ownerDisplay}</span>
        </div>

        {/* セグメント / 検知タグ / キーワード */}
        {tagGroups.length > 0 && (
          <div className="space-y-1.5">
            {tagGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{group.title}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {group.badges.slice(0, 3).map((tag, index) => (
                    <Badge key={`${group.title}-${tag.label}-${index}`} className={cn('text-xs font-medium px-2 py-1', tag.className)}>
                      {tag.label}
                    </Badge>
                  ))}
                  {group.badges.length > 3 && (
                    <span className="text-xs text-slate-400">+{group.badges.length - 3}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分析モデル指標 */}
        {insightCards.length > 0 && (
          <div className={cn('grid gap-2', insightCards.length === 1 ? 'grid-cols-1' : insightCards.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
            {insightCards.map((card) => (
              <div key={card.key} className={cn('px-2 py-2 border rounded text-center', card.className)}>
                <div className="text-xs font-medium mb-0.5">{card.label}</div>
                <div className="text-sm font-bold">{card.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* スコア・感情分析 */}
        {metricTiles.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <div className={cn('grid gap-3', metricTiles.length === 1 ? 'grid-cols-1' : metricTiles.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
              {metricTiles.map((metric) => (
                <div key={metric.key} className="flex items-center gap-2 text-xs text-slate-600">
                  {metric.icon}
                  <span className="text-[11px] text-slate-500">{metric.label}</span>
                  <span className="text-sm font-semibold text-slate-900">{metric.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 本文/要約 */}
        {summaryBlocks.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            {summaryBlocks.map((block) => (
              <div key={block.key}>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">{block.title}</div>
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{block.text}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
