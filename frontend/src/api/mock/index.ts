// Mock implementation of the /api/v1 contract — same JSON shapes as FastAPI.
import type { Analytics, Astronaut, AstronautListItem, MeasurementPage, MetricId, MetricInfo, Summary } from '../types'
import { DAYS, IDS, START, addDays, dayIndex, series } from './data'
import { UNITS, analyze } from './analytics'

const wait = <T,>(v: T, ms = 40) => new Promise<T>((r) => setTimeout(() => r(v), ms))
const name = (id: string) => `Demo Crew ${id.toUpperCase()}`
const notFound = (what: string) => Promise.reject(Object.assign(new Error(`404 ${what} not found`), { status: 404 }))
const aCache = new Map<string, Analytics>()

export const mockApi = {
  health: () => wait({ status: 'ok' }),
  astronauts: () => wait<{ data: AstronautListItem[] }>({ data: IDS.map((id) => ({ id, name: name(id), source: 'pmdata' })) }),
  astronaut: (id: string): Promise<Astronaut> => {
    if (!IDS.includes(id)) return notFound('participant')
    const s = series(id).resting_heart_rate
    const first = s.findIndex((v) => v != null)
    let last = s.length - 1
    while (last > 0 && s[last] == null) last--
    return wait({ id, name: name(id), source: 'pmdata', first_record_date: addDays(START, first), last_record_date: addDays(START, last) })
  },
  metrics: () => wait<{ data: MetricInfo[] }>({ data: (Object.keys(UNITS) as MetricId[]).map((metric) => ({ metric, unit: UNITS[metric] })) }),
  measurements: (id: string, metric: MetricId, from?: string, to?: string, limit = 1000, offset = 0): Promise<MeasurementPage> => {
    if (!IDS.includes(id)) return notFound('participant')
    const v = series(id)[metric]
    if (!v) return notFound('metric')
    const a = from ? Math.max(0, dayIndex(from)) : 0
    const b = to ? Math.min(DAYS - 1, dayIndex(to)) : DAYS - 1
    const all = []
    for (let i = a; i <= b; i++) if (v[i] != null) all.push({ date: addDays(START, i), value: v[i]! })
    return wait({ participant_id: id, metric, unit: UNITS[metric], data: all.slice(offset, offset + Math.min(limit, 1000)), total: all.length, limit, offset })
  },
  summary: (id: string, asOf: string): Promise<Summary> => {
    const s = series(id), d = dayIndex(asOf)
    const metrics: Summary['metrics'] = {}
    for (const m of Object.keys(s) as MetricId[]) {
      for (let i = Math.min(d, DAYS - 1); i >= 0; i--) if (s[m][i] != null) { metrics[m] = { value: s[m][i]!, unit: UNITS[m], measured_at: addDays(START, i) }; break }
    }
    return wait({ participant_id: id, as_of: asOf, metrics })
  },
  analytics: (id: string, asOf: string): Promise<Analytics> => {
    const key = id + asOf
    let a = aCache.get(key)
    if (!a) {
      a = analyze(id, series(id), Math.min(dayIndex(asOf), DAYS - 1), asOf)
      aCache.set(key, a)
    }
    return wait(a, 25)
  },
}
