"use client";

import type { DeviceStatus } from "@/types";

interface Props {
  status: DeviceStatus | string;
  lastUpdate?: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { dot: string; text: string; label: string; pulse?: boolean }> = {
  ONLINE: { dot: "#1FA97D", text: "#1FA97D", label: "Online", pulse: true },
  OFFLINE: { dot: "var(--critical)", text: "var(--critical)", label: "Offline" },
  ERROR: { dot: "var(--warning)", text: "var(--warning)", label: "Error", pulse: true },
  STALE: { dot: "var(--text-faint)", text: "var(--text-muted)", label: "Stale" },
};

export default function TankStatusBadge({ status, lastUpdate, className = "" }: Props) {
  const upperStatus = (status || "OFFLINE").toUpperCase();
  const config = STATUS_CONFIG[upperStatus] || STATUS_CONFIG.OFFLINE;

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-(--primary-soft) border border-(--border)">
        <span className={`w-2 h-2 rounded-full ${config.pulse ? "animate-pulse" : ""}`} style={{ background: config.dot }} />
        <span className="text-xs font-bold" style={{ color: config.text }}>
          {config.label}
        </span>
      </div>
      {lastUpdate && <span className="text-[10px] text-(--text-faint) whitespace-nowrap font-mono-data">Last: {lastUpdate}</span>}
    </div>
  );
}
