// REST contract from the HealthAnalyzer MVP spec (section 6). Base URL: /api/v1
// Keep in sync with backend/app/schemas/*. Change only by agreement with the team.

export type MetricId =
  | 'resting_heart_rate'
  | 'sleep_duration'
  | 'sleep_score'
  | 'stress'
  | 'mood'
  | 'fatigue'
  | 'exercise_duration'
  | 'readiness'

/** GET /astronauts → { data: AstronautListItem[] } */
export interface AstronautListItem {
  id: string // "p01"
  name: string // "Demo Crew P01"
  source: string // "pmdata"
}

/** GET /astronauts/{id} */
export interface Astronaut extends AstronautListItem {
  first_record_date: string | null // ISO date
  last_record_date: string | null
}

/** GET /metrics */
export interface MetricInfo {
  metric: MetricId
  unit: string
  description?: string
}

/** GET /astronauts/{id}/measurements?metric=&from_date=&to_date=&limit=&offset= */
export interface MeasurementPage {
  participant_id: string
  metric: MetricId
  unit: string
  data: { date: string; value: number }[]
  total: number
  limit: number
  offset: number
}

/** GET /astronauts/{id}/summary?as_of= */
export interface Summary {
  participant_id: string
  as_of: string
  metrics: Partial<Record<MetricId, { value: number; unit: string; measured_at: string }>>
}

export type AnalyticsStatus = 'no_change_detected' | 'change_detected' | 'insufficient_data'

export interface Finding {
  metric: MetricId
  status: string // "statistical_anomaly" | "normal" | "insufficient_data" | …
  current: number | null
  baseline: number | null
  unit: string
  deviation_percent: number | null
  method: string // "personal_baseline"
  sample_count: number
  message: string
  trend?: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data'
}

export interface CombinedFinding {
  metrics: MetricId[]
  message: string
}

/** GET /astronauts/{id}/analytics?as_of= */
export interface Analytics {
  participant_id: string
  as_of: string
  status: AnalyticsStatus
  findings: Finding[]
  combined_findings: CombinedFinding[]
}
