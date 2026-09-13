"use client";

import type { ConnectionStatus as Status } from "@/types";

interface Props {
  status: Status;
  className?: string;
}

export default function ConnectionStatus({ status, className = "" }: Props) {
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  const dot = isConnected ? "#1FA97D" : isConnecting ? "var(--warning)" : "var(--critical)";
  const text = isConnected ? "#1FA97D" : isConnecting ? "var(--warning)" : "var(--critical)";

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-(--panel) shadow-sm border border-(--border) ${className}`}
    >
      <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: dot }} />
      <span className="text-sm font-medium text-(--text-muted)">Status:</span>
      <span className="text-sm font-bold capitalize font-mono-data" style={{ color: text }}>
        {status}
      </span>
    </div>
  );
}
