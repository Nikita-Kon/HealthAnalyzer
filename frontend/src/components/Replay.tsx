import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { SPEEDS, isoAt, replay, useDay, usePlaying, usePos, useReplayRange, useSpeed, useStart } from '@/hooks/useReplay'
import { useId } from 'react'
import { Segmented } from './ui'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function PlayButton({ big }: { big?: boolean }) {
  const playing = usePlaying()
  return (
    <button
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
  const pos = usePos()
  const days = useReplayRange()
  const start = useStart()
  const p = days > 1 ? (pos / (days - 1)) * 100 : 0
  const phase = moonPhase(Date.parse(start + 'T00:00:00Z') + pos * 864e5)
  // centre of the native thumb along the track
  const at = `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${p / 100})`
  // month ticks
  const ticks: { at: number; label: string }[] = []
  for (let d = 0; d < days; d++) {
    const iso = isoAt(start, d)
    if (iso.endsWith('-01')) ticks.push({ at: (d / (days - 1)) * 100, label: MONTHS[+iso.slice(5, 7) - 1] })
  }
  return (
    <div className="tl-wrap relative min-w-0 flex-1">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line-2">
        <div className="h-full rounded-full bg-gradient-to-r from-ice/10 via-ice/40 to-ice shadow-[0_0_12px_oklch(0.86_0.1_210/0.5)]" style={{ width: at }} />
      </div>
      {ticks.map((t) => (
        <span key={t.at} className="pointer-events-none absolute top-[calc(50%+9px)] -translate-x-1/2 font-mono text-[9.5px] uppercase tracking-wider text-ink-3" style={{ left: `${t.at}%` }}>
          {t.label}
        </span>
      ))}
      <div className="moon pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_8px_oklch(0.92_0.06_210/0.55)]" style={{ left: at }}>
        <Moon phase={phase} />
      </div>
      <input
        type="range"
        className="tl relative"
        min={0}
        max={days - 1}
        step={1}
        value={Math.round(pos)}
        onChange={(e) => replay.seek(+e.target.value)}
        aria-label="Replay date"
        aria-valuetext={`${isoAt(start, Math.round(pos))} · ${phaseName(phase)}`}
        title={phaseName(phase)}
      />
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
      {SPEEDS[i]?.label ?? '1 d / s'}
    </button>
  )
}

export function ReplayBar() {
  return (
    <div className="glass flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 sm:gap-3">
      <PlayButton />
      <div className="hidden items-center sm:flex">
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
    <div className="text-right leading-none">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
        Replay · day {String(day + 1).padStart(3, '0')}
        <span className="hidden sm:inline"> · {phaseName(moonPhase(d.getTime()))}</span>
      </p>
      <p className="mt-1.5 font-display text-xl font-medium tabular tracking-tight sm:text-2xl">
        {d.getUTCDate()} {MONTHS[d.getUTCMonth()]} <span className="text-ink-3">{d.getUTCFullYear()}</span>
      </p>
    </div>
  )
}
