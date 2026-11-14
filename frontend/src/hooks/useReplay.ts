// Replay engine (spec §8): virtual date advanced on the client with requestAnimationFrame.
// Components subscribe to exactly what they need: the integer day (data) or the fractional position (scrubber).
import { useSyncExternalStore } from 'react'

export const SPEEDS = [
  { id: 0.2, label: '1 d / 5 s' },
  { id: 1, label: '1 d / s' },
  { id: 4, label: '4 d / s' },
  { id: 12, label: '12 d / s' },
] as const

type State = { start: string; days: number; pos: number; playing: boolean; speed: number }
let state: State = { start: '2019-11-01', days: 1, pos: 0, playing: false, speed: 1 }
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const set = (p: Partial<State>) => {
  state = { ...state, ...p }
  emit()
}

let raf = 0
let last = 0
function loop(t: number) {
  const dt = Math.min(0.1, (t - last) / 1000)
  last = t
  let pos = state.pos + dt * state.speed
  if (pos >= state.days - 1) {
    pos = state.days - 1
    set({ pos, playing: false })
    return
  }
  set({ pos })
  raf = requestAnimationFrame(loop)
}

export const replay = {
  init(start: string, days: number, at?: number) {
    set({ start, days, pos: Math.min(days - 1, Math.max(0, at ?? state.pos)) })
  },
  play() {
    if (state.playing) return
    if (state.pos >= state.days - 1) state.pos = 0
    set({ playing: true })
    last = performance.now()
    raf = requestAnimationFrame(loop)
  },
  pause() {
    cancelAnimationFrame(raf)
    set({ playing: false })
  },
  toggle() {
    state.playing ? replay.pause() : replay.play()
  },
  restart() {
    set({ pos: 0 })
  },
  seek(pos: number) {
    set({ pos: Math.min(state.days - 1, Math.max(0, pos)) })
  },
  step(n: number) {
    replay.seek(Math.round(state.pos) + n)
  },
  setSpeed(speed: number) {
    set({ speed })
  },
  get: () => state,
}

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

/** integer mission day (re-renders once per day) */
export const useDay = () => useSyncExternalStore(subscribe, () => Math.floor(state.pos))
export const usePos = () => useSyncExternalStore(subscribe, () => state.pos)
export const usePlaying = () => useSyncExternalStore(subscribe, () => state.playing)
export const useSpeed = () => useSyncExternalStore(subscribe, () => state.speed)
export const useReplayRange = () => useSyncExternalStore(subscribe, () => state.days)
export const useStart = () => useSyncExternalStore(subscribe, () => state.start)

export function isoAt(start: string, day: number) {
  const d = new Date(start + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + day)
  return d.toISOString().slice(0, 10)
}
export const useAsOf = () => {
  const day = useDay()
  const start = useStart()
  return isoAt(start, day)
}
