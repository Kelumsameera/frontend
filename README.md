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

## LAN automatic deployment

This installation checks the public `main` branch every minute using the
Ubuntu `flexicare-auto-deploy.timer` service, then requests a build through
Coolify's authenticated local API. A successful Git push is enough; no inbound
GitHub webhook or public router port is required.

GitHub access requires internet. Existing deployed applications continue running
on the LAN without internet. Failed deployments retry after ten minutes.

Server checks:

```bash
systemctl status flexicare-auto-deploy.timer
sudo journalctl -u flexicare-auto-deploy.service -n 30 --no-pager
```

To pause deployment checks: `sudo systemctl stop flexicare-auto-deploy.timer`.
