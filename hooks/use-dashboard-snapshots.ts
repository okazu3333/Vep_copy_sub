import { useCallback, useEffect, useState } from 'react';

export interface DashboardSnapshot {
  takenAt: number;
  kpis: {
    criticalAlerts: number;
    negativeRatio: number; // 0-1
    topDepartment: string;
    topDepartmentCount: number;
  };
}

const KEY = 'sg_dashboard_snapshot';

export function useDashboardSnapshot() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSnapshot(JSON.parse(raw));
    } catch {}
  }, []);

  const save = useCallback((s: DashboardSnapshot) => {
    setSnapshot(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }, []);

  const clear = useCallback(() => {
    setSnapshot(null);
    localStorage.removeItem(KEY);
  }, []);

  return { snapshot, save, clear } as const;
} 