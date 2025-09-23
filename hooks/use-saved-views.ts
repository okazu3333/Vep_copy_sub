import { useCallback, useEffect, useMemo, useState } from 'react';

export interface SavedView<T> {
  name: string;
  data: T;
  createdAt: number;
}

const STORAGE_PREFIX = 'sg_saved_views:';

export function useSavedViews<T>(storageKey: string) {
  const key = useMemo(() => `${STORAGE_PREFIX}${storageKey}`, [storageKey]);
  const [views, setViews] = useState<SavedView<T>[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedView<T>[];
        setViews(parsed);
      }
    } catch {
      setViews([]);
    }
  }, [key]);

  const persist = useCallback((next: SavedView<T>[]) => {
    setViews(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, [key]);

  const save = useCallback((name: string, data: T) => {
    const existsIdx = views.findIndex(v => v.name === name);
    const entry: SavedView<T> = { name, data, createdAt: Date.now() };
    if (existsIdx >= 0) {
      const next = [...views];
      next[existsIdx] = entry;
      persist(next);
    } else {
      persist([entry, ...views]);
    }
  }, [views, persist]);

  const remove = useCallback((name: string) => {
    const next = views.filter(v => v.name !== name);
    persist(next);
  }, [views, persist]);

  const clear = useCallback(() => {
    persist([]);
  }, [persist]);

  const get = useCallback((name: string) => {
    return views.find(v => v.name === name);
  }, [views]);

  return { views, save, remove, clear, get } as const;
} 