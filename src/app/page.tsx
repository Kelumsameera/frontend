"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { FaGaugeHigh, FaDroplet, FaChartLine, FaDatabase } from "react-icons/fa6";
import { Card, StatusPill, pressureStatus, tankPercentStatus, statusLabel, LiveClock, type Status } from "@/components/ui";
import { useSocket } from "@/hooks/useSocket";
import type { PressureState, DualTankState, ModbusUpdate, WaterTankUpdate } from "@/types";

const QUICK_LINKS = [
  { href: "/dashboard", title: "Live Dashboard", desc: "Pressure gauges and tank levels together, updating in real time.", icon: FaChartLine },
  { href: "/pressure", title: "Pressure Monitoring", desc: "Differential pressure for the Production and Assembly clean rooms.", icon: FaGaugeHigh },
  { href: "/water", title: "Water Tank Level", desc: "Main tank and pump house tank level, setpoint and output.", icon: FaDroplet },
  { href: "/history", title: "History & Records", desc: "Search, chart and export past readings by date and time.", icon: FaDatabase },
];

function percentFromLevel(levelCm: number, maxHeightCm: number) {
  return Math.max(0, Math.min(100, (levelCm / maxHeightCm) * 100));
}

export default function HomePage() {
  const [pressure, setPressure] = useState<PressureState>({ production_clean_room: 0, assembly_clean_room: 0 });
  const [tanks, setTanks] = useState<DualTankState>({});

  const onModbusUpdate = useCallback((data: ModbusUpdate) => {
    setPressure((prev) => ({ ...prev, [data.device]: Number(data.value) || 0 }));
  }, []);

  const onWaterTankUpdate = useCallback((data: WaterTankUpdate) => {
    const deviceId = data.device || "fy600";
    setTanks((prev) => ({
      ...prev,
      [deviceId]: {
        level: Number(data.level) || 0,
        setpoint: Number(data.setpoint) || 0,
        output: Number(data.output) || 0,
        status: (data.status as any) || "ONLINE",
        lastUpdate: data.time || new Date().toLocaleTimeString(),
      },
    }));
  }, []);

  useSocket({ onModbusUpdate, onWaterTankUpdate });

  const mainPercent = percentFromLevel(tanks["main_tank"]?.level ?? 0, 250);
  const pumpPercent = percentFromLevel(tanks["pump_house_tank"]?.level ?? 0, 250);

  const worst: Status[] = [pressureStatus(pressure.production_clean_room), pressureStatus(pressure.assembly_clean_room), tankPercentStatus(mainPercent), tankPercentStatus(pumpPercent)];
  const overall: Status = worst.includes("critical") ? "critical" : worst.includes("warning") ? "warning" : "normal";

  const cards = [
    { label: "Production Room — ΔP", value: `${pressure.production_clean_room.toFixed(1)} Pa`, status: pressureStatus(pressure.production_clean_room), icon: FaGaugeHigh },
    { label: "Assembly Room — ΔP", value: `${pressure.assembly_clean_room.toFixed(1)} Pa`, status: pressureStatus(pressure.assembly_clean_room), icon: FaGaugeHigh },
    { label: "Main Tank", value: `${Math.round(mainPercent)}%`, status: tankPercentStatus(mainPercent), icon: FaDroplet },
    { label: "Pump House Tank", value: `${Math.round(pumpPercent)}%`, status: tankPercentStatus(pumpPercent), icon: FaDroplet },
  ];

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 max-w-7xl mx-auto">
      <div className="flex justify-end mb-4">
        <LiveClock />
      </div>

      {/* Hero */}
      <div className="rounded-[18px] p-8 lg:p-9 mb-6 shadow-[0_12px_30px_rgba(12,58,115,0.25)]" style={{ background: "linear-gradient(135deg, var(--hero-from), var(--hero-to))" }}>
        <div className="text-[13px] text-[#BBDBFC] mb-2.5">Flexicare Lanka · Environmental Monitoring System</div>
        <div className="flex items-baseline gap-4 flex-wrap">
          <h1 className="text-2xl lg:text-[30px] font-extrabold text-white m-0">
            {overall === "normal" ? "All systems within range" : overall === "warning" ? "One or more readings need attention" : "Critical reading detected"}
          </h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: overall === "critical" ? "#FF8A80" : overall === "warning" ? "#FFD983" : "#8FE3B0" }} />
            {statusLabel(overall)}
          </span>
        </div>
        <p className="text-[#CFE3FA] mt-3 max-w-xl text-sm leading-relaxed">
          Live differential pressure across the Production and Assembly clean rooms, and supply level across the main storage tank and the pump house tank via Modbus TCP.
        </p>
        <Link href="/dashboard">
          <button className="mt-6 rounded-full bg-white text-(--sidebar) font-bold py-2.5 px-7 hover:bg-blue-50 hover:-translate-y-0.5 transition-all duration-200 shadow-lg text-sm">
            Open Live Dashboard
          </button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex justify-between items-start mb-3.5">
              <div className="flex items-center gap-2 text-(--text-muted) text-[13px]">
                <c.icon size={14} />
                {c.label}
              </div>
              <StatusPill status={c.status} />
            </div>
            <div className="font-mono-data text-[26px] font-semibold text-(--text)">{c.value}</div>
          </Card>
        ))}
      </div>

      {/* Quick access */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-(--text) mb-1">Everything in one place</h2>
        <p className="text-(--text-faint) text-sm">Jump straight into live readings, historical trends, or export-ready records.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="group">
            <Card className="h-full p-6 flex gap-4 items-start hover:-translate-y-1 transition-all duration-200">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-(--primary-soft) text-(--primary) flex items-center justify-center text-lg group-hover:bg-(--primary) group-hover:text-white transition-colors duration-200">
                <link.icon />
              </div>
              <div>
                <h3 className="font-semibold text-(--text) mb-1">{link.title}</h3>
                <p className="text-sm text-(--text-muted) leading-relaxed">{link.desc}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <footer className="text-center text-(--text-faint) text-xs py-10">© {new Date().getFullYear()} Flexicare Lanka — Environmental Monitoring System</footer>
    </div>
  );
}
