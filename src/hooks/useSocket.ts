"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "@/lib/config";
import type { ConnectionStatus, ModbusUpdate, WaterTankUpdate } from "@/types";

interface UseSocketOptions {
  onModbusUpdate?: (data: ModbusUpdate) => void;
  onWaterTankUpdate?: (data: WaterTankUpdate) => void;
  enabled?: boolean;
}

export function useSocket({
  onModbusUpdate,
  onWaterTankUpdate,
  enabled = true,
}: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  // Keep latest callbacks without re-connecting
  const modbusCb = useRef(onModbusUpdate);
  const waterCb = useRef(onWaterTankUpdate);
  modbusCb.current = onModbusUpdate;
  waterCb.current = onWaterTankUpdate;

  useEffect(() => {
    if (!enabled) return;

    setStatus("connecting");

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      setStatus("connected");
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ Socket disconnected:", reason);
      setStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      console.log("❌ Socket error:", err.message);
      setStatus("disconnected");
    });

    socket.on("modbus_update", (data: ModbusUpdate) => {
      if (data?.device != null) {
        modbusCb.current?.(data);
      }
    });

    socket.on("water_tank_update", (data: WaterTankUpdate) => {
      waterCb.current?.(data);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("modbus_update");
      socket.off("water_tank_update");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  return { status, disconnect, socket: socketRef };
}
