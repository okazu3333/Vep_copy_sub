import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/types';
import { Clock, User, Building2, Hash, Gauge, MessagesSquare, Layers, Tag, TrendingDown, TrendingUp, Minus, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertCardProps {
  alert: Alert & { thread_count?: number; id_count?: number };
  onClick: () => void;
}

export function AlertCard({ alert, onClick }: AlertCardProps) {
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
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
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
    const label = overdue ? `SLA超過 ${Math.abs(remaining)}h` : `SLA残り ${remaining}h`;
    const klass = overdue ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200';
    return (
      <Badge className={cn('text-xs font-medium border', klass)}>
        <Timer className="h-3 w-3 mr-1" />{label}
      </Badge>
    );
  };

  const detectionScore = typeof alert.detection_score === 'number' ? alert.detection_score : undefined;

  const phraseBadges = (alert.phrases || []).slice(0, 3);

  return (
    <Card className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border-l-4 border-l-gray-200 hover:border-l-blue-500" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Badge className={cn('text-xs font-bold shadow-sm', getSeverityColor(alert.severity))}>
              {getSeverityLabel(alert.severity)}
            </Badge>
            <Badge className={cn('text-xs font-medium', getStatusColor(alert.status))}>
              {getStatusText(alert.status)}
            </Badge>
            {alert.status !== 'completed' && getSlaBadge()}
          </div>
        </div>
        
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 text-lg leading-tight">
            {alert.subject}
          </h3>
          <div className="flex items-center gap-2">
            {typeof alert.thread_count === 'number' && alert.thread_count > 1 && (
              <Badge variant="secondary" className="text-[11px] flex items-center bg-blue-50 text-blue-700 border border-blue-200">
                <MessagesSquare className="h-3 w-3 mr-1" />同一スレ {alert.thread_count}
              </Badge>
            )}
            {typeof alert.id_count === 'number' && alert.id_count > 1 && (
              <Badge variant="secondary" className="text-[11px] flex items-center bg-violet-50 text-violet-700 border border-violet-200">
                <Layers className="h-3 w-3 mr-1" />同一ID {alert.id_count}
              </Badge>
            )}
            <Badge variant="outline" className="font-mono text-[11px] flex items-center">
              <Hash className="h-3 w-3 mr-1" />{alert.id}
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
          <div className="flex items-center text-gray-600">
            <Building2 className="mr-1 h-3 w-3" />
            <span className="font-medium">{alert.company || 'unknown.co'}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <User className="mr-1 h-3 w-3" />
            <span className="font-medium">{alert.customer}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <User className="mr-1 h-3 w-3" />
            <span className="font-medium">{alert.assignee || '未割当'}</span>
          </div>
        </div>

        {phraseBadges.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mb-2">
            {phraseBadges.map((p, i) => (
              <Badge key={i} variant="secondary" className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 flex items-center">
                <Tag className="h-3 w-3 mr-1" />{p}
              </Badge>
            ))}
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">リスク指数:</span>
            <div className={cn('flex items-center space-x-1 text-sm', getSentimentColor(alert.sentiment_score))}>
              {getSentimentIcon(alert.sentiment_score)}
              <span className="font-bold">
              {alert.sentiment_score.toFixed(2)}
              </span>
            </div>
          </div>
          {typeof detectionScore === 'number' && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">検知スコア:</span>
              <div className="flex items-center text-sm text-gray-800 font-semibold">
                <Gauge className="h-3 w-3 mr-1" />{Math.round(detectionScore)}
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
            {alert.ai_summary}
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 