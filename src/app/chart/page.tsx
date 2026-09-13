"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import ConnectionStatus from "@/components/ConnectionStatus";
import { Card, PageHeader, LiveClock } from "@/components/ui";
import type { ModbusUpdate } from "@/types";
import { DEVICE_LABELS } from "@/types";

type PressureChartDataset = {
  label: string;
  data: Array<{ x: number; y: number }>;
  borderColor: string;
  backgroundColor: CanvasGradient;
  tension: number;
  fill: boolean;
  pointRadius: number;
  borderWidth: number;
};

const COLORS = ["#1768D1", "#16a34a", "#dc2626", "#ca8a04", "#1AA6C9"];
const MAX_POINTS = 300;
const WINDOW_MS = 2 * 60 * 1000; // 2-minute sliding window

interface LegendItem {
  name: string;
  color: string;
}

export default function ChartPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const datasetsRef = useRef<Record<string, PressureChartDataset>>({});
  const colorIndexRef = useRef(0);
  const pausedRef = useRef(false);
  const autoScaleRef = useRef(true);

  const [legend, setLegend] = useState<LegendItem[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScale, setAutoScale] = useState(true);

  pausedRef.current = paused;
  autoScaleRef.current = autoScale;

  /* Init chart once */
  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;

    const setupChart = async () => {
      const chartModule = await import("chart.js");
      const zoomModule = await import("chartjs-plugin-zoom");
      await import("chartjs-adapter-moment");

      const ChartCtor = chartModule.Chart;
      const { registerables } = chartModule;
      const zoomPlugin = zoomModule.default ?? zoomModule;
      ChartCtor.register(...registerables, zoomPlugin);

      if (cancelled || !canvasRef.current) return;

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      chartRef.current = new ChartCtor(ctx, {
        type: "line",
        data: { datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          parsing: false,
          interaction: { intersect: false, mode: "nearest" },
          scales: {
            x: {
              type: "time",
              grid: { color: "#E4F0FD" },
              title: { display: true, text: "Time" },
            },
            y: {
              grid: { color: "#E4F0FD" },
              title: { display: true, text: "Pressure (Pa)" },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: "#0C2E57", padding: 12 },
            zoom: {
              pan: { enabled: true, mode: "x" },
              zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                mode: "x",
              },
            },
            decimation: {
              enabled: true,
              algorithm: "lttb",
              samples: 100,
            },
          },
        },
      });
    };

    setupChart().catch((err) => {
      console.error("Unable to initialize chart page", err);
    });

    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  const onModbusUpdate = useCallback((data: ModbusUpdate) => {
    if (pausedRef.current) return;
    const chart = chartRef.current;
    if (!chart || !canvasRef.current) return;

    const deviceKey = data.device;
    const label = DEVICE_LABELS[deviceKey] || deviceKey;

    if (!datasetsRef.current[deviceKey]) {
      const color = COLORS[colorIndexRef.current++ % COLORS.length];
      const gradient = canvasRef.current.getContext("2d")!.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, color + "55");
      gradient.addColorStop(1, color + "00");

      const ds = {
        label,
        data: [] as { x: number; y: number }[],
        borderColor: color,
        backgroundColor: gradient,
        tension: 0.35,
        fill: true,
        pointRadius: 0,
        borderWidth: 2,
      };

      datasetsRef.current[deviceKey] = ds;
      chart.data.datasets.push(ds);
      setLegend((p) => [...p, { name: label, color }]);
    }

    const dataset = datasetsRef.current[deviceKey] as {
      data: { x: number; y: number }[];
    };
    const now = Date.now();

    dataset.data.push({ x: now, y: Number(data.value) || 0 });
    dataset.data = dataset.data.filter((p) => now - p.x <= WINDOW_MS);
    if (dataset.data.length > MAX_POINTS) dataset.data.shift();

    if (autoScaleRef.current && chart.options.scales?.y) {
      const yScale = chart.options.scales.y as { min?: number; max?: number };
      yScale.min = undefined;
      yScale.max = undefined;
    }

    chart.update("none");
  }, []);

  const { status } = useSocket({ onModbusUpdate });

  const exportPNG = () => {
    if (!chartRef.current) return;
    const url = chartRef.current.toBase64Image();
    const a = document.createElement("a");
    a.href = url;
    a.download = "pressure-chart.png";
    a.click();
  };

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 max-w-7xl mx-auto">
      <PageHeader
        title="Industrial Pressure Monitor"
        right={
          <div className="flex items-center gap-4">
            <ConnectionStatus status={status} />
            <LiveClock />
          </div>
        }
      />

      {/* Legend */}
      {legend.length > 0 && (
        <Card className="flex flex-wrap justify-center gap-4 mb-4 p-3">
          {legend.map((l) => (
            <div key={l.name} className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full" style={{ background: l.color }} />
              <span className="text-sm font-medium text-(--text-muted)">{l.name}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        <button
          onClick={() => setPaused((p) => !p)}
          className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition shadow-sm ${paused ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-500 hover:bg-amber-600"}`}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button onClick={() => chartRef.current?.resetZoom()} className="px-4 py-2 text-white rounded-lg text-sm font-medium transition shadow-sm" style={{ background: "var(--primary)" }}>
          Reset Zoom
        </button>
        <button onClick={exportPNG} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm">
          Export PNG
        </button>
        <button onClick={() => setAutoScale((a) => !a)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-sm">
          AutoScale: {autoScale ? "ON" : "OFF"}
        </button>
      </div>

      <Card className="p-3 h-105">
        <canvas ref={canvasRef} />
      </Card>
    </div>
  );
}
