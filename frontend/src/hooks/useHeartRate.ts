import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchHeartRateDay } from '@/api/client'
import { replay, useSeconds } from './useReplay'

export function useHeartRate(id: string, date: string) {
  const seconds = useSeconds()
  const query = useQuery({
    queryKey: ['heart-rate', id, date],
    queryFn: ({ signal }) => fetchHeartRateDay(id, date, signal),
    enabled: !!id, staleTime: Infinity,
  })
  const samples = useMemo(() => (query.data ?? []).filter(s => s.bpm > 0 && s.confidence !== 0).map(s => {
    const [h, m, sec] = s.recorded_at.slice(11).split(':').map(Number)
    return { ...s, second: h * 3600 + m * 60 + sec }
  }), [query.data])
  useEffect(() => {
    replay.timeRange(samples[0]?.second ?? 0, samples.at(-1)?.second ?? 86399, samples.length > 0)
    return () => replay.pause()
  }, [id, date, samples])
  // Last recorded sample at or before the selected time; never use future data.
  let lo = 0, hi = samples.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (samples[mid].second <= seconds) lo = mid + 1; else hi = mid }
  const sample = samples[lo - 1]
  const current = sample && seconds - sample.second <= 60 ? sample : null
  return { ...query, samples, current, seconds }
}
