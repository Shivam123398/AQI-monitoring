# BreatheNet (AeroGuard AI) — Hyperlocal Air Quality Monitoring

A polished, map-first dashboard with multi-node device support, live AQI tiles, charts, alerts, and 24-hour forecasts. Works out-of-the-box via Docker with a simulator/demo mode.

Key features (frontend focus)
- Map: React-Leaflet map with color-coded AQI markers (latest per device) and city public view.
- Devices: Device list and rich device detail page with trends and WHO guideline badges.
- Charts: 24h/7d trends, forecast overlay, and health risk components.
- Alerts: Thresholds UI with Email/Telegram/SMS toggles; Send Test Alert that posts a simulated high AQI measurement.
- Reports: CSV export and quick stats by device/time window.

Backend highlights
- Fastify API with endpoints under `/api/v1`: devices, measurements, predictions, health, public.
- Ingest endpoint verifies HMAC (optional), enriches via OpenWeather PM2.5, and computes AQI.
- **ESP Device Support**: Flexible payload format with auto-registration, timestamp fallback, and duplicate prevention.
- Jobs: aggregator/forecaster/alerts (controlled by env flags) and Telegram/email alert services.

---

## ESP Device Integration

### Sending Measurements from ESP Devices

The `/api/v1/ingest` endpoint accepts flexible payload formats from ESP32/ESP8266 devices.

**Example ESP Payload:**
```json
{
  "device_id": "ESP-001",
  "temperature": 32.2,
  "humidity": 64.0,
  "pressure": 990.0,
  "co2eq": 2267.6,
  "iaq": 208.0,
  "aqi": 354,
  "aqiColor": "#7E0023",
  "pm25": 303.51,
  "healthMessage": "Health emergency! Remain indoors.",
  "meta": {
    "rssi": -65,
    "uptime_ms": 123456789
  }
}
```

**Key Features:**
- **Auto-registration**: Unknown devices are automatically registered
- **Timestamp handling**: Server uses current time if not provided
- **Duplicate prevention**: Unique constraint on (device_id, measured_at)
- **Flexible format**: Supports both direct fields and nested `sensors` object
- **No crashes**: Upsert logic prevents errors on duplicate measurements

**Testing ESP Integration:**
```bash
# Run the test script
cd backend
node ../test-esp-ingest.js http://localhost:3000/api/v1
```

**Frontend Display:**
All measurements are displayed on the dashboard with:
- Temperature, Humidity, Pressure
- CO2 equivalent, IAQ Score
- AQI with category and color
- PM2.5 estimation
- Health advisory message
- Full timestamp (date + time)

See `/tmp/ESP_INGESTION_API.md` for complete API documentation and ESP code examples.

---

Quick start (Docker, single-origin)
1) Copy environment template and customize.
```bat
copy .env.sample .env
```
2) Build and run all services (Postgres, Redis, Backend API, Dashboard). Only the dashboard is exposed on port 3000; API calls are proxied via Next.js.
```bat
docker compose up --build
```
3) Open the dashboard.
- URL: http://localhost:3000
- API from the browser: http://localhost:3000/api/v1 (proxied to backend service)

Services & ports
- Dashboard (Next.js): http://localhost:3000 (exposed)
- Backend API (Fastify): not exposed on host; reachable internally as `backend:3000` (proxied by Next.js)
- Postgres: localhost:5432
- Redis: localhost:6379

Environment variables
- Edit `.env` (copied from `.env.sample`). Minimum required for backend to start: 
  - POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
  - JWT_SECRET, API_KEY_SALT
  - OPENWEATHER_API_KEY (free dev key is fine for demo)
  - RESEND_API_KEY (email alerts; can be a placeholder if you won’t send emails)
- For single-origin proxy the default is `NEXT_PUBLIC_API_URL=/api/v1`.

Notes on proxy vs. direct API
- Single-origin avoids CORS by proxying `/api/v1/*` → `http://backend:3000/api/v1/*` inside Docker (see `dashboard/next.config.js rewrites`).
- If you need a public API endpoint directly on the host, expose the backend by adding `ports: ["3001:3000"]` to the backend service and set `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`.

Seed data (optional)
- There’s a seed container profile you can run once the DB is up (if a seed script is provided):
```bat
docker compose --profile seed up --build
```
- Alternatively, use demo fallbacks in the UI or Alerts → “Send test alert” to create synthetic data.

Demo flow (3 minutes)
1) Map: view devices and AQI markers; search to open the public city view (`/city/{name}`).
2) Devices: open a device → trends and WHO guideline badge.
3) Alerts: set threshold and “Send test alert” (posts to `/api/v1/ingest`).
4) Reports: select a device/date range, preview, and export CSV.

Troubleshooting
- Dashboard cannot fetch API: check http://localhost:3000/api/v1/health. If it fails, ensure containers are running and the rewrite is in place (see `dashboard/next.config.js`).
- CORS errors: not expected in single-origin mode. If you expose the backend directly, ensure `CORS_ORIGIN=http://localhost:3000`.
- Missing data: use Alerts → “Send test alert” to generate a synthetic measurement.

Quality gates
- Build: PASS (backend `npm run build`, dashboard `npm run build`)
- Lint/Typecheck: PASS (Next build includes type checks)

Next steps / Roadmap
- Persist alert settings and add SMS via Twilio.
- Device provisioning UI (QR with device key), public OpenAPI link.
- ML: enhance forecast confidence ribbons; anomaly detection.
- Hardware: sensor upgrades (SCD4x/ENS160/MiCS-6814).

License and disclaimers
- Data is provided as-is; not medical advice. MQ135-derived gases are “estimated”; for accurate CO/NO2/CO2, use appropriate sensors.
