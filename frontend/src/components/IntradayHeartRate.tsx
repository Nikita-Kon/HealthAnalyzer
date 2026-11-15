import { clock } from '@/hooks/useReplay'
import type { useHeartRate } from '@/hooks/useHeartRate'
import { Kicker } from './ui'

type HeartRate = ReturnType<typeof useHeartRate>
export function IntradayHeartRate({ heart }: { heart: HeartRate }) {
  const { current, samples, seconds, isPending, isError } = heart
  const from = Math.max(0, seconds - 900)
  const window = samples.filter(s => s.second >= from && s.second <= seconds)
  const low = Math.min(40, ...window.map(s => s.bpm)) - 5
  const high = Math.max(100, ...window.map(s => s.bpm)) + 5
  const x = (second: number) => 12 + (second - from) / Math.max(1, seconds - from) * 576
  const y = (bpm: number) => 190 - (bpm - low) / (high - low) * 170
  const stride = Math.max(1, Math.ceil(window.length / 500))
  let path = ''
  window.forEach((s, i) => {
    if (i % stride && i !== window.length - 1) return
    const prev = window[Math.max(0, i - stride)]
    path += `${i === 0 || s.second - prev.second > 60 ? 'M' : 'L'}${x(s.second)},${y(s.bpm)} `
  })
  return (
    <div>
      <Kicker>Recorded heart rate · {clock(seconds)}</Kicker>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg">Intraday heart rate</h2>
        <p className="font-display text-3xl tabular">{current?.bpm ?? '—'} <span className="text-xs text-ink-3">bpm</span></p>
      </div>
      <p className="mt-2 text-xs text-ink-3" aria-live="polite">
        {isPending ? 'Loading samples…' : isError ? 'Could not load heart-rate samples.' : !samples.length ? 'No heart-rate samples for this participant and day.' : current ? `Recorded ${current.recorded_at.slice(11, 19)} · confidence ${current.confidence ?? 'unknown'}` : 'No recent sample at this time (gap over 60 seconds).'}
      </p>
      <svg viewBox="0 0 600 220" className="mt-4 h-[250px] w-full" role="img" aria-label="Recorded heart rate during the last 15 minutes; gaps are not interpolated">
        {[low, Math.round((high + low) / 2), high].map(v => <g key={v}><line x1="12" x2="588" y1={y(v)} y2={y(v)} stroke="currentColor" opacity="0.1" /><text x="14" y={y(v) - 3} fill="currentColor" fontSize="10" opacity="0.5">{v}</text></g>)}
        <path d={path} stroke="var(--color-ice)" strokeWidth="2" fill="none" />
        {current && <circle cx={x(current.second)} cy={y(current.bpm)} r="4" fill="var(--color-ice)" />}
        <text x="12" y="215" fill="currentColor" fontSize="10" opacity="0.5">{clock(from)}</text>
        <text x="588" y="215" textAnchor="end" fill="currentColor" fontSize="10" opacity="0.5">{clock(seconds)}</text>
      </svg>
      <p className="text-xs text-ink-3">Last 15 minutes · recorded samples · confidence 0 excluded</p>
    </div>
  )
}
