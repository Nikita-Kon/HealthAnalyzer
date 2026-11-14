// Body map: which organ / region is affected, derived only from the analytics response.
import type { Analytics, MetricId } from '@/api/types'
import { META, fmt } from './metrics'
import { isAnomaly, metricStatus, worst, type Hazard, type Status } from './status'

export type Organ = 'brain' | 'heart' | 'lungs' | 'muscles'

export interface OrganState {
  organ: Organ
  title: string
  system: string
  status: Status
  metrics: MetricId[]
  detail: string
  hazard: Hazard
}

const GROUPS: { organ: Organ; title: string; system: string; metrics: MetricId[]; hazard: Hazard }[] = [
  { organ: 'brain', title: 'Brain', system: 'Sleep & behavioural health', metrics: ['stress', 'mood', 'sleep_duration', 'sleep_score'], hazard: 'isolation' },
  { organ: 'heart', title: 'Heart', system: 'Cardiovascular', metrics: ['resting_heart_rate'], hazard: 'environment' },
  { organ: 'muscles', title: 'Muscles', system: 'Load & recovery', metrics: ['exercise_duration', 'fatigue', 'readiness'], hazard: 'gravity' },
  { organ: 'lungs', title: 'Lungs', system: 'Respiratory', metrics: [], hazard: 'environment' },
]

export function bodyMap(a?: Analytics): OrganState[] {
  return GROUPS.map((g) => {
    if (!g.metrics.length) return { ...g, status: 'unknown' as Status, detail: 'Not measured in PMData — slot for SpO₂ / respiration rate.' }
    const st = worst(...g.metrics.map((m) => metricStatus(a, m)))
    const flagged = (a?.findings ?? []).filter((f) => g.metrics.includes(f.metric) && isAnomaly(f.status))
    const detail = flagged.length
      ? flagged.map((f) => `${META[f.metric].short} ${fmt(f.metric, f.current)} vs ${fmt(f.metric, f.baseline)}`).join(' · ')
      : st === 'unknown'
        ? 'Not enough recent data for a personal baseline'
        : 'Within personal baseline'
    return { ...g, status: st, detail }
  })
}
