// API client for the HealthAnalyzer backend (FastAPI, /api/v1) with a drop-in mock.
// VITE_API_URL: "mock" → built-in mock; "/api/v1" → backend through the Vite dev proxy; or a full URL.
// Default: same-domain API (proxied by Vite in dev); mock only for the single-file demo.
import type { ActivityId, Analytics, Astronaut, AstronautListItem, MeasurementPage, MetricId, MetricInfo, Summary } from './types'
import { mockApi } from './mock'

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? (import.meta.env.MODE === 'single' ? 'mock' : '/api/v1')).replace(/\/$/, '')
export const USING_MOCK = BASE === 'mock' || BASE === ''

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const qs = params
    ? '?' + Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
    : ''
  const res = await fetch(`${BASE}${path}${qs}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    let msg = `${res.status} ${path}`
    try {
      const j = await res.json()
      msg = typeof j?.detail === 'string' ? j.detail : msg
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, msg)
  }
  return res.json() as Promise<T>
}

/** GET /metrics may be a bare array or { data: [...] } — accept both */
const unwrap = <T,>(x: T[] | { data: T[] }) => (Array.isArray(x) ? x : x.data)

export const api = USING_MOCK
  ? mockApi
  : {
      health: () => get<{ status: string }>('/health'),
      astronauts: () => get<{ data: AstronautListItem[] }>('/astronauts'),
      astronaut: (id: string) => get<Astronaut>(`/astronauts/${id}`),
      metrics: async () => ({ data: unwrap(await get<MetricInfo[] | { data: MetricInfo[] }>('/metrics')) }),
      measurements: (id: string, metric: MetricId | ActivityId, from?: string, to?: string, limit = 1000, offset = 0) =>
        get<MeasurementPage>(`/astronauts/${id}/measurements`, { metric, from_date: from, to_date: to, limit, offset }),
      summary: (id: string, asOf: string) => get<Summary>(`/astronauts/${id}/summary`, { as_of: asOf }),
      analytics: (id: string, asOf: string) => get<Analytics>(`/astronauts/${id}/analytics`, { as_of: asOf }),
    }

/** Fetch a whole metric history (paginates past the 1000-row limit) */
export async function fetchHistory(id: string, metric: MetricId | ActivityId, from?: string, to?: string) {
  const out: MeasurementPage['data'] = []
  let offset = 0
  for (;;) {
    const p = await api.measurements(id, metric, from, to, 1000, offset)
    out.push(...p.data)
    offset += p.data.length
    if (!p.data.length || offset >= p.total) return { unit: p.unit, data: out }
  }
}

export interface HeartRateSample { recorded_at: string; bpm: number; confidence: number | null }
export async function fetchHeartRateDay(id: string, date: string, signal: AbortSignal): Promise<HeartRateSample[]> {
  if (USING_MOCK) return []
  const out: HeartRateSample[] = []
  for (let offset = 0; ; offset += 10000) {
    const params = new URLSearchParams({ start: `${date}T00:00:00`, end: `${date}T23:59:59.999999`, limit: '10000', offset: String(offset) })
    const res = await fetch(`${BASE}/astronauts/${encodeURIComponent(id)}/heart-rate?${params}`, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new ApiError(res.status, 'Unable to load heart-rate samples')
    const page = await res.json() as HeartRateSample[]
    out.push(...page)
    if (page.length < 10000) return out
  }
}

export interface SimulationSession { session_id: string; simulated_at: string; ends_at: string }
export async function startSimulation(): Promise<SimulationSession> {
  if (USING_MOCK) throw new Error('Live simulation requires the backend database.')
  const res = await fetch(`${BASE}/simulation/start`, { method: 'POST' })
  if (!res.ok) throw new Error(`Cannot start simulation (${res.status}). Check that the updated backend is running.`)
  return res.json()
}
export async function stopSimulation(id: string) {
  await fetch(`${BASE}/simulation/${id}`, { method: 'DELETE' })
}
export async function pollSimulation(session: string, id: string, after: string | null, signal: AbortSignal) {
  const params = new URLSearchParams(after ? { after } : {})
  const res = await fetch(`${BASE}/simulation/${session}/heart-rate/${encodeURIComponent(id)}?${params}`, { signal })
  if (!res.ok) throw new Error('Simulation unavailable. Stop and start it again; the server may have restarted.')
  return res.json() as Promise<{ simulated_at: string; complete: boolean; has_more: boolean; cursor: string; data: HeartRateSample[] }>
}
