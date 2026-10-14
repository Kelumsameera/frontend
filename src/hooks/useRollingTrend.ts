"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/config";
import type { HistoryRow } from "@/types";

export interface TrendPoint { time: number; [series: string]: number | null; }

export function useRollingTrend(endpoint: string, minutes: number) {
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [end, setEnd] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const bucket = Math.max(15, minutes * 60 / 120) * 1000;

  const add = useCallback((device: string, value: number) => {
    const now = Date.now();
    const time = Math.floor(now / bucket) * bucket;
    setEnd(now);
    setPoints((previous) => {
      const map = new Map(previous.filter((p) => p.time >= now - minutes * 60000).map((p) => [p.time, p]));
      map.set(time, { ...map.get(time), time, [device]: value });
      return [...map.values()].sort((a, b) => a.time - b.time);
    });
  }, [bucket, minutes]);

  useEffect(() => {
    let cancelled = false;
    setPoints([]);
    setLoading(true);
    setError(false);
    async function load() {
      try {
        const response = await fetch(`${API_URL}/${endpoint}?minutes=${minutes}`);
        if (!response.ok) throw new Error("Trend request failed");
        const rows: HistoryRow[] = await response.json();
        if (cancelled) return;
        const now = Date.now();
        const map = new Map<number, TrendPoint>();
        for (const row of rows) {
          const timestamp = Date.parse(row.time.replace(" ", "T") + "+05:30");
          if (!Number.isFinite(timestamp)) continue;
          const time = Math.floor(timestamp / bucket) * bucket;
          map.set(time, { ...map.get(time), time, [row.device]: Number(row.value) });
        }
        setPoints((live) => {
          for (const point of live) {
            if (point.time >= now - minutes * 60000) map.set(point.time, { ...map.get(point.time), ...point });
          }
          return [...map.values()].sort((a, b) => a.time - b.time);
        });
        setEnd(now);
        setError(false);
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    const timer = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [endpoint, minutes, bucket]);

  return { points, end, add, loading, error };
}
