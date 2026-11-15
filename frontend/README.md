# AstroHealth — frontend (team Metamorphosis)

React 19 + Vite 8 + TypeScript + Tailwind 4 + Recharts 3 + TanStack Query + motion + three / react-three-fiber.
Implements spec §9.4: participant selection, dashboard of current metrics, history charts, Replay (Play / Pause / Restart / Speed / date),
notifications with explanations and "not enough data" states — plus a 3D body map driven by the analytics response.

## Run
```bash
cd frontend
npm install            # .npmrc has legacy-peer-deps=true
npm run dev            # http://localhost:5173 — mock data by default
```

## Connect the backend
```bash
# frontend/.env
VITE_API_URL=/api/v1   # Vite proxies /api → http://localhost:8000 (FastAPI)
```
When your domain forwards to port 5000, keep `VITE_API_URL=/api/v1`. The browser
requests `/api/v1` on your domain; Vite forwards it locally to port 8000. Port 8000
does not need to be exposed separately. Restart Vite after changing environment
variables. Use `VITE_API_URL=mock` only for mock data.

Against the deployed backend (it has no CORS, so go through the proxy):
```bash
API_PROXY=https://demo.nikitak.dev VITE_API_URL=/api/v1 npm run dev
```

## Deploy on the API domain
`npm run build` produces `frontend/dist`, which talks to `/api/v1` on its own domain. FastAPI serves it at `/`
automatically when `frontend/dist/index.html` exists (or set `FRONTEND_DIST`), so one uvicorn process serves both:
```bash
cd frontend && npm ci && npm run build
cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8000   # restart after each rebuild
```
Contract: spec §6 — `GET /astronauts`, `/astronauts/{id}`, `/metrics`, `/astronauts/{id}/measurements`,
`/astronauts/{id}/summary?as_of=`, `/astronauts/{id}/analytics?as_of=`. Types: `src/api/types.ts`.
`VITE_API_URL=mock` (optional; default only for single-file demos) uses `src/api/mock/*` — same JSON shapes; `mock/analytics.ts` is a TypeScript reference of
spec §7 (median baseline over 14 days, ≥ 7 samples, median + MAD anomalies, combined rules, 7-day trend).

## Heart-rate replay
- Previous/next buttons select the day. Playback never advances the date.
- Play/pause, restart, a seconds slider and an exact time input control the selected day's recorded heart rate.
- Speeds are 1x (one recorded second per real second), 60x, 600x and 3600x.
- Samples are fetched from `/astronauts/{id}/heart-rate` for that day, paginated in batches of 10,000 and cached by participant/date. Requests are cancelled when their query becomes inactive.
- Current BPM and the 3D heartbeat use the last sample at or before the selected second. Confidence 0 samples are excluded. A gap over 60 seconds shows no current value and stops the heart animation. Null confidence is displayed as unknown.
- The intraday chart shows the preceding 15 minutes and does not draw future samples or bridge gaps over 60 seconds. Playback stops at the last available sample.
- Daily resting HR, daily history and baseline analysis remain separate and use the selected calendar date. They include the day's observations, so they are not intraday as-of-time analysis.
- Play is disabled when the selected participant/day has no usable samples, during loading, or in mock mode (which has no recorded heart-rate samples).

## Structure
```
src/api/          client.ts, types.ts, mock/
src/hooks/        useReplay.ts, useHealthData.ts
src/lib/          metrics.ts, status.ts (crew/metric status from analytics), body.ts (organ map)
src/components/   Replay, Crew (rail + strip), Vitals, Notifications, HistoryChart, body/ (3D)
src/pages/        Dashboard.tsx
tools/            offline pipeline for the 3D body model
```

## Notes
- `?lite` in the URL disables the 3D scene (also off automatically without WebGL); the scene pauses when off-screen
  and lowers its resolution on slow GPUs.
- `npm run build:single` → `dist-single/index.html`, the whole app in one file for quick demos.
- 3D body: MakeHuman base mesh (CC0); skeleton & organs from Z-Anatomy / BodyParts3D (CC BY-SA 4.0), adapted — keep the footer attribution.

## Live simulation and reserved days

The final three calendar days of the combined dataset are reserved from normal
replay. In the current dataset these are 29–31 March 2020. Historical day buttons,
the date picker, and history requests stop on 28 March. Click the displayed date
to open the custom calendar; reserved dates are disabled.

Start live simulation creates a backend session at midnight on the first reserved
day. The server uses elapsed monotonic time to release only heart-rate samples
whose recorded timestamps have arrived. React polls every 5 seconds with an
incremental cursor and caches a 15-minute chart window. Data never advances
faster than 1x; seeking and playback speed changes are unavailable in live mode.
The simulation crosses midnight automatically and finishes after three real days.
Stop returns to the last historical day. Restarting starts a fresh session.

Daily history, summaries and alerts use completed days during simulation, while
current BPM, the intraday chart and 3D heartbeat follow newly released samples.
There is no invented measurement when a participant has no readings. Connection
errors are shown in the intraday panel and polling retries on its next interval.

Sessions are process-local and are lost on backend restart; stop/start the
simulation after a restart. This development feature expects a single backend
worker; shared/persistent sessions would be needed for multi-worker deployment.
Raw data endpoints remain available for diagnostics; the three-day reservation
is an application workflow, not an access-control restriction. The backend
simulation endpoint itself enforces its real-time cutoff.
