import { useMemo } from "react";

export interface LevelReading {
  /** epoch ms */
  time: number;
  levelCm: number;
}

export interface ConsumptionBucket {
  label: string;
  cm: number;
}

interface Options {
  maxHeightCm: number;
  /** How readings are grouped for the recent chart, default 1 hour */
  bucketMs?: number;
  /** How many buckets to keep for the recent chart, default 12 */
  bucketCount?: number;
}

export interface WaterConsumptionResult {
  /** Height used since local midnight today, in cm */
  todayUsedCm: number;
  /** Height used in the last 7 days, in cm */
  last7DaysUsedCm: number;
  /** Average height used per day, in cm */
  avgDailyUsedCm: number;
  /** Consumption grouped into recent buckets (e.g. hourly), oldest first */
  recent: ConsumptionBucket[];
  /** Consumption grouped by calendar day, oldest first, up to 7 days */
  daily: ConsumptionBucket[];
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
  { maxHeightCm, bucketMs = 60 * 60 * 1000, bucketCount = 12 }: Options
): WaterConsumptionResult {
  return useMemo(() => {
    const sorted = [...readings].sort((a, b) => a.time - b.time);

    // consumption deltas: only count drops, ignore refills
    const deltas: { time: number; cm: number }[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prevLevel = Math.max(0, Math.min(maxHeightCm, sorted[i - 1].levelCm));
      const currLevel = Math.max(0, Math.min(maxHeightCm, sorted[i].levelCm));
      const used = prevLevel - currLevel;
      if (used > 0) {
        deltas.push({ time: sorted[i].time, cm: used });
      }
    }

    const now = Date.now();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const todayUsedCm = deltas
      .filter((d) => d.time >= midnight.getTime())
      .reduce((a, d) => a + d.cm, 0);

    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const last7 = deltas.filter((d) => d.time >= sevenDaysAgo);
    const last7DaysUsedCm = last7.reduce((a, d) => a + d.cm, 0);

    const daysWithData = new Set(last7.map((d) => dayKey(d.time))).size || 1;
    const avgDailyUsedCm = last7DaysUsedCm / daysWithData;

    // recent buckets (e.g. hourly) for a short-term trend chart
    const bucketStart = midnight.getTime();
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const start = bucketStart + i * bucketMs;
      return { start, end: start + bucketMs, cm: 0 };
    });
    for (const d of deltas) {
      const b = buckets.find((bk) => d.time >= bk.start && d.time < bk.end);
      if (b) b.cm += d.cm;
    }
    const recent: ConsumptionBucket[] = buckets.map((b) => ({
      label: new Date(b.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      cm: Math.round(b.cm * 10) / 10,
    }));

    // daily buckets, last 7 calendar days, oldest first
    const dayMap = new Map<string, { time: number; cm: number }>();
    for (const d of last7) {
      const key = dayKey(d.time);
      const entry = dayMap.get(key) ?? { time: d.time, cm: 0 };
      entry.cm += d.cm;
      dayMap.set(key, entry);
    }
    const daily: ConsumptionBucket[] = Array.from({ length: 7 }, (_, i) => {
      const t = now - (6 - i) * 24 * 60 * 60 * 1000;
      const key = dayKey(t);
      const entry = dayMap.get(key);
      return { label: dayLabel(t), cm: Math.round((entry?.cm ?? 0) * 10) / 10 };
    });

    return { todayUsedCm, last7DaysUsedCm, avgDailyUsedCm, recent, daily };
  }, [readings, maxHeightCm, bucketMs, bucketCount]);
}