// Reference implementation of spec §7 (personal baseline, median + MAD anomalies, combined changes, trends),
// used by the mock API. The real one lives in backend/app/services/*.py — this mirrors its JSON output.
import type { Analytics, CombinedFinding, Finding, MetricId } from '../types'
import { META } from '@/lib/metrics'

export const UNITS: Record<MetricId, string> = { resting_heart_rate: 'bpm', sleep_duration: 'hours', sleep_score: 'score', stress: 'scale', mood: 'scale', fatigue: 'scale', exercise_duration: 'minutes', readiness: 'scale' }

export const PARAMS = {
  baselineDays: 14, // previous calendar days used for the baseline
  minSamples: 7, // minimum valid observations
  zThreshold: 3, // robust z-score threshold
  maxStaleDays: 2, // a "current" value older than this is not current
  madFloor: { resting_heart_rate: 1.5, sleep_duration: 0.35, sleep_score: 3, stress: 0.5, mood: 0.5, fatigue: 0.5, exercise_duration: 8, readiness: 0.8 } as Record<MetricId, number>,
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function analyzeMetric(metric: MetricId, values: (number | null)[], asOf: number): Finding {
  const unit = UNITS[metric]
  let ci = -1
  for (let i = asOf; i >= Math.max(0, asOf - PARAMS.maxStaleDays); i--) if (values[i] != null) { ci = i; break }
  const hist = values.slice(Math.max(0, (ci < 0 ? asOf : ci) - PARAMS.baselineDays), ci < 0 ? asOf : ci).filter((v): v is number => v != null)
  const base = { metric, unit, method: 'personal_baseline', sample_count: hist.length }
  if (ci < 0 || hist.length < PARAMS.minSamples)
    return { ...base, status: 'insufficient_data', current: ci < 0 ? null : values[ci], baseline: hist.length ? median(hist) : null, deviation_percent: null, message: ci < 0 ? 'No recent measurement' : `Only ${hist.length} of ${PARAMS.minSamples} required observations in the last ${PARAMS.baselineDays} days`, trend: 'insufficient_data' }
  const cur = values[ci]!
  const med = median(hist)
  const mad = Math.max(median(hist.map((x) => Math.abs(x - med))) * 1.4826, PARAMS.madFloor[metric])
  const z = (cur - med) / mad
  const dev = med === 0 ? null : Math.round(((cur - med) / med) * 10000) / 100
  const last7 = values.slice(Math.max(0, ci - 6), ci + 1).filter((v): v is number => v != null)
  const prev7 = values.slice(Math.max(0, ci - 13), ci - 6).filter((v): v is number => v != null)
  let trend: Finding['trend'] = 'insufficient_data'
  if (last7.length >= 3 && prev7.length >= 3) {
    const a = last7.reduce((s, x) => s + x, 0) / last7.length, b = prev7.reduce((s, x) => s + x, 0) / prev7.length
    trend = Math.abs(a - b) < mad * 0.5 ? 'stable' : a > b ? 'increasing' : 'decreasing'
  }
  const anomalous = Math.abs(z) >= PARAMS.zThreshold
  const dir = cur > med ? 'above' : 'below'
  return {
    ...base,
    status: anomalous ? 'statistical_anomaly' : 'normal',
    current: cur,
    baseline: Math.round(med * 100) / 100,
    deviation_percent: dev,
    message: anomalous ? `${META[metric].label} is ${dir} personal baseline` : `${META[metric].label} is within personal baseline`,
    trend,
  }
}

const RULES: { a: MetricId[]; b: MetricId[]; msg: (fa: Finding, fb: Finding) => string }[] = [
  { a: ['resting_heart_rate'], b: ['sleep_duration'], msg: () => 'Elevated resting heart rate coincides with reduced sleep duration' },
  { a: ['sleep_duration', 'sleep_score'], b: ['fatigue'], msg: () => 'Insufficient sleep together with increased fatigue' },
  { a: ['stress'], b: ['sleep_duration', 'sleep_score'], msg: () => 'Increased stress together with a change in sleep' },
  { a: ['exercise_duration'], b: ['fatigue', 'readiness'], msg: () => 'Change in training load together with a change in subjective recovery' },
]

export function analyze(participant: string, s: Record<MetricId, (number | null)[]>, asOf: number, asOfIso: string): Analytics {
  const findings = (Object.keys(s) as MetricId[]).map((m) => analyzeMetric(m, s[m], asOf))
  const anomalous = (m: MetricId) => {
    // flagged today or in the previous 2 days → "comparable time interval"
    for (let d = 0; d <= 2; d++) if (analyzeMetric(m, s[m], asOf - d).status === 'statistical_anomaly') return analyzeMetric(m, s[m], asOf - d)
    return null
  }
  const combined: CombinedFinding[] = []
  for (const r of RULES) {
    const fa = r.a.map(anomalous).find(Boolean)
    const fb = r.b.map(anomalous).find(Boolean)
    if (fa && fb && fa.metric !== fb.metric) combined.push({ metrics: [fa.metric, fb.metric], message: r.msg(fa, fb) })
  }
  const valid = findings.filter((f) => f.status !== 'insufficient_data')
  const status = valid.length < 2 ? 'insufficient_data' : findings.some((f) => f.status === 'statistical_anomaly') || combined.length ? 'change_detected' : 'no_change_detected'
  return { participant_id: participant, as_of: asOfIso, status, findings, combined_findings: combined }
}
