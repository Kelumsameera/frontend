"use client";

import { useCallback, useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from "recharts";
import SimpleTank from "@/components/SimpleTank";
import ConnectionStatus from "@/components/ConnectionStatus";
import { Card, PageHeader, SectionLabel, StatusPill, tankPercentStatus, LiveClock } from "@/components/ui";
import { useSocket } from "@/hooks/useSocket";
import type { WaterConsumptionResult } from "@/hooks/useWaterConsumption";
import { fetchWaterHistory, fetchRealtimeWater, fetchWaterTrend, fetchWaterConsumption } from "@/lib/api";
import type { DualTankState, WaterTankUpdate, HistoryRow } from "@/types";
import { FY600_DEVICES, DEVICE_LABELS } from "@/types";

const TREND_RANGES = [{ minutes: 30, label: "30 minutes" }, { minutes: 60, label: "1 hour" }, { minutes: 360, label: "6 hours" }, { minutes: 1440, label: "24 hours" }];


/**
 * Full-tank volume in liters, keyed by device id — used only to turn a
 * level (cm) into a volume (L) for the consumption cards/charts below.
 * FY600_DEVICES (in @/types) only carries maxHeightCm, so capacity lives
 * here; move it there if you'd rather keep tank config in one place.
 */
const CAPACITY_LITERS: Record<string, number> = {
  main_tank: 10000, // Two connected 5,000 L tanks sharing the measured level.
  pump_house_tank: 3000,
};

const SERIES_COLOR: Record<string, string> = {
  main_tank: "#1768D1",
  pump_house_tank: "#1AA6C9",
};

function litersFromCm(cm: number, maxHeightCm: number, capacityLiters: number) {
  if (!maxHeightCm || !capacityLiters) return 0;
  return (cm / maxHeightCm) * capacityLiters;
}

interface WaterChartPoint {
  time: number;
  pump_house_tank: number | null;
  main_tank: number | null;
}

function percentFromLevel(levelCm: number, maxHeightCm: number) {
  return Math.max(0, Math.min(100, (levelCm / maxHeightCm) * 100));
}

/** "YYYY-MM-DD HH:mm:ss" in local time, matching the format used by the waterdb page's queries. */
function toApiDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function WaterPage() {
  const [tanks, setTanks] = useState<DualTankState>({});
  const [waterHistory, setWaterHistory] = useState<WaterChartPoint[]>([]);
  const [trendMinutes, setTrendMinutes] = useState(60);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [trendEnd, setTrendEnd] = useState(Date.now());
  const bucketMs = Math.max(15, trendMinutes * 60 / 120) * 1000;
  const [consumptionByDevice, setConsumptionByDevice] = useState<Record<string, WaterConsumptionResult>>({});
  const [consumptionError, setConsumptionError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  const onWaterTankUpdate = useCallback((data: WaterTankUpdate) => {
    const deviceId = data.device || "fy600";
    const level = Number(data.level) || 0;

    setTanks((prev) => ({
      ...prev,
      [deviceId]: {
        level,
        setpoint: Number(data.setpoint) || 0,
        output: Number(data.output) || 0,
        status: (data.status as "ONLINE" | "OFFLINE" | "ERROR" | "STALE") || "ONLINE",
        lastUpdate: data.time || new Date().toLocaleTimeString(),
      },
    }));

    if ((!data.status || data.status === "ONLINE") && (deviceId === "main_tank" || deviceId === "pump_house_tank")) {
      const now = Date.now();
      const time = Math.floor(now / bucketMs) * bucketMs;
      setTrendEnd(now);
      setWaterHistory((prev) => {
        const points = prev.filter((p) => p.time >= now - trendMinutes * 60000);
        const index = points.findIndex((p) => p.time === time);
        const point = index >= 0 ? points[index] : { time, main_tank: null, pump_house_tank: null };
        const updated = { ...point, [deviceId]: level };
        if (index >= 0) points[index] = updated;
        else points.push(updated);
        return points.sort((a, b) => a.time - b.time);
      });
    }

  }, [bucketMs, trendMinutes]);

  const { status } = useSocket({ onWaterTankUpdate });

  useEffect(() => {
    let cancelled = false;
    setTrendLoading(true);
    setTrendError(null);
    setWaterHistory([]);
    async function loadTrend() {
      try {
        const rows = await fetchWaterTrend(trendMinutes);
        if (cancelled) return;
        const now = Date.now();
        const points = new Map<number, WaterChartPoint>();
        for (const row of rows) {
          const parsed = Date.parse(row.time.replace(" ", "T") + "+05:30");
          if (!Number.isFinite(parsed) || (row.device !== "main_tank" && row.device !== "pump_house_tank")) continue;
          const time = Math.floor(parsed / bucketMs) * bucketMs;
          const point = points.get(time) ?? { time, main_tank: null, pump_house_tank: null };
          point[row.device] = Number(row.value);
          points.set(time, point);
        }
        setWaterHistory((live) => {
          for (const point of live) {
            if (point.time < now - trendMinutes * 60000) continue;
            const historical = points.get(point.time);
            points.set(point.time, {
              time: point.time,
              main_tank: point.main_tank ?? historical?.main_tank ?? null,
              pump_house_tank: point.pump_house_tank ?? historical?.pump_house_tank ?? null,
            });
          }
          return [...points.values()].sort((a, b) => a.time - b.time);
        });
        setTrendEnd(now);
        setTrendError(null);
      } catch {
        if (!cancelled) setTrendError("History unavailable; showing received live readings.");
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    }
    loadTrend();
    const timer = setInterval(loadTrend, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [trendMinutes, bucketMs]);

  // Aggregate complete database history; do not truncate raw samples in the browser.
  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        const values = await Promise.all(FY600_DEVICES.map((d) => fetchWaterConsumption(d.id, d.maxHeightCm)));
        if (!cancelled) {
          setConsumptionByDevice(Object.fromEntries(FY600_DEVICES.map((d, i) => [d.id, values[i]])));
          setConsumptionError(null);
        }
      } catch {
        if (!cancelled) setConsumptionError("Consumption history unavailable. Previously loaded totals may be out of date.");
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    async function loadRealtime() {
      for (const device of FY600_DEVICES) {
        try {
          const data = (await fetchRealtimeWater(device.id)) as unknown as Partial<WaterTankUpdate>;
          if (cancelled || data?.level == null) continue;
          setTanks((prev) => ({
            ...prev,
            [device.id]: {
              level: Number(data.level) || 0,
              setpoint: Number(data.setpoint) || 0,
              output: Number(data.output) || 0,
              status: (data.status as "ONLINE" | "OFFLINE" | "ERROR" | "STALE") || "STALE",
              lastUpdate: data.time || new Date().toLocaleTimeString(),
            },
          }));
        } catch {
          // best-effort only; the socket will catch up shortly
        }
      }
    }

    loadHistory();
    loadRealtime();
    const refresh = setInterval(loadHistory, 60000);
    return () => {
      clearInterval(refresh);
      cancelled = true;
    };
  }, []);

  const todayLiters = FY600_DEVICES.reduce((a, d) => {
    const value = consumptionByDevice[d.id];
    return a + litersFromCm((value?.todayUsedCm ?? 0), d.maxHeightCm, CAPACITY_LITERS[d.id] ?? 0);
  }, 0);
  const last7DaysLiters = FY600_DEVICES.reduce((a, d) => {
    const value = consumptionByDevice[d.id];
    return a + litersFromCm((value?.last7DaysUsedCm ?? 0), d.maxHeightCm, CAPACITY_LITERS[d.id] ?? 0);
  }, 0);
  const avgDailyLiters = FY600_DEVICES.reduce((a, d) => {
    const value = consumptionByDevice[d.id];
    return a + litersFromCm((value?.avgDailyUsedCm ?? 0), d.maxHeightCm, CAPACITY_LITERS[d.id] ?? 0);
  }, 0);

  const firstDevice = FY600_DEVICES[0].id;
  const recentChart = (consumptionByDevice[firstDevice]?.recent ?? []).map((point, i) => {
    const row: Record<string, string | number> = { label: point.label };
    FY600_DEVICES.forEach((d) => {
      const value = consumptionByDevice[d.id]?.recent[i];
      row[d.id] = litersFromCm(value?.cm ?? 0, d.maxHeightCm, CAPACITY_LITERS[d.id] ?? 0);
    });
    return row;
  });

  // ── DB History chart state ───────────────────────────────
  const getToday = () => toApiDateTime(new Date()).split(" ")[0];
  const [historyStartDate, setHistoryStartDate] = useState(getToday());
  const [historyStartTime, setHistoryStartTime] = useState("00:00");
  const [historyEndDate, setHistoryEndDate] = useState(getToday());
  const [historyEndTime, setHistoryEndTime] = useState("23:59");
  const [historyDevice, setHistoryDevice] = useState("ALL");
  const [dbHistoryLoading, setDbHistoryLoading] = useState(false);
  const [dbHistoryError, setDbHistoryError] = useState<string | null>(null);
  const [dbHistoryRows, setDbHistoryRows] = useState<HistoryRow[]>([]);

  /** Pivot DB rows into chart-ready data: one object per unique timestamp, with a key per device */
  interface DbChartPoint {
    time: string;
    [device: string]: string | number;
  }
  const dbHistoryData: DbChartPoint[] = (() => {
    if (!dbHistoryRows.length) return [];
    const map = new Map<string, DbChartPoint>();
    for (const row of dbHistoryRows) {
      const t = new Date(row.time).toLocaleString();
      if (!map.has(t)) map.set(t, { time: t });
      const point = map.get(t)!;
      point[row.device] = Number(row.value) || 0;
    }
    return Array.from(map.values());
  })();
  const dbHistoryDeviceKeys = [...new Set(dbHistoryRows.map((r) => r.device))];

  const loadDbHistory = async () => {
    setDbHistoryLoading(true);
    setDbHistoryError(null);
    try {
      const start = `${historyStartDate} ${historyStartTime}:00`;
      const end = `${historyEndDate} ${historyEndTime}:00`;
      const device = historyDevice !== "ALL" ? historyDevice : undefined;
      const data = await fetchWaterHistory(start, end, device);
      setDbHistoryRows(data.slice(-5000));
      if (data.length === 0) setDbHistoryError("No data found for the selected range");
    } catch {
      setDbHistoryError("Failed to fetch data — check API connection");
      setDbHistoryRows([]);
    }
    setDbHistoryLoading(false);
  };

  return (
    <div className="px-4 py-6 lg:px-10 lg:py-10 max-w-6xl mx-auto">
      <PageHeader
        title="Water"
        subtitle="Real-time levels, trend and usage · main tank & pump house tank"
        right={
          <div className="flex items-center gap-4">
            <ConnectionStatus status={status} />
            <LiveClock />
          </div>
        }
      />

      {/* Tanks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {FY600_DEVICES.map((device) => {
          const tankData = tanks[device.id];
          const percent = percentFromLevel(tankData?.level ?? 0, device.maxHeightCm);
          return (
            <Card key={device.id} className="p-6 flex flex-col items-center relative">
              <div className="absolute top-5 right-5">
                {tankData?.status && tankData.status !== "ONLINE" ? <span className="text-xs font-semibold text-amber-700">{tankData.status} · last known level</span> : <StatusPill status={tankPercentStatus(percent)} />}
              </div>
              <SimpleTank levelCm={tankData?.level ?? 0} setpoint={tankData?.setpoint ?? 0} output={tankData?.output ?? 0} label={device.label} maxHeightCm={device.maxHeightCm} />
              <p className="mt-3 text-xs text-(--text-faint) font-mono-data">
                ≈ {Math.round((percent / 100) * (CAPACITY_LITERS[device.id] ?? 0))} L / {CAPACITY_LITERS[device.id] ?? 0} L
              </p>
            </Card>
          );
        })}
      </div>

      {/* Live trend chart */}
      <div className="mb-10">
        <SectionLabel title="Water Level Trend" subtitle={`${TREND_RANGES.find((r) => r.minutes === trendMinutes)?.label} · historical averages with live updates`} />
        <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Water trend time range">
          {TREND_RANGES.map((range) => (
            <button key={range.minutes} aria-pressed={trendMinutes === range.minutes} onClick={() => setTrendMinutes(range.minutes)}
              className="px-3 py-2 rounded-lg border text-sm" style={{ background: trendMinutes === range.minutes ? "var(--primary)" : "var(--panel)", color: trendMinutes === range.minutes ? "white" : "var(--text)" }}>
              {range.label}
            </button>
          ))}
        </div>
        <Card className="p-4 lg:p-6">
          {trendLoading && <p role="status" className="text-sm mb-2">Loading trend history…</p>}
          {trendError && <p role="alert" className="text-sm mb-2">{trendError}</p>}
          {!trendLoading && !waterHistory.length && <p className="text-sm mb-2">No readings in this time range.</p>}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={waterHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F2" opacity={0.8} vertical={false} />
              <XAxis dataKey="time" type="number" scale="time" domain={[trendEnd - trendMinutes * 60000, trendEnd]} tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} tick={{ fontSize: 11, fill: "#5C7290" }} axisLine={{ stroke: "#DCE6F2" }} tickLine={false} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "#5C7290" }}
                axisLine={false}
                tickLine={false}
                label={{ value: "cm", angle: -90, position: "insideLeft", style: { fill: "#5C7290", fontSize: 12 } }}
              />
              <Tooltip labelFormatter={(time) => new Date(Number(time)).toLocaleString()} contentStyle={{ borderRadius: 10, border: "1px solid #DCE6F2" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="main_tank" name="Main Tank" stroke="#1768D1" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="pump_house_tank" name="Pump House Tank" stroke="#1AA6C9" strokeWidth={2.5} dot={false} isAnimationActive={false} />

            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Consumption KPI cards */}
      <div className="mb-4">
        <SectionLabel title="Water Consumption" subtitle="Estimated from stored level drops · both tanks · refreshes every minute" />
        {consumptionError && <p role="alert" className="text-sm mb-3">{consumptionError}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="text-sm text-(--text-muted)">Used today</p>
            <p className="mt-2 font-mono-data text-3xl font-bold text-(--text)">
              {historyLoading ? "…" : Object.keys(consumptionByDevice).length === 0 ? "—" : Math.round(todayLiters)}
              <span className="ml-1 text-sm font-normal text-(--text-muted)">L</span>
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-(--text-muted)">Last 7 days</p>
            <p className="mt-2 font-mono-data text-3xl font-bold text-(--text)">
              {historyLoading ? "…" : Object.keys(consumptionByDevice).length === 0 ? "—" : Math.round(last7DaysLiters)}
              <span className="ml-1 text-sm font-normal text-(--text-muted)">L</span>
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-(--text-muted)">Average / day</p>
            <p className="mt-2 font-mono-data text-3xl font-bold text-(--text)">
              {historyLoading ? "…" : Object.keys(consumptionByDevice).length === 0 ? "—" : Math.round(avgDailyLiters)}
              <span className="ml-1 text-sm font-normal text-(--text-muted)">L</span>
            </p>
          </Card>
        </div>
      </div>

      {/* Recent (hourly) consumption */}
      <Card className="p-4 lg:p-6 mb-10">
        <SectionLabel title="Recent consumption" subtitle="Estimated liters used per hour · last 12 hours" />
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={recentChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F2" opacity={0.8} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5C7290" }} axisLine={{ stroke: "#DCE6F2" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#5C7290" }} axisLine={false} tickLine={false} label={{ value: "L", angle: -90, position: "insideLeft", style: { fill: "#5C7290", fontSize: 12 } }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #DCE6F2" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {FY600_DEVICES.map((d) => (
              <Bar key={d.id} dataKey={d.id} name={d.label} fill={SERIES_COLOR[d.id] ?? "#1768D1"} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Water History — fetch from database by date range */}
      <div>
        <SectionLabel title="Water History" subtitle="Database records — filter by date and tank" />
        <Card className="p-4 lg:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <input
              type="date"
              value={historyStartDate}
              onChange={(e) => setHistoryStartDate(e.target.value)}
              className="border border-(--border) px-3 py-2 rounded-lg text-sm bg-(--panel) text-(--text)"
            />
            <input
              type="time"
              value={historyStartTime}
              onChange={(e) => setHistoryStartTime(e.target.value)}
              className="border border-(--border) px-3 py-2 rounded-lg text-sm bg-(--panel) text-(--text)"
            />
            <input
              type="date"
              value={historyEndDate}
              onChange={(e) => setHistoryEndDate(e.target.value)}
              className="border border-(--border) px-3 py-2 rounded-lg text-sm bg-(--panel) text-(--text)"
            />
            <input
              type="time"
              value={historyEndTime}
              onChange={(e) => setHistoryEndTime(e.target.value)}
              className="border border-(--border) px-3 py-2 rounded-lg text-sm bg-(--panel) text-(--text)"
            />
            <select value={historyDevice} onChange={(e) => setHistoryDevice(e.target.value)} className="border border-(--border) px-3 py-2 rounded-lg text-sm bg-(--panel) text-(--text)">
              <option value="ALL">All Tanks</option>
              {FY600_DEVICES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={loadDbHistory}
            disabled={dbHistoryLoading}
            className="mb-4 px-5 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ background: dbHistoryLoading ? "#94a3b8" : "var(--primary)" }}
          >
            {dbHistoryLoading ? "⏳ Loading…" : "Load History"}
          </button>

          {dbHistoryError && (
            <p className="text-sm mb-3" style={{ color: "var(--critical)" }}>
              {dbHistoryError}
            </p>
          )}

          {dbHistoryData.length > 0 ? (
            <>
              <p className="text-xs mb-2 text-(--text-faint)">{dbHistoryData.length} data points</p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={dbHistoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F2" opacity={0.8} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#5C7290" }} axisLine={{ stroke: "#DCE6F2" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#5C7290" }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: "cm", angle: -90, position: "insideLeft", style: { fill: "#5C7290", fontSize: 12 } }}
                  />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #DCE6F2" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {dbHistoryDeviceKeys.map((key) => (
                    <Line key={key} type="monotone" dataKey={key} name={DEVICE_LABELS[key] || key} stroke={SERIES_COLOR[key] ?? "#1768D1"} strokeWidth={2} dot={false} isAnimationActive={false} />
                  ))}
                  <Brush dataKey="time" height={28} stroke="#1768D1" fill="#E4F0FD" />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            !dbHistoryLoading && <p className="text-sm text-(--text-faint) text-center py-8">Select a date range and click &quot;Load History&quot; to view data</p>
          )}
        </Card>
      </div>
    </div>
  );
}
