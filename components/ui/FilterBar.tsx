"use client";

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSavedViews } from '@/hooks/use-saved-views';
import { Bookmark, Save, Trash2 } from 'lucide-react';

export interface AlertsFilters {
  department: string;
  customer: string;
  severity: string;
  period: string;
  status: string;
  search: string;
}

interface FilterBarProps {
  filters: AlertsFilters;
  onFiltersChange: (_filters: AlertsFilters) => void;
  hidePeriod?: boolean;
}

export function FilterBar({ filters, onFiltersChange, hidePeriod = false }: FilterBarProps) {
  const tokens = useMemo(() => {
    const t: string[] = [];
    if (filters.department !== 'all') t.push(`部門:${filters.department}`);
    if (filters.severity !== 'all') t.push(`レベル:${filters.severity}`);
    if (filters.status !== 'all') t.push(`状態:${filters.status}`);
    if (!hidePeriod && filters.period !== 'all') t.push(`期間:${filters.period}`);
    if (filters.customer) t.push(`顧客:${filters.customer}`);
    if (filters.search) t.push(`検索:${filters.search}`);
    return t;
  }, [filters, hidePeriod]);

  const handleClear = () => {
    onFiltersChange({ 
      department: 'all', 
      customer: '', 
      severity: 'all', 
      period: 'all', 
      status: 'all', 
      search: '' 
    });
  };

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div>
          <label className="text-xs text-gray-500">部門</label>
          <Select value={filters.department} onValueChange={(v) => onFiltersChange({ ...filters, department: v })}>
            <SelectTrigger>
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="営業部">営業部</SelectItem>
              <SelectItem value="マーケティング部">マーケティング部</SelectItem>
              <SelectItem value="カスタマーサクセス部">カスタマーサクセス部</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500">重要度</label>
          <Select value={filters.severity} onValueChange={(v) => onFiltersChange({ ...filters, severity: v })}>
            <SelectTrigger>
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="A">A (高)</SelectItem>
              <SelectItem value="B">B (中)</SelectItem>
              <SelectItem value="C">C (低)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500">ステータス</label>
          <Select value={filters.status} onValueChange={(v) => onFiltersChange({ ...filters, status: v })}>
            <SelectTrigger>
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="unhandled">未対応</SelectItem>
              <SelectItem value="in_progress">対応中</SelectItem>
              <SelectItem value="completed">解決済み</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!hidePeriod && (
          <div>
            <label className="text-xs text-gray-500">分析期間</label>
            <Select value={filters.period} onValueChange={(v) => onFiltersChange({ ...filters, period: v })}>
              <SelectTrigger>
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="today">今日</SelectItem>
                <SelectItem value="week">今週</SelectItem>
                <SelectItem value="month">今月</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <label className="text-xs text-gray-500">顧客</label>
          <Input 
            value={filters.customer} 
            onChange={(e) => onFiltersChange({ ...filters, customer: e.target.value })} 
            placeholder="顧客名" 
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">検索</label>
          <Input 
            value={filters.search} 
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })} 
            placeholder="件名・キーワード" 
          />
        </div>
      </div>

      {/* Active Filters */}
      {tokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">フィルター:</span>
          {tokens.map((token, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {token}
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={handleClear}>
            クリア
          </Button>
        </div>
      )}
    </div>
  );
} 