import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchHeartRateDay, pollSimulation, type HeartRateSample } from '@/api/client'
import { replay, useSeconds, useLive } from './useReplay'

export function useHeartRate(id: string, date: string) {
  const seconds = useSeconds()
  const live = useLive()
  const stream = useRef<{ key: string; cursor: string | null; rows: HeartRateSample[] }>({ key: '', cursor: null, rows: [] })
  const liveQuery = useQuery({
    queryKey: ['live-heart-rate', live, id], enabled: !!live && !!id,
    queryFn: async ({ signal }) => {
      const key = `${live}|${id}`
      const previous = stream.current.key === key ? stream.current : { key, cursor: null, rows: [] }
      let cursor = previous.cursor
      let rows = [...previous.rows]
      let packet
      do {
        packet = await pollSimulation(live!, id, cursor, signal)
        rows.push(...packet.data)
        cursor = packet.cursor
      } while (packet.has_more)
      const cutoff = Date.parse(packet.simulated_at + 'Z') - 15 * 60000
      rows = rows.filter(s => Date.parse(s.recorded_at + 'Z') >= cutoff)
      if (replay.get().live === live) replay.syncLive(packet.simulated_at)
      stream.current = { key, cursor, rows }
      return { rows, complete: packet.complete }
    },
    refetchInterval: q => q.state.data?.complete ? false : 5000,
    refetchIntervalInBackground: true, refetchOnWindowFocus: false, retry: false,
  })
  const query = useQuery({
    queryKey: ['heart-rate', id, date],
    queryFn: ({ signal }) => fetchHeartRateDay(id, date, signal),
    enabled: !!id && !live, staleTime: Infinity,
  })
  const source = live ? liveQuery.data?.rows : query.data
  const samples = useMemo(() => (source ?? []).filter(s => s.recorded_at.startsWith(date)).filter(s => s.bpm > 0 && s.confidence !== 0).map(s => {
    const [h, m, sec] = s.recorded_at.slice(11).split(':').map(Number)
    return { ...s, second: h * 3600 + m * 60 + sec }
  }), [source, date])
  useEffect(() => {
    if (live) return
    replay.timeRange(samples[0]?.second ?? 0, samples.at(-1)?.second ?? 86399, samples.length > 0)
  }, [id, date, samples, live])
  // Last recorded sample at or before the selected time; never use future data.
  let lo = 0, hi = samples.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (samples[mid].second <= seconds) lo = mid + 1; else hi = mid }
  const sample = samples[lo - 1]
  const current = sample && seconds - sample.second <= 60 ? sample : null
  return { ...(live ? liveQuery : query), live, samples, current, seconds }
}
