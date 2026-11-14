# HealthAnalyzer — frontend

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
Contract: spec §6 — `GET /astronauts`, `/astronauts/{id}`, `/metrics`, `/astronauts/{id}/measurements`,
`/astronauts/{id}/summary?as_of=`, `/astronauts/{id}/analytics?as_of=`. Types: `src/api/types.ts`.
`VITE_API_URL=mock` (default) uses `src/api/mock/*` — same JSON shapes; `mock/analytics.ts` is a TypeScript reference of
spec §7 (median baseline over 14 days, ≥ 7 samples, median + MAD anomalies, combined rules, 7-day trend).

## How Replay works (spec §8)
- `src/hooks/useReplay.ts` — virtual date on `requestAnimationFrame`; components subscribe to the day or the scrubber position only.
- Each metric history is fetched once; anything after the replay date is cut off before rendering (`upTo`).
- Summary + analytics are requested with `as_of` = replay date (throttled at high speeds so the API isn't flooded).

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
