import { useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { api, fetchHistory } from '@/api/client'
import type { MetricId } from '@/api/types'
import { METRICS } from '@/lib/metrics'

export type History = Partial<Record<MetricId, { date: string; value: number }[]>>

export const useAstronauts = () =>
  useQuery({ queryKey: ['astronauts'], queryFn: async () => (await api.astronauts()).data, staleTime: Infinity })

export const useAstronaut = (id: string | null) =>
  useQuery({ queryKey: ['astronaut', id], queryFn: () => api.astronaut(id!), enabled: !!id, staleTime: Infinity })

/** Full history of every metric for one participant, fetched once. Never rendered past the replay date. */
export function useHistory(id: string | null) {
  const qs = useQueries({
    queries: METRICS.map((m) => ({
      queryKey: ['history', id, m.id],
      queryFn: () => fetchHistory(id!, m.id),
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

export const useAnalytics = (id: string | null, asOf: string) =>
  useQuery({ queryKey: ['analytics', id, asOf], queryFn: () => api.analytics(id!, asOf), enabled: !!id, placeholderData: keepPreviousData, staleTime: Infinity })

export const useSummary = (id: string | null, asOf: string) =>
  useQuery({ queryKey: ['summary', id, asOf], queryFn: () => api.summary(id!, asOf), enabled: !!id, placeholderData: keepPreviousData, staleTime: Infinity })

export function useCrewAnalytics(ids: string[], asOf: string) {
  const qs = useQueries({
    queries: ids.map((id) => ({ queryKey: ['analytics', id, asOf], queryFn: () => api.analytics(id, asOf), placeholderData: keepPreviousData, staleTime: Infinity })),
  })
  const key = qs.map((q) => q.dataUpdatedAt).join()
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
