import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { SPEEDS, isoAt, replay, useDay, usePlaying, usePos, useReplayRange, useSpeed, useStart } from '@/hooks/useReplay'
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

export function Timeline() {
  const pos = usePos()
  const days = useReplayRange()
  const start = useStart()
  const p = days > 1 ? (pos / (days - 1)) * 100 : 0
  // month ticks
  const ticks: { at: number; label: string }[] = []
  for (let d = 0; d < days; d++) {
    const iso = isoAt(start, d)
    if (iso.endsWith('-01')) ticks.push({ at: (d / (days - 1)) * 100, label: MONTHS[+iso.slice(5, 7) - 1] })
  }
  return (
    <div className="relative min-w-0 flex-1">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line-2">
        <div className="h-full rounded-full bg-gradient-to-r from-ice/40 to-ice" style={{ width: `${p}%` }} />
      </div>
      {ticks.map((t) => (
        <span key={t.at} className="pointer-events-none absolute top-[calc(50%+9px)] -translate-x-1/2 font-mono text-[9.5px] uppercase tracking-wider text-ink-3" style={{ left: `${t.at}%` }}>
          {t.label}
        </span>
      ))}
      <input
        type="range"
        className="tl relative"
        min={0}
        max={days - 1}
        step={1}
        value={Math.round(pos)}
        onChange={(e) => replay.seek(+e.target.value)}
        aria-label="Replay date"
        aria-valuetext={isoAt(start, Math.round(pos))}
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
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">Replay · day {String(day + 1).padStart(3, '0')}</p>
      <p className="mt-1.5 font-display text-xl font-medium tabular tracking-tight sm:text-2xl">
        {d.getUTCDate()} {MONTHS[d.getUTCMonth()]} <span className="text-ink-3">{d.getUTCFullYear()}</span>
      </p>
    </div>
  )
}
