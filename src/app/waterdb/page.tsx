"use client";

import { useState, useMemo } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchWaterHistory } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import type { DateTimeFilter, TableRow } from "@/types";
import { DEVICE_LABELS, FY600_DEVICES } from "@/types";

const getToday = () => new Date().toISOString().split("T")[0];

export default function WaterDatabasePage() {
  const [filters, setFilters] = useState<DateTimeFilter>({
    start_date: getToday(),
    start_time: "00:00",
    end_date: getToday(),
    end_time: "23:59",
  });

  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState("ALL");
  const [queryDevice, setQueryDevice] = useState("ALL");
  const [showZeros, setShowZeros] = useState(true);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof TableRow | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = `${filters.start_date} ${filters.start_time}:00`;
      const end = `${filters.end_date} ${filters.end_time}:00`;
      const device = queryDevice !== "ALL" ? queryDevice : undefined;
      const data = await fetchWaterHistory(start, end, device);

      const formatted: TableRow[] = data.map((r, i) => ({
        id: i + 1,
        device: DEVICE_LABELS[r.device] || r.device || "-",
        value: Number(r.value),
        time: new Date(r.time).toLocaleString(),
      }));
      setRows(formatted.slice(-2000));
    } catch {
      alert("Failed to fetch data");
      setRows([]);
    }
    setLoading(false);
  };

  const devices = useMemo(() => {
    const d = [...new Set(rows.map((r) => r.device))];
    return ["ALL", ...d];
  }, [rows]);

  const filteredRows = useMemo(() => {
    let data = rows;
    if (deviceFilter !== "ALL") {
      data = data.filter((r) => r.device === deviceFilter);
    }
    if (!showZeros) {
      data = data.filter((r) => r.value !== 0);
    }
    return data;
  }, [rows, deviceFilter, showZeros]);

  const handleSort = (key: keyof TableRow) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const A = a[sortConfig.key!];
      const B = b[sortConfig.key!];
      if (typeof A === "number" && typeof B === "number") {
        return sortConfig.direction === "asc" ? A - B : B - A;
      }
      const result = String(A).localeCompare(String(B));
      return sortConfig.direction === "asc" ? result : -result;
    });
  }, [filteredRows, sortConfig]);

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Water Data");
    ws.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Device", key: "device", width: 25 },
      { header: "Value", key: "value", width: 12 },
      { header: "Timestamp", key: "time", width: 24 },
    ];
    sortedRows.forEach((r) => ws.addRow({ ...r, value: r.value.toFixed(2) }));
    ws.getRow(1).font = { bold: true };
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "water_data.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [["ID", "Device", "Value", "Timestamp"]],
      body: sortedRows.map((r) => [r.id, r.device, r.value.toFixed(2), r.time]),
      headStyles: { fillColor: [12, 46, 87] },
    });
    doc.save("water_data.pdf");
  };

  const inputClass =
    "border border-(--border) bg-(--bg) px-3 py-2 rounded-lg text-sm text-(--text) font-mono-data focus:ring-2 focus:ring-(--primary)/30 focus:border-(--primary) outline-none transition";

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 max-w-7xl mx-auto">
      <PageHeader title="Water Tank Database" subtitle="Search, sort and export stored tank level readings" />

      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input type="date" name="start_date" value={filters.start_date} onChange={handleChange} className={inputClass} />
          <input type="time" name="start_time" value={filters.start_time} onChange={handleChange} className={inputClass} />
          <input type="date" name="end_date" value={filters.end_date} onChange={handleChange} className={inputClass} />
          <input type="time" name="end_time" value={filters.end_time} onChange={handleChange} className={inputClass} />
          <select value={queryDevice} onChange={(e) => setQueryDevice(e.target.value)} className={inputClass}>
            <option value="ALL">All Tanks</option>
            {FY600_DEVICES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="mt-4 text-white px-6 py-2.5 rounded-lg disabled:opacity-50 transition font-medium shadow-sm"
          style={{ background: "var(--primary)" }}
        >
          {loading ? "Loading…" : "Search"}
        </button>
      </Card>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} className={inputClass}>
            {devices.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-(--text-muted) bg-(--panel) border border-(--border) px-3 py-2 rounded-lg">
            <input type="checkbox" checked={showZeros} onChange={() => setShowZeros(!showZeros)} className="rounded accent-(--primary)" />
            Show Zeros
          </label>
          <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition shadow-sm">
            Excel
          </button>
          <button onClick={exportPDF} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm transition shadow-sm">
            PDF
          </button>
        </div>
      )}

      {sortedRows.length > 0 && (
        <Card className="max-h-125 overflow-y-auto">
          <table className="min-w-full text-center text-sm">
            <thead className="text-white sticky top-0" style={{ background: "var(--sidebar)" }}>
              <tr>
                {(["id", "device", "value", "time"] as const).map((k) => (
                  <th key={k} onClick={() => handleSort(k)} className="py-3 px-2 cursor-pointer hover:bg-(--sidebar-active) select-none font-semibold tracking-wide">
                    {k.toUpperCase()}
                    {sortConfig.key === k && (sortConfig.direction === "asc" ? " ↑" : " ↓")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.id} className="border-b border-(--border) hover:bg-(--primary-soft) transition-colors">
                  <td className="py-2">{r.id}</td>
                  <td>{r.device}</td>
                  <td className="font-medium font-mono-data text-(--text)">{r.value.toFixed(2)}</td>
                  <td className="text-(--text-muted)">{r.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {!loading && rows.length === 0 && <p className="text-center text-(--text-faint) mt-12">Select date range &amp; load data</p>}
    </div>
  );
}
