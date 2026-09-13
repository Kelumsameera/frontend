# Flexicare Monitoring System – Frontend (TypeScript)

Next.js 15 + TypeScript + Tailwind CSS 4 frontend for real-time pressure gauge and water tank level monitoring.

## Features

- **Realtime dashboard** – Pressure gauges + tank level + live chart (Socket.IO)
- **Pressure page** – Dual custom SVG gauges
- **Water page** – Animated tank + live bar chart
- **Advanced chart** – Chart.js with zoom/pan, pause, autoscale, PNG export
- **History** – Date-range pressure history with zoomable chart + CSV export
- **Database tables** – Filterable, sortable tables with Excel & PDF export
- Shared `useSocket` hook, typed payloads, consistent connection status

## Quick Start

```bash
cd frontend
cp .env.example .env.local
# Edit NEXT_PUBLIC_SOCKET_URL and NEXT_PUBLIC_API_URL to your backend

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:3000` | Socket.IO server |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | REST API base URL |

## Backend Contract

### Socket.IO events

```ts
// Pressure
socket.emit("modbus_update", {
  device: "production_clean_room" | "assembly_clean_room",
  value: number
});

// Water tank
socket.emit("water_tank_update", {
  level: number,      // cm
  setpoint: number,
  output: number      // %
});
```

### REST

```
GET /pressure/database/filter?start=YYYY-MM-DD HH:mm:ss&end=...
GET /water-tank/database/filter?start=...&end=...
```

Response: `[{ device, value, time }, ...]`

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # UI components (typed)
├── hooks/useSocket.ts   # Shared Socket.IO hook
├── lib/                 # config + API helpers
└── types/               # Shared TypeScript types
```

## Scripts

- `npm run dev` – development server
- `npm run build` – production build
- `npm start` – run production build
