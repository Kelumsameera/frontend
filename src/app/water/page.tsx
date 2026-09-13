"use client";

import { useCallback, useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from "recharts";
import SimpleTank from "@/components/SimpleTank";
import ConnectionStatus from "@/components/ConnectionStatus";
import { Card, PageHeader, SectionLabel, StatusPill, tankPercentStatus, LiveClock } from "@/components/ui";
import { useSocket } from "@/hooks/useSocket";
import { useWaterConsumption, type LevelReading } from "@/hooks/useWaterConsumption";
import { fetchWaterHistory, fetchRealtimeWater } from "@/lib/api";
import type { DualTankState, WaterTankUpdate, HistoryRow } from "@/types";
import { FY600_DEVICES } from "@/types";

const MAX_HISTORY = 40; // live trend chart points
const MAX_READINGS = 3000; // raw readings kept per tank for consumption calc
const HISTORY_DAYS = 7;

/**
 * Full-tank volume in liters, keyed by device id — used only to turn a
 * level (cm) into a volume (L) for the consumption cards/charts below.
 * FY600_DEVICES (in @/types) only carries maxHeightCm, so capacity lives
 * here; move it there if you'd rather keep tank config in one place.
 */
const CAPACITY_LITERS: Record<string, number> = {
  main_tank: 5000,
  pump_house_tank: 3000,
};

const SERIES_COLOR: Record<string, string> = {
  main_tank: "#1768D1",
  pump_house_tank: "#1AA6C9",
};

interface WaterChartPoint {
  time: string;
  pump_house_tank: number;
  main_tank: number;
}

function percentFromLevel(levelCm: number, maxHeightCm: number) {
  return Math.max(0, Math.min(100, (levelCm / maxHeightCm) * 100));
}

/** "YYYY-MM-DD HH:mm:ss" in local time, matching the format used by the waterdb page's queries. */
function toApiDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** HistoryRow -> LevelReading. HistoryRow's level is in `value`, not `level`. */
function rowToReading(row: HistoryRow): LevelReading {
  const t = new Date(row.time).getTime();
  return { time: Number.isFinite(t) ? t : Date.now(), levelCm: Number(row.value) || 0 };
}

/** Appends live readings newer than the last historical point, so a socket update that lands mid-fetch doesn't get lost or duplicated. */
function mergeHistoryAndLive(history: LevelReading[], current: LevelReading[]): LevelReading[] {
  if (current.length === 0) return history;
  const lastHistoryTime = history.length ? history[history.length - 1].time : 0;
  const liveOnly = current.filter((r) => r.time > lastHistoryTime);
  return [...history, ...liveOnly].slice(-MAX_READINGS);
}

export default function WaterPage() {
  const [tanks, setTanks] = useState<DualTankState>({});
  const [waterHistory, setWaterHistory] = useState<WaterChartPoint[]>([]);
  const [readings, setReadings] = useState<Record<string, LevelReading[]>>(Object.fromEntries(FY600_DEVICES.map((d) => [d.id, []])));
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

    setWaterHistory((prev) => {
      const last = prev.at(-1);
      const next: WaterChartPoint = {
        time: new Date().toLocaleTimeString(),
        pump_house_tank: deviceId === "pump_house_tank" ? level : (last?.pump_house_tank ?? 0),
        main_tank: deviceId === "main_tank" ? level : (last?.main_tank ?? 0),
      };
      return [...prev.slice(-(MAX_HISTORY - 1)), next];
    });

    setReadings((prev) => ({
      ...prev,
      [deviceId]: [...(prev[deviceId] ?? []).slice(-(MAX_READINGS - 1)), { time: Date.now(), levelCm: level }],
    }));
  }, []);

  const { status } = useSocket({ onWaterTankUpdate });

  // Seed 7 days of DB history (for the consumption stats/charts) and the
  // current level (so tanks don't sit empty while waiting for the first
  // socket push) as soon as the page loads.
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      const end = new Date();
      const start = new Date(end.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

      try {
        const results = await Promise.all(FY600_DEVICES.map((d) => fetchWaterHistory(toApiDateTime(start), toApiDateTime(end), d.id)));
        if (cancelled) return;
        setReadings((prev) => {
          const next = { ...prev };
          FY600_DEVICES.forEach((d, i) => {
            next[d.id] = mergeHistoryAndLive(results[i].map(rowToReading), prev[d.id] ?? []);
          });
          return next;
        });
      } catch (err) {
        console.error("Failed to load water history:", err);
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
    return () => {
      cancelled = true;
    };
  }, []);

  // Consumption per tank, derived from the combined history + live readings.
  // Called explicitly (not inside FY600_DEVICES.map) to respect the rules of hooks.
  const mainCfg = FY600_DEVICES.find((d) => d.id === "main_tank");
  const pumpCfg = FY600_DEVICES.find((d) => d.id === "pump_house_tank");
  const mainConsumption = useWaterConsumption(readings["main_tank"] ?? [], {
    maxHeightCm: mainCfg?.maxHeightCm ?? 250,
    capacityLiters: CAPACITY_LITERS["main_tank"] ?? 1000,
  });
  const pumpConsumption = useWaterConsumption(readings["pump_house_tank"] ?? [], {
    maxHeightCm: pumpCfg?.maxHeightCm ?? 250,
    capacityLiters: CAPACITY_LITERS["pump_house_tank"] ?? 1000,
  });
  const consumptionByDevice: Record<string, ReturnType<typeof useWaterConsumption>> = {
    main_tank: mainConsumption,
    pump_house_tank: pumpConsumption,
  };

  const todayLiters = FY600_DEVICES.reduce((a, d) => a + consumptionByDevice[d.id].todayLiters, 0);
  const last7DaysLiters = FY600_DEVICES.reduce((a, d) => a + consumptionByDevice[d.id].last7DaysLiters, 0);
  const avgDailyLiters = FY600_DEVICES.reduce((a, d) => a + consumptionByDevice[d.id].avgDailyLiters, 0);

  const firstDevice = FY600_DEVICES[0].id;
  const recentChart = consumptionByDevice[firstDevice].recent.map((point, i) => {
    const row: Record<string, string | number> = { label: point.label };
    FY600_DEVICES.forEach((d) => {
      row[d.id] = consumptionByDevice[d.id].recent[i]?.liters ?? 0;
    });
    return row;
  });
  const dailyChart = consumptionByDevice[firstDevice].daily.map((point, i) => {
    const row: Record<string, string | number> = { label: point.label };
    FY600_DEVICES.forEach((d) => {
      row[d.id] = consumptionByDevice[d.id].daily[i]?.liters ?? 0;
    });
    return row;
  });

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
                <StatusPill status={tankPercentStatus(percent)} />
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
        <SectionLabel title="Water Level Trend" subtitle={`Last ${MAX_HISTORY} live readings`} />
        <Card className="p-4 lg:p-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={waterHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F2" opacity={0.8} vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#5C7290" }} axisLine={{ stroke: "#DCE6F2" }} tickLine={false} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "#5C7290" }}
                axisLine={false}
                tickLine={false}
                label={{ value: "cm", angle: -90, position: "insideLeft", style: { fill: "#5C7290", fontSize: 12 } }}
              />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #DCE6F2" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="main_tank" name="Main Tank" stroke="#1768D1" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="pump_house_tank" name="Pump House Tank" stroke="#1AA6C9" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Brush dataKey="time" height={28} stroke="#1768D1" fill="#E4F0FD" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Consumption KPI cards */}
      <div className="mb-4">
        <SectionLabel title="Water Consumption" subtitle="Derived from level drops · both tanks combined" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="text-sm text-(--text-muted)">Used today</p>
            <p className="mt-2 font-mono-data text-3xl font-bold text-(--text)">
              {historyLoading ? "…" : Math.round(todayLiters)}
              <span className="ml-1 text-sm font-normal text-(--text-muted)">L</span>
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-(--text-muted)">Last 7 days</p>
            <p className="mt-2 font-mono-data text-3xl font-bold text-(--text)">
              {historyLoading ? "…" : Math.round(last7DaysLiters)}
              <span className="ml-1 text-sm font-normal text-(--text-muted)">L</span>
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-(--text-muted)">Average / day</p>
            <p className="mt-2 font-mono-data text-3xl font-bold text-(--text)">
              {historyLoading ? "…" : Math.round(avgDailyLiters)}
              <span className="ml-1 text-sm font-normal text-(--text-muted)">L</span>
            </p>
          </Card>
        </div>
      </div>

      {/* Recent (hourly) consumption */}
      <Card className="p-4 lg:p-6 mb-10">
        <SectionLabel title="Recent consumption" subtitle="Liters used per hour, both tanks" />
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

      {/* Daily usage, last 7 days */}
      <div>
        <SectionLabel title="Daily usage" subtitle="Last 7 days, both tanks" />
        <Card className="p-4 lg:p-6">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F2" opacity={0.8} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5C7290" }} axisLine={{ stroke: "#DCE6F2" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#5C7290" }} axisLine={false} tickLine={false} label={{ value: "L", angle: -90, position: "insideLeft", style: { fill: "#5C7290", fontSize: 12 } }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #DCE6F2" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {FY600_DEVICES.map((d) => (
                <Line key={d.id} type="monotone" dataKey={d.id} name={d.label} stroke={SERIES_COLOR[d.id] ?? "#1768D1"} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
