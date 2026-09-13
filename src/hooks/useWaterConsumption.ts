import { useMemo } from "react";

export interface LevelReading {
  /** epoch ms */
  time: number;
  levelCm: number;
}

export interface ConsumptionBucket {
  label: string;
  liters: number;
}

interface Options {
  maxHeightCm: number;
  /** Full-tank volume in liters — used to turn a level (cm) into a volume (L) */
  capacityLiters: number;
  /** How readings are grouped for the "recent" chart, default 1 hour */
  bucketMs?: number;
  /** How many buckets to keep for the "recent" chart, default 12 */
  bucketCount?: number;
}

export interface WaterConsumptionResult {
  /** Liters used since local midnight today */
  todayLiters: number;
  /** Liters used in the last 7 days */
  last7DaysLiters: number;
  /** Average liters used per day, computed over days that have data */
  avgDailyLiters: number;
  /** Consumption grouped into recent buckets (e.g. hourly), oldest first */
  recent: ConsumptionBucket[];
  /** Consumption grouped by calendar day, oldest first, up to 7 days */
  daily: ConsumptionBucket[];
}

function litersFromLevel(levelCm: number, maxHeightCm: number, capacityLiters: number) {
  const percent = Math.max(0, Math.min(1, levelCm / maxHeightCm));
  return percent * capacityLiters;
}

function dayKey(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(t: number) {
  return new Date(t).toLocaleDateString(undefined, { weekday: "short" });
}

/**
 * Turns a stream of raw level readings into consumption figures.
 *
 * Consumption is inferred from drops in level between consecutive readings
 * (a rising level is treated as a refill and does not count as usage, so
 * refill events don't skew the totals). Feed this hook whatever level
 * history you're already collecting — no separate flow meter needed.
 */
export function useWaterConsumption(
  readings: LevelReading[],
  { maxHeightCm, capacityLiters, bucketMs = 60 * 60 * 1000, bucketCount = 12 }: Options
): WaterConsumptionResult {
  return useMemo(() => {
    const sorted = [...readings].sort((a, b) => a.time - b.time);

    // consumption deltas: only count drops, ignore refills
    const deltas: { time: number; liters: number }[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prevL = litersFromLevel(sorted[i - 1].levelCm, maxHeightCm, capacityLiters);
      const currL = litersFromLevel(sorted[i].levelCm, maxHeightCm, capacityLiters);
      const used = prevL - currL;
      if (used > 0) {
        deltas.push({ time: sorted[i].time, liters: used });
      }
    }

    const now = Date.now();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const todayLiters = deltas
      .filter((d) => d.time >= midnight.getTime())
      .reduce((a, d) => a + d.liters, 0);

    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const last7 = deltas.filter((d) => d.time >= sevenDaysAgo);
    const last7DaysLiters = last7.reduce((a, d) => a + d.liters, 0);

    const daysWithData = new Set(last7.map((d) => dayKey(d.time))).size || 1;
    const avgDailyLiters = last7DaysLiters / daysWithData;

    // recent buckets (e.g. hourly) for a short-term trend chart
    const bucketStart = now - bucketMs * bucketCount;
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const start = bucketStart + i * bucketMs;
      return { start, end: start + bucketMs, liters: 0 };
    });
    for (const d of deltas) {
      const b = buckets.find((bk) => d.time >= bk.start && d.time < bk.end);
      if (b) b.liters += d.liters;
    }
    const recent: ConsumptionBucket[] = buckets.map((b) => ({
      label: new Date(b.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      liters: Math.round(b.liters),
    }));

    // daily buckets, last 7 calendar days, oldest first
    const dayMap = new Map<string, { time: number; liters: number }>();
    for (const d of last7) {
      const key = dayKey(d.time);
      const entry = dayMap.get(key) ?? { time: d.time, liters: 0 };
      entry.liters += d.liters;
      dayMap.set(key, entry);
    }
    const daily: ConsumptionBucket[] = Array.from({ length: 7 }, (_, i) => {
      const t = now - (6 - i) * 24 * 60 * 60 * 1000;
      const key = dayKey(t);
      const entry = dayMap.get(key);
      return { label: dayLabel(t), liters: Math.round(entry?.liters ?? 0) };
    });

    return { todayLiters, last7DaysLiters, avgDailyLiters, recent, daily };
  }, [readings, maxHeightCm, capacityLiters, bucketMs, bucketCount]);
}