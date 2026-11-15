// Deterministic PMData-like demo data (16 participants, Nov 2019 – Mar 2020).
// Same field semantics as the real import: one value per participant / metric / day, gaps stay gaps.
import type { MetricId } from '../types'

export const START = '2019-11-01'
export const DAYS = 152
export const IDS = Array.from({ length: 16 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`)

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const dayIndex = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(START + 'T00:00:00Z')) / 864e5)

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export type Series = Record<MetricId, (number | null)[]>
const cache = new Map<string, Series>()
const stepCache = new Map<string, (number | null)[]>()

export function series(id: string): Series {
  const hit = cache.get(id)
  if (hit) return hit
  const k = IDS.indexOf(id)
  const r = mulberry32(4242 + k * 977)
  const n = (a: number) => (r() - 0.5) * 2 * a
  const rhr0 = 50 + r() * 16
  const sleep0 = 6.6 + r() * 1.4
  const fit = 0.5 + r() * 0.8
  const gappy = k === 6 || k === 11 // two participants with poor wearable compliance
  // strain episodes: elevated HR + short sleep + fatigue (what the combined detector should catch)
  const eps = Array.from({ length: 1 + Math.floor(r() * 2) }, () => {
    const s = 22 + Math.floor(r() * 118)
    return [s, s + 3 + Math.floor(r() * 4)] as const
  })
  // P01 gets a clear demo episode (spec §11: "demo period with a noticeable change")
  if (k === 0) eps.splice(0, eps.length, [64, 69], [118, 121])
  const strain = (d: number) => eps.some(([a, b]) => d >= a && d <= b)
  const iso = (d: number) => Math.exp(-(((d - 100) / 20) ** 2)) * (0.5 + r() * 0.2) // mid-mission dip

  const steps: (number | null)[] = []
  const out: Series = { resting_heart_rate: [], sleep_duration: [], sleep_score: [], stress: [], mood: [], fatigue: [], exercise_duration: [], readiness: [] }
  for (let d = 0; d < DAYS; d++) {
    const ep = strain(d)
    const is = iso(d)
    const worn = r() > (gappy ? 0.25 : 0.035)
    const asked = r() > (gappy ? 0.35 : 0.09)
    const trained = r() < 0.55 * fit && !ep
    const sleepH = clamp(sleep0 + n(0.7) - (ep ? 1.6 + r() * 0.6 : 0) - is * 0.6, 3.2, 10)
    out.resting_heart_rate.push(worn ? Math.round(rhr0 + n(1.8) + (ep ? 7 + r() * 4 : 0) + is * 2) : null)
    out.sleep_duration.push(worn ? Math.round(sleepH * 10) / 10 : null)
    out.sleep_score.push(worn ? Math.round(clamp(52 + sleepH * 4.2 + n(5) - (ep ? 6 : 0), 30, 97)) : null)
    const w = (b: number, push: number) => (asked ? Math.round(clamp(b + n(0.8) + push, 1, 5)) : null)
    out.stress.push(w(2.2, (ep ? 1.6 : 0) + is * 1.8))
    out.mood.push(w(3.9, -(ep ? 1.3 : 0) - is * 1.6))
    out.fatigue.push(w(2.3, (ep ? 2 : 0) + is * 1.1))
    out.readiness.push(asked ? Math.round(clamp(7.2 + n(1.4) - (ep ? 3.5 : 0) - is * 2, 0, 10)) : null)
    out.exercise_duration.push(trained ? Math.round(clamp(30 + 40 * fit + n(25), 10, 150)) : null)
    steps.push(worn ? Math.round(clamp(5200 + 4200 * fit + n(1800) + (trained ? 3500 : 0) - (ep ? 3800 : 0) - is * 2600, 900, 24000)) : null)
  }
  stepCache.set(id, steps)
  cache.set(id, out)
  return out
}

export function stepSeries(id: string) {
  series(id)
  return stepCache.get(id)!
}
