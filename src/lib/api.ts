import { API_URL } from "./config";
import type { HistoryRow, DeviceStatusRow } from "@/types";

export async function fetchPressureHistory(
  start: string,
  end: string
): Promise<HistoryRow[]> {
  const url = `${API_URL}/pressure/database/filter?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch pressure history");
  return res.json();
}

export async function fetchWaterHistory(
  start: string,
  end: string,
  device?: string
): Promise<HistoryRow[]> {
  let url = `${API_URL}/water-tank/database/filter?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  if (device) {
    url += `&device=${encodeURIComponent(device)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch water history");
  return res.json();
}

export async function fetchDeviceStatus(
  device?: string
): Promise<DeviceStatusRow[]> {
  let url = `${API_URL}/device-status`;
  if (device) {
    url += `?device=${encodeURIComponent(device)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch device status");
  return res.json();
}

export async function fetchRealtimeWater(
  device?: string
): Promise<Record<string, unknown>> {
  let url = `${API_URL}/realtime/water`;
  if (device) {
    url += `?device=${encodeURIComponent(device)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch realtime water data");
  return res.json();
}
