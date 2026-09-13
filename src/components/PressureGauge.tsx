"use client";

import { useRef, useEffect } from "react";

interface Zone {
  start: number;
  end: number;
  color: string;
}

interface Props {
  value?: number;
  min?: number;
  max?: number;
  unit?: string;
  size?: number;
  showDigital?: boolean;
  label?: string;
  zones?: Zone[];
}

const DEFAULT_ZONES: Zone[] = [
  { start: 0, end: 5, color: "#d92647" },
  { start: 5, end: 10, color: "#e08048" },
  { start: 10, end: 15, color: "#d6d926" },
  { start: 15, end: 25, color: "#38c749" },
  { start: 25, end: 35, color: "#e08048" },
  { start: 35, end: 50, color: "#d92647" },
];

const roundSvgValue = (n: number) => Number(n.toFixed(6));

export default function PressureGauge({ value = 0, min = 0, max = 50, unit = "Pa", size = 320, showDigital = true, label, zones = DEFAULT_ZONES }: Props) {
  const safeValue = Math.min(Math.max(value, min), max);
  const range = max - min || 1;

  const cx = size / 2;
  const cy = size / 2;
  const arcThickness = 10;
  const arcGap = 80;
  const radius = (size - arcThickness - arcGap) / 2;

  const tickMajor = 22;
  const tickMinor = 14;
  const tickMicro = 8;
  const tickOuterRadius = radius - arcThickness / 2;
  const labelRadius = tickOuterRadius - 30;

  const startAngle = 135;
  const endAngle = 405;
  const angleRange = endAngle - startAngle;

  const smoothValue = useRef(safeValue);
  useEffect(() => {
    smoothValue.current = safeValue;
  }, [safeValue]);

  const needleAngle = startAngle + 90 + angleRange * ((Number(safeValue.toFixed(2)) - min) / range);

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (a1: number, a2: number, r: number) => {
    const s = toRad(a1);
    const e = toRad(a2);
    const x1 = roundSvgValue(cx + r * Math.cos(s));
    const y1 = roundSvgValue(cy + r * Math.sin(s));
    const x2 = roundSvgValue(cx + r * Math.cos(e));
    const y2 = roundSvgValue(cy + r * Math.sin(e));
    const large = a2 - a1 > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center">
      {label && <h3 className="text-lg font-semibold text-slate-700 mb-2">{label}</h3>}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="metal" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#222" />
            <stop offset="50%" stopColor="#aaa" />
            <stop offset="100%" stopColor="#555" />
          </linearGradient>
          <linearGradient id="needleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff2a2a" />
            <stop offset="100%" stopColor="#7a0000" />
          </linearGradient>
        </defs>

        {/* Bezel */}
        <circle cx={cx} cy={cy} r={radius + 32} fill="none" stroke="url(#metal)" strokeWidth={14} />
        <circle cx={cx} cy={cy} r={radius + 22} fill="none" stroke="#777" strokeWidth={4} />
        <circle cx={cx} cy={cy} r={radius + 10} fill="#fff" />

        {/* Zones */}
        {zones.map((z, i) => {
          const a1 = startAngle + angleRange * (z.start / max);
          const a2 = startAngle + angleRange * (z.end / max);
          return <path key={i} d={arcPath(a1, a2, radius)} stroke={z.color} strokeWidth={arcThickness} strokeLinecap="round" fill="none" />;
        })}

        {/* Ticks + numbers */}
        {Array.from({ length: 101 }).map((_, i) => {
          const valueAtTick = min + (range * i) / 100;
          const pct = (valueAtTick - min) / range;
          const ang = startAngle + angleRange * pct;
          const rad = toRad(ang);
          const isMajor = i % 10 === 0;
          const isMinor = i % 5 === 0;
          const inner = radius - arcThickness / 2 - (isMajor ? tickMajor : isMinor ? tickMinor : tickMicro);

          const x1 = roundSvgValue(cx + inner * Math.cos(rad));
          const y1 = roundSvgValue(cy + inner * Math.sin(rad));
          const x2 = roundSvgValue(cx + tickOuterRadius * Math.cos(rad));
          const y2 = roundSvgValue(cy + tickOuterRadius * Math.sin(rad));
          const tx = roundSvgValue(cx + labelRadius * Math.cos(rad));
          const ty = roundSvgValue(cy + labelRadius * Math.sin(rad));

          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2c3e50" strokeWidth={isMajor ? 3 : isMinor ? 2 : 1} />
              {isMajor && (
                <text x={tx} y={ty} fontSize="12" fontWeight="bold" fill="#333" textAnchor="middle" dominantBaseline="middle">
                  {Math.round(valueAtTick)}
                </text>
              )}
            </g>
          );
        })}

        <text x={cx} y={cy - 55} fontSize="18" fontWeight="bold" textAnchor="middle" fill="#555">
          {unit}
        </text>

        {/* Needle */}
        <g transform={`rotate(${needleAngle} ${cx} ${cy})`}>
          <polygon points={`${cx},${cy} ${cx - 8},${cy + 10} ${cx + 8},${cy + 10} ${cx},${cy - tickOuterRadius}`} fill="url(#needleGrad)" />
        </g>

        <circle cx={cx} cy={cy} r={12} fill="url(#metal)" />
        <circle cx={cx} cy={cy} r={6} fill="#8b4513" />

        {showDigital && (
          <>
            <rect x={cx - 45} y={cy + 55} width={90} height={36} rx={6} fill="#f8f6f4" stroke="#000" />
            <text x={cx} y={cy + 80} fontSize="18" fontWeight="bold" textAnchor="middle">
              {safeValue.toFixed(2)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
