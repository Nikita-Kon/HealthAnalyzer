import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { SPEEDS, isoAt, replay, useDay, usePlaying,  useSpeed, useStart, useSeconds, useTimeReady, clock, useLive, useTotalDays } from '@/hooks/useReplay'
import { startSimulation, stopSimulation } from '@/api/client'
import { DatePicker } from './DatePicker'
import { useId, useState } from 'react'
import { Segmented } from './ui'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function PlayButton({ big }: { big?: boolean }) {
  const playing = usePlaying()
  const ready = useTimeReady()
  return (
    <button
      disabled={!ready}
      onClick={replay.toggle}
      aria-label={playing ? 'Pause replay' : 'Play replay'}
      className={`group relative grid shrink-0 place-items-center rounded-full bg-ice text-void shadow-[0_0_28px_oklch(0.86_0.1_210/0.45)] transition-transform duration-500 ease-soft hover:scale-[1.04] active:scale-95 ${big ? 'size-12' : 'size-11'}`}
    >
      {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5 translate-x-px" fill="currentColor" />}
    </button>
  )
}

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 transition-colors duration-500 hover:bg-raise hover:text-ink">
      {children}
    </button>
  )
}

// ---- moon thumb: shows the real lunar phase on the replay date
const SYNODIC = 29.530588853 // days
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14) // a known new moon
/** 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter */
export function moonPhase(ms: number) {
  const x = ((ms - NEW_MOON_REF) / 864e5 / SYNODIC) % 1
  return x < 0 ? x + 1 : x
}
export function phaseName(f: number) {
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent']
  return names[Math.round(f * 8) % 8]
}
const THUMB = 26

export function Moon({ phase, size = THUMB }: { phase: number; size?: number }) {
  const id = useId()
  const r = 10
  // lit region = one half-disc + a terminator ellipse; waning phases are the mirror image
  const waxing = phase < 0.5
  const k = Math.cos(2 * Math.PI * phase) // 1 new → -1 full
  const lit = `M0,${-r}A${r},${r} 0 0 1 0,${r}A${Math.abs(k) * r},${r} 0 0 ${k > 0 ? 0 : 1} 0,${-r}Z`
  const craters: [number, number, number][] = [[-3.6, -3.2, 2.3], [3.4, 1.8, 2.8], [-1.6, 4.6, 1.6], [4.2, -4.4, 1.2], [-5.6, 1.6, 1.1], [0.8, -0.6, 1]]
  return (
    <svg viewBox="-13 -13 26 26" width={size} height={size} aria-hidden className="overflow-visible">
      <defs>
        <radialGradient id={id + 'g'} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#dfe8f2" />
          <stop offset="100%" stopColor="#9fb1c6" />
        </radialGradient>
        <radialGradient id={id + 'h'} r="50%">
          <stop offset="60%" stopColor="oklch(0.9 0.08 210)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="oklch(0.9 0.08 210)" stopOpacity={0} />
        </radialGradient>
        <clipPath id={id + 'c'}>
          <path d={lit} transform={waxing ? undefined : 'scale(-1,1)'} />
        </clipPath>
      </defs>
      {/* halo */}
      <circle r={13} fill={`url(#${id}h)`} />
      {/* earthshine: the dark side stays faintly visible */}
      <circle r={r} fill="oklch(0.4 0.035 245)" stroke="oklch(0.86 0.1 210 / 0.6)" strokeWidth={0.7} />
      {craters.map(([x, y, cr], i) => (
        <circle key={'d' + i} cx={x} cy={y} r={cr} fill="oklch(0.34 0.035 245)" />
      ))}
      <g clipPath={`url(#${id}c)`}>
        <circle r={r} fill={`url(#${id}g)`} />
        {craters.map(([x, y, cr], i) => (
          <circle key={i} cx={x} cy={y} r={cr} fill="#aebdcf" opacity={0.55} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.35} />
        ))}
      </g>
    </svg>
  )
}

export function Timeline() {
  const seconds = useSeconds()
  const ready = useTimeReady()
  return (
    <div className="min-w-0 flex-1">
      <div className="flex justify-between font-mono text-[10px] text-ink-3">
        <span>Heart-rate time</span>
        <input type="time" step={1} value={clock(seconds)} disabled={!ready} aria-label="Exact heart-rate time"
          onChange={e => { if (!e.target.value) return; const [h, m, s = 0] = e.target.value.split(':').map(Number); replay.seekSeconds(h * 3600 + m * 60 + s) }}
          onInput={e => { if (!e.currentTarget.value) return; const [h, m, s = 0] = e.currentTarget.value.split(':').map(Number); replay.seekSeconds(h * 3600 + m * 60 + s) }}
          className="w-[100px] bg-transparent text-right text-ink" />
      </div>
      <input type="range" min={0} max={86399} step={1} value={seconds}
        disabled={!ready} onChange={e => replay.seekSeconds(+e.target.value)}
        aria-label="Heart-rate time" aria-valuetext={clock(seconds)} className="w-full accent-cyan-300" />
    </div>
  )
}

export function SpeedControl({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const speed = useSpeed()
  return <Segmented id="speed" size={size} value={speed} onChange={replay.setSpeed} options={SPEEDS.map((s) => ({ id: s.id, label: s.label }))} />
}

/** cycles speeds — compact control for phones */
export function SpeedCycle() {
  const speed = useSpeed()
  const i = SPEEDS.findIndex((s) => s.id === speed)
  return (
    <button onClick={() => replay.setSpeed(SPEEDS[(i + 1) % SPEEDS.length].id)} className="h-9 shrink-0 rounded-full border border-line px-3 font-mono text-[11px] text-ink-2" aria-label="Change replay speed">
      {SPEEDS[i]?.label ?? '1x'}
    </button>
  )
}

export function ReplayBar() {
  const live = useLive(), seconds = useSeconds(), playing = usePlaying()
  if (live) return <div role="status" className="glass flex items-center justify-center gap-3 rounded-full px-5 py-4 font-mono text-xs text-ice"><span className="size-2 rounded-full bg-ice animate-pulse" />{playing ? 'LIVE SIMULATION' : 'SIMULATION COMPLETE'} · {clock(seconds)} · 1x · polling every 5s</div>
  return (
    <div className="glass flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 sm:gap-3">
      <PlayButton />
      <div className="flex items-center">
        <IconBtn onClick={replay.restart} label="Restart replay">
          <RotateCcw className="size-4" />
        </IconBtn>
        <IconBtn onClick={() => replay.step(-1)} label="Previous day">
          <SkipBack className="size-4" />
        </IconBtn>
        <IconBtn onClick={() => replay.step(1)} label="Next day">
          <SkipForward className="size-4" />
        </IconBtn>
      </div>
      <div className="mx-1 flex min-w-0 flex-1 pb-3">
        <Timeline />
      </div>
      <div className="hidden xl:block">
        <SpeedControl />
      </div>
      <div className="xl:hidden">
        <SpeedCycle />
      </div>
    </div>
  )
}

export function MissionDate() {
  const day = useDay()
  const start = useStart()
  const iso = isoAt(start, day)
  const d = new Date(iso + 'T00:00:00Z')
  return (
    <DatePicker><div className="text-right leading-none">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
        Replay · day {String(day + 1).padStart(3, '0')}
        <span className="hidden sm:inline"> · {phaseName(moonPhase(d.getTime()))}</span>
      </p>
      <p className="mt-1.5 font-display text-xl font-medium tabular tracking-tight sm:text-2xl">
        {d.getUTCDate()} {MONTHS[d.getUTCMonth()]} <span className="text-ink-3">{d.getUTCFullYear()}</span>
      </p>
    </div></DatePicker>
  )
}

export function LiveSimulationButton() {
  const live = useLive(), total = useTotalDays()
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const toggle = async () => {
    setBusy(true); setError('')
    try {
      if (live) { replay.stopLive(); await stopSimulation(live) }
      else replay.startLive(await startSimulation())
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  return <div className="relative">
    <button disabled={busy || total <= 3} onClick={toggle} className="max-w-[140px] rounded-full border border-ice/40 bg-ice/10 px-3 py-2 text-xs text-ice disabled:opacity-40">{busy ? 'Connecting…' : live ? 'Stop live simulation' : 'Start live simulation'}</button>
    {error && <div role="alert" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-line bg-panel-solid p-3 text-xs text-ink">{error}<button aria-label="Dismiss simulation error" onClick={() => setError('')} className="ml-2">×</button></div>}
  </div>
}
