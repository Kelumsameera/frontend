"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  pv: number;
  sv: number;
  output: number;
}

const COLORS = ["#1768D1", "#1AA6C9", "#7A63D6"];

export default function BarChartPanel({ pv, sv, output }: Props) {
  const data = [
    { name: "PV (Level)", value: Number(pv) || 0 },
    { name: "SV (Setpoint)", value: Number(sv) || 0 },
    { name: "OUT (%)", value: Number(output) || 0 },
  ];

  return (
    <div className="bg-(--panel) border border-(--border) shadow-[0_1px_2px_rgba(15,39,69,0.04),0_10px_24px_rgba(15,39,69,0.05)] rounded-2xl p-6 h-full min-h-[320px] flex flex-col">
      <h3 className="text-[15px] font-semibold mb-4 text-(--text)">Live Values</h3>
      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DCE6F2" opacity={0.8} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5C7290", fontFamily: "var(--font-ui)" }} axisLine={{ stroke: "#DCE6F2" }} tickLine={false} />
            <YAxis domain={[0, "auto"]} tick={{ fontSize: 11, fill: "#5C7290", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(val: number) => [val.toFixed(2), "Value"]}
              contentStyle={{ borderRadius: 10, border: "1px solid #DCE6F2", fontFamily: "var(--font-mono)", fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
