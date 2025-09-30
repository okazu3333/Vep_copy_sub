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
    if (filters.severity !== 'all') {
      const severityLabels: Record<string, string> = {
        'high': '高リスク (スコア80+)',
        'medium': '中リスク (スコア50-79)',
        'low': '低リスク (スコア30-49)',
        'very_low': '極低リスク (スコア30未満)'
      };
      t.push(`重要度:${severityLabels[filters.severity] || filters.severity}`);
    }
    if (filters.status !== 'all') t.push(`状態:${filters.status}`);
    if (!hidePeriod && filters.period !== 'all') t.push(`期間:${filters.period}`);
    if (filters.search) t.push(`検索:${filters.search}`);
    return t;
  }, [filters, hidePeriod]);

  const handleClear = () => {
    onFiltersChange({ 
      severity: 'all', 
      period: 'all', 
      status: 'all', 
      search: '' 
    });
  };

  return (
    <div className="space-y-4">
      {/* Filter Controls - 横一列表示 */}
      <div className="flex flex-wrap items-end gap-4">
        {/* 検索窓を大きくする */}
        <div className="flex-1 min-w-[300px]">
          <label className="text-xs text-gray-500">検索</label>
          <Input 
            value={filters.search} 
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })} 
            placeholder="件名・キーワード・顧客名で検索" 
            className="text-base"
          />
        </div>
        
        <div className="min-w-[180px]">
          <label className="text-xs text-gray-500">重要度</label>
          <Select value={filters.severity} onValueChange={(v) => onFiltersChange({ ...filters, severity: v })}>
            <SelectTrigger>
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="high">高リスク (スコア80+)</SelectItem>
              <SelectItem value="medium">中リスク (スコア50-79)</SelectItem>
              <SelectItem value="low">低リスク (スコア30-49)</SelectItem>
              <SelectItem value="very_low">極低リスク (スコア30未満)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="min-w-[120px]">
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
          <div className="min-w-[120px]">
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
        
        {/* クリアボタン */}
        <div className="flex items-end">
          <Button 
            variant="outline" 
            size="default"
            onClick={handleClear}
            className="h-10"
          >
            クリア
          </Button>
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