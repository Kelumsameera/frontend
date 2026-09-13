"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState, useMemo } from "react";
import { fetchPressureHistory } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import type { HistoryRow, DateTimeFilter } from "@/types";
import { DEVICE_LABELS } from "@/types";

const COLORS = ["#1768D1", "#16a34a", "#dc2626", "#ca8a04", "#1AA6C9"];

type HistoryChartDataset = {
  label: string;
  data: Array<{ x: Date; y: number }>;
  borderColor: string;
  backgroundColor: string;
  fill: boolean;
  tension: number;
  pointRadius: number;
};

export default function HistoryPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<DateTimeFilter>({
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const validateRange = () => {
    if (!Object.values(filters).every(Boolean)) {
      setError("Select all date & time fields");
      return false;
    }
    const start = new Date(`${filters.start_date}T${filters.start_time}`);
    const end = new Date(`${filters.end_date}T${filters.end_time}`);
    if (end <= start) {
      setError("End must be after start");
      return false;
    }
    return true;
  };

  const fetchHistory = async () => {
    if (!validateRange()) return;
    setLoading(true);
    setError(null);

    try {
      const start = `${filters.start_date} ${filters.start_time}:00`;
      const end = `${filters.end_date} ${filters.end_time}:00`;
      const data = await fetchPressureHistory(start, end);
      setRows(data.slice(-5000));
    } catch {
      setError("Fetch failed – check API connection");
      setRows([]);
    }
    setLoading(false);
  };

  const chartData = useMemo<HistoryChartDataset[]>(() => {
    const map: Record<string, HistoryChartDataset> = {};
    let i = 0;

    rows.forEach((r) => {
      if (!r.device || r.value == null || !r.time) return;
      if (!map[r.device]) {
        map[r.device] = {
          label: DEVICE_LABELS[r.device] || r.device,
          data: [],
          borderColor: COLORS[i % COLORS.length],
          backgroundColor: COLORS[i % COLORS.length] + "33",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        };
        i++;
      }
      map[r.device].data.push({
        x: new Date(r.time),
        y: Number(r.value) || 0,
      });
    });

    return Object.values(map);
  }, [rows]);

  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;

    const setupChart = async () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      if (chartData.length === 0 || !canvasRef.current) return;

      const chartModule = await import("chart.js");
      const zoomModule = await import("chartjs-plugin-zoom");
      await import("chartjs-adapter-moment");

      const ChartCtor = chartModule.Chart;
      const { registerables } = chartModule;
      const zoomPlugin = zoomModule.default ?? zoomModule;
      ChartCtor.register(...registerables, zoomPlugin);

      if (cancelled || !canvasRef.current) return;

      chartRef.current = new ChartCtor(canvasRef.current, {
        type: "line",
        data: { datasets: chartData },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "nearest", intersect: false },
          scales: {
            x: { type: "time", title: { display: true, text: "Time" }, grid: { color: "#E4F0FD" } },
            y: { title: { display: true, text: "Pressure (Pa)" }, grid: { color: "#E4F0FD" } },
          },
          plugins: {
            legend: { display: true, position: "top" },
            zoom: {
              pan: { enabled: true, mode: "x" },
              zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                mode: "x",
              },
            },
          },
        },
      });
    };

    setupChart().catch((err) => {
      console.error("Unable to initialize history chart", err);
    });

    return () => {
      cancelled = true;
      chartRef.current?.destroy();
    };
  }, [chartData]);

  const exportCSV = () => {
    let csv = "Device,Timestamp,Value\n";
    rows.forEach((r) => {
      csv += `${r.device},${r.time},${r.value}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pressure_history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputClass =
    "border border-(--border) bg-(--bg) px-3 py-2 rounded-lg text-sm text-(--text) font-mono-data focus:ring-2 focus:ring-(--primary)/30 focus:border-(--primary) outline-none transition";

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 max-w-7xl mx-auto">
      <PageHeader title="Pressure History" subtitle="Search readings by date & time range" />

      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {(
            [
              ["start_date", "date"],
              ["start_time", "time"],
              ["end_date", "date"],
              ["end_time", "time"],
            ] as const
          ).map(([name, type]) => (
            <input key={name} type={type} name={name} value={filters[name]} onChange={handleChange} className={inputClass} />
          ))}
        </div>

        {error && <p className="mt-3 text-sm font-medium" style={{ color: "var(--critical)" }}>{error}</p>}

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="mt-4 text-white px-6 py-2.5 rounded-lg disabled:opacity-50 transition font-medium shadow-sm"
          style={{ background: "var(--primary)" }}
        >
          {loading ? "Loading…" : "Load History"}
        </button>
      </Card>

      {chartData.length > 0 && (
        <>
          <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
            <p className="text-sm text-(--text-muted)">
              Devices: <span className="font-semibold text-(--text)">{chartData.length}</span> · Points:{" "}
              <span className="font-semibold text-(--text)">{rows.length}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={exportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition shadow-sm">
                Export CSV
              </button>
              <button onClick={() => chartRef.current?.resetZoom()} className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm transition shadow-sm">
                Reset Zoom
              </button>
            </div>
          </div>

          <Card className="p-4 h-96">
            <canvas ref={canvasRef} />
          </Card>
        </>
      )}

      {!loading && rows.length === 0 && <p className="text-center text-(--text-faint) mt-12">Select date range &amp; load data</p>}
    </div>
  );
}
