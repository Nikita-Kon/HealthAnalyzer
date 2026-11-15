import { useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { isoAt, useDay, useLive, useStart, useTotalDays } from './useReplay'
import { api, fetchHistory } from '@/api/client'
import type { Analytics, MetricId } from '@/api/types'
import { METRICS } from '@/lib/metrics'

export type History = Partial<Record<MetricId, { date: string; value: number }[]>>

export const useAstronauts = () =>
  useQuery({ queryKey: ['astronauts'], queryFn: async () => (await api.astronauts()).data, staleTime: Infinity })

export const useAstronaut = (id: string | null) =>
  useQuery({ queryKey: ['astronaut', id], queryFn: () => api.astronaut(id!), enabled: !!id, staleTime: Infinity })

/** Full history of every metric for one participant, fetched once. Never rendered past the replay date. */
export function useHistoryCutoff() {
  const live = useLive(), start = useStart(), days = useTotalDays(), day = useDay()
  return isoAt(start, live ? Math.max(0, day - 1) : Math.max(0, days - 4))
}
export function useHistory(id: string | null) {
  const cutoff = useHistoryCutoff()
  const qs = useQueries({
    queries: METRICS.map((m) => ({
      queryKey: ['history', id, m.id, cutoff],
      queryFn: () => fetchHistory(id!, m.id, undefined, cutoff),
      enabled: !!id,
      staleTime: Infinity,
    })),
  })
  const loading = qs.some((q) => q.isPending)
  const error = qs.find((q) => q.error)?.error ?? null
  const dataKey = qs.map((q) => q.dataUpdatedAt).join()
  const data = useMemo<History>(() => {
    const h: History = {}
    METRICS.forEach((m, i) => {
      const d = qs[i].data
      if (d) h[m.id] = d.data
    })
    return h
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])
  return { data, loading, error }
}

/** Histories for all crew members for one metric (rail sparklines) */
export function useCrewMetric(ids: string[], metric: MetricId) {
  const qs = useQueries({
    queries: ids.map((id) => ({ queryKey: ['history', id, metric], queryFn: () => fetchHistory(id, metric), staleTime: Infinity })),
  })
  const key = qs.map((q) => q.dataUpdatedAt).join()
  return useMemo(() => Object.fromEntries(ids.map((id, i) => [id, qs[i].data?.data ?? []])), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Daily step history for the activity panel */
export const useSteps = (id: string | null) => {
  const cutoff = useHistoryCutoff()
  return useQuery({ queryKey: ['history', id, 'steps', cutoff], queryFn: () => fetchHistory(id!, 'steps', undefined, cutoff), enabled: !!id, staleTime: Infinity })
}

export const useAnalytics = (id: string | null, asOf: string) =>
  useQuery({ queryKey: ['analytics', id, asOf], queryFn: () => api.analytics(id!, asOf), enabled: !!id, placeholderData: keepPreviousData, staleTime: Infinity })

export const useSummary = (id: string | null, asOf: string) =>
  useQuery({ queryKey: ['summary', id, asOf], queryFn: () => api.summary(id!, asOf), enabled: !!id, placeholderData: keepPreviousData, staleTime: Infinity })

export function useCrewAnalytics(ids: string[], asOf: string) {
  const client = useQueryClient()
  // keepPreviousData doesn't carry over inside useQueries — fall back to the closest cached day so the rail never blanks during replay
  const closest = (id: string) => {
    let best: Analytics | undefined
    for (const [, a] of client.getQueriesData<Analytics>({ queryKey: ['analytics', id] }))
      if (a && (!best || Math.abs(Date.parse(a.as_of) - Date.parse(asOf)) < Math.abs(Date.parse(best.as_of) - Date.parse(asOf)))) best = a
    return best
  }
  const qs = useQueries({
    queries: ids.map((id) => ({ queryKey: ['analytics', id, asOf], queryFn: () => api.analytics(id, asOf), placeholderData: () => closest(id), staleTime: Infinity })),
  })
  const key = qs.map((q) => `${q.data?.as_of}:${q.dataUpdatedAt}`).join()
  return useMemo(() => Object.fromEntries(ids.map((id, i) => [id, qs[i].data])), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Throttle a fast-changing value (replay at high speed) so we don't flood the API */
export function useThrottled<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  const lastAt = useRef(0)
  useEffect(() => {
    if (ms <= 0) {
      setV(value)
      return
    }
    const now = performance.now()
    const wait = Math.max(0, lastAt.current + ms - now)
    const t = setTimeout(() => {
      lastAt.current = performance.now()
      setV(value)
    }, wait)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** values ≤ asOf only — the "no future leak" rule (spec §8) */
export const upTo = (rows: { date: string; value: number }[] | undefined, asOf: string) => {
  if (!rows) return []
  let hi = rows.length
  while (hi > 0 && rows[hi - 1].date > asOf) hi--
  return rows.slice(0, hi)
}
