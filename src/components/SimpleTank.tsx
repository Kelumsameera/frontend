"use client";

import { useId } from "react";
import { tankPercentStatus, statusColor } from "@/components/ui";

interface Props {
  /** Current level in cm */
  levelCm?: number;
  maxHeightCm?: number;
  label?: string;
  /** Full-tank volume in liters, shown under the level reading when provided */
  capacityLiters?: number;
  /** Optional dashboard-only tank setpoint used by callers that pass a richer tank model */
  setpoint?: number;
  /** Optional dashboard-only tank output value used by callers that pass a richer tank model */
  output?: number;
}

/**
 * A plain, low-detail tank silhouette: straight sides, small rounded corners
 * top and bottom, single flat fill color. No gradients, no wave animation —
 * meant as a lighter alternative to RoundTank for pages where the tank is a
 * secondary element (e.g. next to consumption charts).
 */
export default function SimpleTank({ levelCm = 0, maxHeightCm = 250, label = "Tank", capacityLiters, setpoint: _setpoint, output: _output }: Props) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const safeLevel = Math.max(0, Math.min(levelCm, maxHeightCm));
  const percent = (safeLevel / maxHeightCm) * 100;

  const status = tankPercentStatus(percent);
  const fillColor = statusColor(status);

  const W = 160;
  const H = 260;
  const x = 20;
  const y = 16;
  const w = W - 40;
  const h = 216;
  const r = 12;

  const fillH = (percent / 100) * h;
  const fillY = y + h - fillH;
  const clipId = `simpletank${rawId}`;

  const liters = capacityLiters != null ? (percent / 100) * capacityLiters : null;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="mb-2 text-[15px] font-semibold text-(--text)">{label}</div>

      <svg width={144} height={234} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={x} y={y} width={w} height={h} rx={r} />
          </clipPath>
        </defs>

        {/* Empty vessel */}
        <rect x={x} y={y} width={w} height={h} rx={r} fill="#EEF4FC" stroke="#C2D5EA" strokeWidth={3} />

        {/* Liquid fill */}
        <g clipPath={`url(#${clipId})`}>
          <rect x={x} y={fillY} width={w} height={fillH} fill={fillColor} opacity={0.85} style={{ transition: "y 0.8s ease, height 0.8s ease" }} />
        </g>

        {/* Outline redrawn on top for a crisp edge */}
        <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke="#C2D5EA" strokeWidth={3} />

        {/* Scale ticks */}
        {Array.from({ length: 6 }).map((_, i) => {
          const cm = maxHeightCm - i * (maxHeightCm / 5);
          const ty = y + (h / 5) * i;
          return (
            <g key={i}>
              <line x1={x + w + 6} x2={x + w + 14} y1={ty} y2={ty} stroke="#93A7C2" strokeWidth={2} />
              <text x={x + w + 18} y={ty + 4} fontSize="11" fontFamily="var(--font-mono)" fill="#5C7290">
                {Math.round(cm)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-1 font-mono-data text-lg font-bold" style={{ color: fillColor }}>
        {Math.round(percent)}%
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono-data text-xl font-bold text-(--text)">{safeLevel.toFixed(1)}</span>
        <span className="text-sm text-(--text-muted)">cm / {maxHeightCm} cm</span>
      </div>

      {liters != null && (
        <div className="mt-0.5 text-xs text-(--text-muted) font-mono-data">
          ≈ {liters.toFixed(0)} L / {capacityLiters?.toFixed(0)} L
        </div>
      )}
    </div>
  );
}
