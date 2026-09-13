/** Pressure device identifiers used by the backend */
export type PressureDevice =
  | "production_clean_room"
  | "assembly_clean_room";

/** FY600 water tank device identifiers */
export type FY600DeviceId = "pump_house_tank" | "main_tank";

/** Device status reported by backend */
export type DeviceStatus = "ONLINE" | "OFFLINE" | "ERROR" | "STALE";

/** FY600 device configuration for UI rendering */
export interface FY600DeviceConfig {
  id: FY600DeviceId;
  label: string;
  maxHeightCm: number;
}

/** Registry of all FY600 devices */
export const FY600_DEVICES: FY600DeviceConfig[] = [
  { id: "pump_house_tank", label: "Pump House Tank", maxHeightCm: 250 },
  { id: "main_tank", label: "Main Tank", maxHeightCm: 250 },
];

/** Human-readable labels */
export const DEVICE_LABELS: Record<string, string> = {
  production_clean_room: "Production Clean Room",
  assembly_clean_room: "Assembly Clean Room",
  pump_house_tank: "Pump House Tank",
  main_tank: "Main Tank",
  fy600: "Pump House",
};

/** Socket.IO – pressure update payload */
export interface ModbusUpdate {
  device: PressureDevice | string;
  value: number;
}

/** Socket.IO – water tank update payload */
export interface WaterTankUpdate {
  device: string;
  tank_id?: string;
  level: number;
  setpoint: number;
  output: number;
  status?: DeviceStatus | string;
  time?: string;
}

/** REST history row (pressure or water) */
export interface HistoryRow {
  device: string;
  value: number;
  time: string;
}

/** Formatted table row */
export interface TableRow {
  id: number;
  device: string;
  value: number;
  time: string;
}

/** Live pressure state */
export interface PressureState {
  production_clean_room: number;
  assembly_clean_room: number;
}

/** Live tank state for a single device */
export interface TankState {
  level: number;
  setpoint: number;
  output: number;
}

/** Extended tank state with status and timing */
export interface TankDeviceState extends TankState {
  status: DeviceStatus;
  lastUpdate: string;
}

/** Live dual-tank state keyed by device ID */
export type DualTankState = Record<string, TankDeviceState>;

/** Connection status */
export type ConnectionStatus = "connected" | "disconnected" | "connecting";

/** Date-range filter */
export interface DateTimeFilter {
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
}

/** Chart history point for Recharts */
export interface ChartPoint {
  time: string;
  production: number;
  assembly: number;
}

/** Device status row from backend */
export interface DeviceStatusRow {
  device: string;
  tank_id: string;
  status: string;
  last_seen: string | null;
  last_error: string | null;
  updated_at: string;
}
