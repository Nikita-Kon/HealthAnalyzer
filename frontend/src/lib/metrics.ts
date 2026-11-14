import type { MetricId } from '@/api/types'
import type { Hazard } from './status'

export interface MetricMeta {
  id: MetricId
  label: string
  short: string
  unit: string
  /** which direction is "worse" for the body map / colouring */
  worse: 'up' | 'down'
  hazard: Hazard
  digits: number
  domain?: [number, number]
}

export const METRICS: MetricMeta[] = [
  { id: 'resting_heart_rate', label: 'Resting heart rate', short: 'Resting HR', unit: 'bpm', worse: 'up', hazard: 'environment', digits: 0 },
  { id: 'sleep_duration', label: 'Sleep duration', short: 'Sleep', unit: 'h', worse: 'down', hazard: 'isolation', digits: 1 },
  { id: 'sleep_score', label: 'Sleep score', short: 'Sleep score', unit: '', worse: 'down', hazard: 'isolation', digits: 0, domain: [0, 100] },
  { id: 'stress', label: 'Stress', short: 'Stress', unit: '/5', worse: 'up', hazard: 'isolation', digits: 0, domain: [1, 5] },
  { id: 'mood', label: 'Mood', short: 'Mood', unit: '/5', worse: 'down', hazard: 'isolation', digits: 0, domain: [1, 5] },
  { id: 'fatigue', label: 'Fatigue', short: 'Fatigue', unit: '/5', worse: 'up', hazard: 'isolation', digits: 0, domain: [1, 5] },
  { id: 'exercise_duration', label: 'Exercise', short: 'Exercise', unit: 'min', worse: 'down', hazard: 'gravity', digits: 0 },
  { id: 'readiness', label: 'Readiness', short: 'Readiness', unit: '/10', worse: 'down', hazard: 'gravity', digits: 0, domain: [0, 10] },
]
export const META = Object.fromEntries(METRICS.map((m) => [m.id, m])) as Record<MetricId, MetricMeta>

export const fmt = (id: MetricId, v: number | null | undefined) => (v == null || Number.isNaN(v) ? '—' : v.toFixed(META[id].digits))
