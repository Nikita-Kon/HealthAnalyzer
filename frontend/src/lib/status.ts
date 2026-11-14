import { CircleCheck, CircleDashed, Siren, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { Analytics, MetricId } from '@/api/types'

export type Status = 'nominal' | 'watch' | 'alert' | 'unknown'
export type Hazard = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment'

export const STATUS: Record<Status, { label: string; color: string; icon: LucideIcon; rank: number }> = {
  alert: { label: 'Alert', color: 'var(--color-alert)', icon: Siren, rank: 0 },
  watch: { label: 'Watch', color: 'var(--color-watch)', icon: TriangleAlert, rank: 1 },
  nominal: { label: 'Nominal', color: 'var(--color-nominal)', icon: CircleCheck, rank: 2 },
  unknown: { label: 'Not enough data', color: 'var(--color-ink-3)', icon: CircleDashed, rank: 3 },
}

/** NASA Human Research Program RIDGE hazards — used as tags on metrics */
export const HAZARD: Record<Hazard, { letter: string; label: string }> = {
  radiation: { letter: 'R', label: 'Radiation' },
  isolation: { letter: 'I', label: 'Isolation & confinement' },
  distance: { letter: 'D', label: 'Distance from Earth' },
  gravity: { letter: 'G', label: 'Altered gravity' },
  environment: { letter: 'E', label: 'Hostile closed environment' },
}

export const isAnomaly = (status: string) => status === 'statistical_anomaly' || status === 'anomaly'

/** Crew-level status from the analytics response */
export function crewStatus(a?: Analytics): Status {
  if (!a) return 'unknown'
  if (a.status === 'insufficient_data') return 'unknown'
  if (a.status === 'no_change_detected') return 'nominal'
  const n = a.findings.filter((f) => isAnomaly(f.status)).length
  return a.combined_findings.length > 0 || n >= 2 ? 'alert' : 'watch'
}

/** Per-metric status */
export function metricStatus(a: Analytics | undefined, m: MetricId): Status {
  const f = a?.findings.find((x) => x.metric === m)
  if (!f || f.status === 'insufficient_data') return 'unknown'
  if (!isAnomaly(f.status)) return 'nominal'
  return a!.combined_findings.some((c) => c.metrics.includes(m)) ? 'alert' : 'watch'
}

export const worst = (...s: Status[]): Status => s.reduce((a, b) => (STATUS[b].rank < STATUS[a].rank ? b : a), 'unknown' as Status)
