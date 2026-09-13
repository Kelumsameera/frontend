"use client";

import { useCallback, useState } from "react";
import PressureGauge from "@/components/PressureGauge";
import ConnectionStatus from "@/components/ConnectionStatus";
import { PageHeader, StatusPill, pressureStatus, LiveClock } from "@/components/ui";
import { useSocket } from "@/hooks/useSocket";
import type { PressureState, ModbusUpdate } from "@/types";

export default function PressurePage() {
  const [values, setValues] = useState<PressureState>({
    production_clean_room: 0,
    assembly_clean_room: 0,
  });

  const onModbusUpdate = useCallback((data: ModbusUpdate) => {
    setValues((prev) => ({
      ...prev,
      [data.device]: Number(data.value) || 0,
    }));
  }, []);

  const { status } = useSocket({ onModbusUpdate });

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 max-w-5xl mx-auto">
      <PageHeader
        title="Pressure Monitoring"
        subtitle="Differential pressure across both clean rooms"
        right={
          <div className="flex items-center gap-4">
            <ConnectionStatus status={status} />
            <LiveClock />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 place-items-center">
        {[
          { label: "Production Clean Room", value: values.production_clean_room },
          { label: "Assembly Clean Room", value: values.assembly_clean_room },
        ].map((room) => (
          <div
            key={room.label}
            className="w-full max-w-md bg-(--panel) rounded-3xl p-6 border border-(--border) shadow-[0_1px_2px_rgba(15,39,69,0.05),0_16px_36px_rgba(15,39,69,0.08)]"
          >
            <div className="flex justify-end mb-2">
              <StatusPill status={pressureStatus(room.value)} />
            </div>
            <div
              className="bg-white rounded-full p-4 flex justify-center"
              style={{ boxShadow: "inset 6px 6px 12px rgba(15,39,69,0.06), inset -6px -6px 12px rgba(255,255,255,0.9)" }}
            >
              <PressureGauge value={room.value} />
            </div>
            <div className="mt-5 text-center text-lg font-semibold text-(--text)">{room.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
