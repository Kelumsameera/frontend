"use client";

import { useState, useMemo } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchPressureHistory } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import type { DateTimeFilter, TableRow } from "@/types";
import { DEVICE_LABELS } from "@/types";

export default function PressureDatabasePage() {
  const [filters, setFilters] = useState<DateTimeFilter>({
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
  });

  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState("ALL");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof TableRow | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const fetchData = async () => {
    if (
      !filters.start_date ||
      !filters.start_time ||
      !filters.end_date ||
      !filters.end_time
    ) {
      alert("Please fill all fields");
      return;
    }

    const start = `${filters.start_date} ${filters.start_time}:00`;
    const end = `${filters.end_date} ${filters.end_time}:00`;

    if (new Date(end) < new Date(start)) {
      alert("End time must be after start time");
      return;
    }

    setLoading(true);
    try {
      const data = await fetchPressureHistory(start, end);
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
    if (deviceFilter === "ALL") return rows;
    return rows.filter((r) => r.device === deviceFilter);
  }, [rows, deviceFilter]);

  const handleSort = (key: keyof TableRow) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
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
    const ws = wb.addWorksheet("Pressure Data");
    ws.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Device", key: "device", width: 28 },
      { header: "Value", key: "value", width: 12 },
      { header: "Timestamp", key: "time", width: 24 },
    ];
    sortedRows.forEach((r) => ws.addRow(r));
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "0C2E57" },
      };
    });
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "pressure_data.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [["ID", "Device", "Value", "Timestamp"]],
      body: sortedRows.map((r) => [
        r.id,
        r.device,
        r.value.toFixed(2),
        r.time,
      ]),
      headStyles: { fillColor: [12, 46, 87] },
    });
    doc.save("pressure_data.pdf");
  };

  const inputClass =
    "border border-(--border) bg-(--bg) px-3 py-2 rounded-lg text-sm text-(--text) font-mono-data focus:ring-2 focus:ring-(--primary)/30 focus:border-(--primary) outline-none transition";

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 max-w-7xl mx-auto">
      <PageHeader title="Pressure Database" subtitle="Search, sort and export stored pressure readings" />

      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input type="date" name="start_date" onChange={handleChange} className={inputClass} />
          <input type="time" name="start_time" onChange={handleChange} className={inputClass} />
          <input type="date" name="end_date" onChange={handleChange} className={inputClass} />
          <input type="time" name="end_time" onChange={handleChange} className={inputClass} />
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
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} className={inputClass}>
            {devices.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition shadow-sm">
            Excel
          </button>
          <button onClick={exportPDF} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm transition shadow-sm">
            PDF
          </button>
        </div>
      )}

      {sortedRows.length > 0 && (
        <Card className="max-h-[500px] overflow-y-auto">
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
    </div>
  );
}
