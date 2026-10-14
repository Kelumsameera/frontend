"use client";

import { useCallback, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FaTriangleExclamation } from "react-icons/fa6";

import RoundTank from "@/components/SimpleTank";
import PressureGauge from "@/components/PressureGauge";
import StatCard from "@/components/StatCard";
import ConnectionStatus from "@/components/ConnectionStatus";
import { Card, PageHeader, SectionLabel, StatusPill, pressureStatus, tankPercentStatus, statusLabel, LiveClock } from "@/components/ui";
import { useRollingTrend } from "@/hooks/useRollingTrend";
import { useSocket } from "@/hooks/useSocket";
import type { PressureState, DualTankState, ModbusUpdate, WaterTankUpdate } from "@/types";
import { FY600_DEVICES } from "@/types";

function percentFromLevel(levelCm: number, maxHeightCm: number) {
  return Math.max(0, Math.min(100, (levelCm / maxHeightCm) * 100));
}

export default function DashboardPage() {
  const [pressure, setPressure] = useState<PressureState>({
    production_clean_room: 0,
    assembly_clean_room: 0,
  });

  const [tanks, setTanks] = useState<DualTankState>({});

  const [trendMinutes, setTrendMinutes] = useState(60);
  const pressureTrend = useRollingTrend("pressure/trend", trendMinutes);
  const waterTrend = useRollingTrend("water-tank/trend", trendMinutes);

  const onModbusUpdate = useCallback((data: ModbusUpdate) => {
    const value = Number(data.value) || 0;

    setPressure((prev) => ({
      ...prev,
      [data.device]: value,
    }));

    pressureTrend.add(data.device, value);
  }, [pressureTrend.add]);

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

    if (!data.status || data.status === "ONLINE") waterTrend.add(deviceId, level);
  }, [waterTrend.add]);

  const { status } = useSocket({
    onModbusUpdate,
    onWaterTankUpdate,
  });

  const mainPercent = percentFromLevel(tanks["main_tank"]?.level ?? 0, 162);
  const pumpPercent = percentFromLevel(tanks["pump_house_tank"]?.level ?? 0, 250);

  const alarms = [
    { label: "Production Clean Room", status: pressureStatus(pressure.production_clean_room) },
    { label: "Assembly Clean Room", status: pressureStatus(pressure.assembly_clean_room) },
    { label: "Main Tank", status: tankPercentStatus(mainPercent) },
    { label: "Pump House Tank", status: tankPercentStatus(pumpPercent) },
  ].filter((a) => a.status !== "normal");

  return (
    <div className="dashboard-overview px-4 py-6 lg:px-4 lg:py-3 space-y-5 lg:space-y-3 max-w-7xl mx-auto">
      <PageHeader
        title="Live Dashboard"
        subtitle="Pressure & Water Tanks · Flexicare Lanka"
        right={
          <div className="flex items-center gap-4">
            <ConnectionStatus status={status} />
            <LiveClock />
          </div>
        }
      />

      {alarms.length > 0 && (
        <Card className="p-4 flex items-center gap-3" style={{ background: "var(--warning-soft)", borderColor: "#B9790C55" }}>
          <FaTriangleExclamation color="var(--warning)" size={16} />
          <span className="text-sm text-(--text)">{alarms.map((a) => `${a.label} — ${statusLabel(a.status)}`).join(" · ")}</span>
        </Card>
      )}

      {/* Stat cards */}
      <div className="dashboard-stats grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Production Pressure" value={pressure.production_clean_room} unit="Pa" />
        <StatCard title="Assembly Pressure" value={pressure.assembly_clean_room} unit="Pa" />
        {FY600_DEVICES.map((device) => (
          <StatCard key={device.id} title={device.label} value={tanks[device.id]?.level ?? 0} unit="cm" />
        ))}
      </div>

      <div className="dashboard-instruments grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Pressure Gauges */}
      <div>
        <SectionLabel title="Cleanroom Differential Pressure" subtitle="Production & Assembly floors" />
        <div className="grid grid-cols-2 gap-3">
          <Card className="dashboard-instrument-card p-3 flex flex-col items-center gap-1">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-(--text)">Production Clean Room</span>
              <StatusPill status={pressureStatus(pressure.production_clean_room)} />
            </div>
            <PressureGauge value={pressure.production_clean_room} />
          </Card>
          <Card className="dashboard-instrument-card p-3 flex flex-col items-center gap-1">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-(--text)">Assembly Clean Room</span>
              <StatusPill status={pressureStatus(pressure.assembly_clean_room)} />
            </div>
            <PressureGauge value={pressure.assembly_clean_room} />
          </Card>
        </div>
      </div>

      {/* Water Tanks */}
      <div>
        <SectionLabel title="Water Tank Levels" subtitle="Main tank & pump house tank" />
        <div className="grid grid-cols-2 gap-3">
          {FY600_DEVICES.map((device) => {
            const tankData = tanks[device.id];
            const percent = percentFromLevel(tankData?.level ?? 0, device.maxHeightCm);
            return (
              <Card key={device.id} className="dashboard-instrument-card dashboard-tank-card p-3 flex flex-col items-center gap-1 relative">
                <div className="absolute top-2 right-2">
                  <StatusPill status={tankPercentStatus(percent)} />
                </div>
                <RoundTank levelCm={tankData?.level ?? 0} setpoint={tankData?.setpoint ?? 0} output={tankData?.output ?? 0} label={device.label} maxHeightCm={device.maxHeightCm} />
              </Card>
            );
          })}
        </div>
      </div>

      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Dashboard trend time range">
        {[{ minutes: 30, label: "30 minutes" }, { minutes: 60, label: "1 hour" }, { minutes: 360, label: "6 hours" }, { minutes: 1440, label: "24 hours" }].map((range) => (
          <button key={range.minutes} aria-pressed={trendMinutes === range.minutes} onClick={() => setTrendMinutes(range.minutes)} className="px-3 py-1 rounded-lg border text-xs" style={{ background: trendMinutes === range.minutes ? "var(--primary)" : "var(--panel)", color: trendMinutes === range.minutes ? "white" : "var(--text)" }}>{range.label}</button>
        ))}
        {(pressureTrend.loading || waterTrend.loading) && <span role="status" className="text-xs">Loading history…</span>}
        {(pressureTrend.error || waterTrend.error) && <span role="alert" className="text-xs">History unavailable; showing live readings.</span>}
      </div>
      <div className="dashboard-trends grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Pressure trend chart */}
      <div>
        <SectionLabel title="Pressure Trend" subtitle="Historical averages with live updates" />
        <Card className="dashboard-chart-card p-2 lg:p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pressureTrend.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F2" opacity={0.8} vertical={false} />
              <XAxis dataKey="time" type="number" scale="time" domain={[pressureTrend.end - trendMinutes * 60000, pressureTrend.end]} tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} tick={{ fontSize: 10, fill: "#5C7290" }} axisLine={{ stroke: "#DCE6F2" }} tickLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#5C7290" }} axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={(time) => new Date(Number(time)).toLocaleString()} contentStyle={{ borderRadius: 10, border: "1px solid #DCE6F2" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="production_clean_room" name="Production" stroke="#1768D1" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="assembly_clean_room" name="Assembly" stroke="#7A63D6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Water level trend chart */}
      {(
        <div>
          <SectionLabel title="Water Level Trend" subtitle="Historical averages with live updates" />
          <Card className="dashboard-chart-card p-2 lg:p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={waterTrend.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F2" opacity={0.8} vertical={false} />
                <XAxis dataKey="time" type="number" scale="time" domain={[waterTrend.end - trendMinutes * 60000, waterTrend.end]} tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} tick={{ fontSize: 10, fill: "#5C7290" }} axisLine={{ stroke: "#DCE6F2" }} tickLine={false} />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11, fill: "#5C7290" }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "cm", angle: -90, position: "insideLeft", style: { fill: "#5C7290", fontSize: 12 } }}
                />
                <Tooltip labelFormatter={(time) => new Date(Number(time)).toLocaleString()} contentStyle={{ borderRadius: 10, border: "1px solid #DCE6F2" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="pump_house_tank" name="Pump House Tank" stroke="#1AA6C9" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="main_tank" name="Main Tank" stroke="#7A63D6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}
