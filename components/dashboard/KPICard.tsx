import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function KPICard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendValue, 
  icon,
  className 
}: KPICardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-red-700';
      case 'down':
        return 'text-emerald-700';
      default:
        return 'text-slate-600';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return '↗';
      case 'down':
        return '↘';
      default:
        return '→';
    }
  };

  return (
    <Card className={cn('hover:shadow-lg transition-shadow duration-200', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        {icon && <div className="text-gray-400">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
        {subtitle && (
          <p className="text-sm text-gray-600 mb-2">{subtitle}</p>
        )}
        {trend && trendValue && (
          <div className={cn('text-sm flex items-center', getTrendColor())}>
            <span className="mr-1">{getTrendIcon()}</span>
            {trendValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 