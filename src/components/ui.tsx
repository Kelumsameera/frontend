"use client";

import { useEffect, useState } from "react";

/* ---------------------------------------------------------- */
/* Card — the base white panel used across every page          */
/* ---------------------------------------------------------- */

export function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`bg-(--panel) border border-(--border) rounded-2xl shadow-[0_1px_2px_rgba(15,39,69,0.04),0_10px_24px_rgba(15,39,69,0.05)] ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------- */
/* StatusPill — normal / warning / critical                    */
/* ---------------------------------------------------------- */

export type Status = "normal" | "warning" | "critical";

export function pressureStatus(v: number): Status {
  if (v < 5 || v > 35) return "critical";
  if (v < 10 || v > 30) return "warning";
  return "normal";
}

export function tankPercentStatus(percent: number): Status {
  if (percent < 15) return "critical";
  if (percent < 30) return "warning";
  return "normal";
}

export function statusColor(s: Status) {
  return s === "critical" ? "var(--critical)" : s === "warning" ? "var(--warning)" : "var(--normal)";
}
export function statusSoft(s: Status) {
  return s === "critical" ? "var(--critical-soft)" : s === "warning" ? "var(--warning-soft)" : "var(--normal-soft)";
}
export function statusLabel(s: Status) {
  return s === "critical" ? "Critical" : s === "warning" ? "Warning" : "Normal";
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: statusSoft(status), color: statusColor(status) }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(status) }} />
      {statusLabel(status)}
    </span>
  );
}

/* ---------------------------------------------------------- */
/* SectionLabel — small accent bar + heading used before groups */
/* ---------------------------------------------------------- */

export function SectionLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-1.5 h-6 rounded-full" style={{ background: "linear-gradient(180deg, var(--primary), var(--sidebar))" }} />
      <div>
        <h2 className="text-base lg:text-[15px] font-semibold text-(--text)">{title}</h2>
        {subtitle && <p className="text-xs text-(--text-faint)">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- */
/* PageHeader — title on the left, live clock on the right      */
/* ---------------------------------------------------------- */

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-4">
      <span className="flex items-center gap-1.5 font-mono-data text-xs text-(--text-muted)">
        <span className="w-1.75 h-1.75 rounded-full animate-pulse" style={{ background: "var(--primary)", boxShadow: "0 0 0 3px var(--primary-soft)" }} />
        Live
      </span>
      <span className="font-mono-data text-[13px] text-(--text-muted) w-18.5 text-right">
        {now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}
      </span>
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-(--text)">{title}</h1>
        {subtitle && <p className="text-(--text-faint) text-sm mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
