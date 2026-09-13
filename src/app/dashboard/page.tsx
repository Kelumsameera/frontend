"use client";

import { useCallback, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from "recharts";
import { FaTriangleExclamation } from "react-icons/fa6";

import RoundTank from "@/components/SimpleTank";
import PressureGauge from "@/components/PressureGauge";
import StatCard from "@/components/StatCard";
import ConnectionStatus from "@/components/ConnectionStatus";
import { Card, PageHeader, SectionLabel, StatusPill, pressureStatus, tankPercentStatus, statusLabel, LiveClock } from "@/components/ui";
import { useSocket } from "@/hooks/useSocket";
import type { PressureState, DualTankState, ChartPoint, ModbusUpdate, WaterTankUpdate } from "@/types";
import { FY600_DEVICES } from "@/types";

const MAX_HISTORY = 40;

interface WaterChartPoint {
  time: string;
  pump_house_tank: number;
  main_tank: number;
}

function percentFromLevel(levelCm: number, maxHeightCm: number) {
  return Math.max(0, Math.min(100, (levelCm / maxHeightCm) * 100));
}

export default function DashboardPage() {
  const [pressure, setPressure] = useState<PressureState>({
    production_clean_room: 0,
    assembly_clean_room: 0,
  });

  const [tanks, setTanks] = useState<DualTankState>({});

  const [history, setHistory] = useState<ChartPoint[]>([]);
  const [waterHistory, setWaterHistory] = useState<WaterChartPoint[]>([]);

  const onModbusUpdate = useCallback((data: ModbusUpdate) => {
    const value = Number(data.value) || 0;

    setPressure((prev) => ({
      ...prev,
      [data.device]: value,
    }));

    setHistory((prev) => {
      const last = prev.at(-1);
      const next: ChartPoint = {
        time: new Date().toLocaleTimeString(),
        production: data.device === "production_clean_room" ? value : (last?.production ?? 0),
        assembly: data.device === "assembly_clean_room" ? value : (last?.assembly ?? 0),
      };
      return [...prev.slice(-(MAX_HISTORY - 1)), next];
    });
  }, []);

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
  }, []);

  const { status } = useSocket({
    onModbusUpdate,
    onWaterTankUpdate,
  });

  const mainPercent = percentFromLevel(tanks["main_tank"]?.level ?? 0, 250);
  const pumpPercent = percentFromLevel(tanks["pump_house_tank"]?.level ?? 0, 250);

  const alarms = [
    { label: "Production Clean Room", status: pressureStatus(pressure.production_clean_room) },
    { label: "Assembly Clean Room", status: pressureStatus(pressure.assembly_clean_room) },
    { label: "Main Tank", status: tankPercentStatus(mainPercent) },
    { label: "Pump House Tank", status: tankPercentStatus(pumpPercent) },
  ].filter((a) => a.status !== "normal");

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 space-y-8 max-w-7xl mx-auto">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Production Pressure" value={pressure.production_clean_room} unit="Pa" />
        <StatCard title="Assembly Pressure" value={pressure.assembly_clean_room} unit="Pa" />
        {FY600_DEVICES.map((device) => (
          <StatCard key={device.id} title={device.label} value={tanks[device.id]?.level ?? 0} unit="cm" />
        ))}
      </div>

      {/* Pressure Gauges */}
      <div>
        <SectionLabel title="Cleanroom Differential Pressure" subtitle="Production & Assembly floors" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 flex flex-col items-center gap-2">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-(--text)">Production Clean Room</span>
              <StatusPill status={pressureStatus(pressure.production_clean_room)} />
            </div>
            <PressureGauge value={pressure.production_clean_room} />
          </Card>
          <Card className="p-6 flex flex-col items-center gap-2">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FY600_DEVICES.map((device) => {
            const tankData = tanks[device.id];
            const percent = percentFromLevel(tankData?.level ?? 0, device.maxHeightCm);
            return (
              <Card key={device.id} className="p-6 flex flex-col items-center gap-2 relative">
                <div className="absolute top-5 right-5">
                  <StatusPill status={tankPercentStatus(percent)} />
                </div>
                <RoundTank levelCm={tankData?.level ?? 0} setpoint={tankData?.setpoint ?? 0} output={tankData?.output ?? 0} label={device.label} maxHeightCm={device.maxHeightCm} />
              </Card>
            );
          })}
        </div>
      </div>

      {/* Pressure trend chart */}
      <div>
        <SectionLabel title="Pressure Trend" subtitle={`Last ${MAX_HISTORY} live readings`} />
        <Card className="p-4 lg:p-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F2" opacity={0.8} vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#5C7290" }} axisLine={{ stroke: "#DCE6F2" }} tickLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#5C7290" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #DCE6F2" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="production" name="Production" stroke="#1768D1" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="assembly" name="Assembly" stroke="#7A63D6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Brush dataKey="time" height={28} stroke="#1768D1" fill="#E4F0FD" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Water level trend chart */}
      {waterHistory.length > 0 && (
        <div>
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
                <Line type="monotone" dataKey="pump_house_tank" name="Pump House Tank" stroke="#1AA6C9" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="main_tank" name="Main Tank" stroke="#7A63D6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Brush dataKey="time" height={28} stroke="#1768D1" fill="#E4F0FD" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  );
}
