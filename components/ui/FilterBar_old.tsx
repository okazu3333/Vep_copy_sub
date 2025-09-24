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
  value: AlertsFilters;
  onChange: (_filters: AlertsFilters) => void;
  storageKey: string;
  hidePeriod?: boolean;
}

export function FilterBar({ value, onChange, storageKey, hidePeriod = false }: FilterBarProps) {
  const { views, save, remove } = useSavedViews<AlertsFilters>(storageKey);
  const [isSaveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState('');

  const tokens = useMemo(() => {
    const t: string[] = [];
    if (value.department !== 'all') t.push(`部門:${value.department}`);
    if (value.severity !== 'all') t.push(`レベル:${value.severity}`);
    if (value.status !== 'all') t.push(`状態:${value.status}`);
    if (value.period !== 'all') t.push(`期間:${value.period}`);
    if (value.customer) t.push(`顧客:${value.customer}`);
    if (value.search) t.push(`検索:${value.search}`);
    return t;
  }, [value]);

  const handleClear = () => {
    onChange({ department: 'all', customer: '', severity: 'all', period: 'all', status: 'all', search: '' });
  };

  const handleSave = () => {
    if (!viewName.trim()) return;
    save(viewName.trim(), value);
    setViewName('');
    setSaveOpen(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div>
          <label className="text-xs text-gray-500">事業部門</label>
          <Select value={value.department} onValueChange={(v) => onChange({ ...value, department: v })}>
            <SelectTrigger>
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="カスタマーサポート">カスタマーサポート</SelectItem>
              <SelectItem value="営業部">営業部</SelectItem>
              <SelectItem value="開発部">開発部</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500">リスクレベル</label>
          <Select value={value.severity} onValueChange={(v) => onChange({ ...value, severity: v })}>
            <SelectTrigger>
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500">対応ステータス</label>
          <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v })}>
            <SelectTrigger>
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="unhandled">要対応</SelectItem>
              <SelectItem value="in_progress">対応中</SelectItem>
              <SelectItem value="completed">解決済み</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!hidePeriod && (
          <div>
            <label className="text-xs text-gray-500">分析期間</label>
            <Select value={value.period} onValueChange={(v) => onChange({ ...value, period: v })}>
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
          <Input value={value.customer} onChange={(e) => onChange({ ...value, customer: e.target.value })} placeholder="顧客名" />
        </div>
        <div>
          <label className="text-xs text-gray-500">検索</label>
          <Input value={value.search} onChange={(e) => onChange({ ...value, search: e.target.value })} placeholder="件名・キーワード" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {tokens.length === 0 ? (
            <span className="text-xs text-gray-400">フィルタは未設定です</span>
          ) : (
            tokens.map((t, i) => (
              <Badge key={i} variant="secondary" className="bg-gray-100 text-gray-700">
                {t}
              </Badge>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isSaveOpen} onOpenChange={setSaveOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Save className="h-4 w-4 mr-1" /> 保存
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ビューを保存</DialogTitle>
              </DialogHeader>
              <Input placeholder="名前" value={viewName} onChange={(e) => setViewName(e.target.value)} />
              <DialogFooter>
                <Button onClick={handleSave}>保存</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="ghost" onClick={handleClear}>クリア</Button>
        </div>
      </div>

      {views.length > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t">
          <Bookmark className="h-4 w-4 text-gray-400" />
          <div className="flex flex-wrap gap-2">
            {views.map(v => (
              <div key={v.name} className="flex items-center gap-1">
                <Button size="sm" variant="secondary" onClick={() => onChange(v.data)}>
                  {v.name}
                </Button>
                <button className="text-gray-400 hover:text-red-600" onClick={() => remove(v.name)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 
