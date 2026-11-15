import { useSyncExternalStore } from 'react'

export const SPEEDS = [
  { id: 1, label: '1x' }, { id: 60, label: '60x' },
  { id: 600, label: '600x' }, { id: 3600, label: '3600x' },
] as const

type State = { start: string; days: number; pos: number; playing: boolean; speed: number; seconds: number; first: number; end: number; ready: boolean }
let state: State = { start: '2019-11-01', days: 1, pos: 0, playing: false, speed: 1, seconds: 0, first: 0, end: 86399, ready: false }
const subs = new Set<() => void>()
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach(f => f()) }
let raf = 0, last = 0
function loop(t: number) {
  const dt = Math.min(0.1, (t - last) / 1000)
  last = t
  const seconds = Math.min(state.end, state.seconds + dt * state.speed)
  set({ seconds, playing: seconds < state.end })
  if (state.playing) raf = requestAnimationFrame(loop)
}
export const replay = {
  init(start: string, days: number, at?: number) { set({ start, days, pos: Math.min(days - 1, Math.max(0, at ?? state.pos)) }) },
  play() {
    if (state.playing || !state.ready) return
    if (state.seconds >= state.end) state.seconds = state.first
    set({ playing: true }); last = performance.now(); raf = requestAnimationFrame(loop)
  },
  pause() { cancelAnimationFrame(raf); set({ playing: false }) },
  toggle() { state.playing ? replay.pause() : replay.play() },
  restart() { set({ seconds: state.first }) },
  seek(pos: number) {
    const day = Math.min(state.days - 1, Math.max(0, Math.round(pos)))
    if (day === state.pos) return
    replay.pause(); set({ pos: day, seconds: 0, ready: false })
  },
  step(n: number) { replay.seek(state.pos + n) },
  seekSeconds(seconds: number) { set({ seconds: Math.min(state.end, Math.max(state.first, seconds)) }) },
  timeRange(first: number, end: number, ready: boolean) { replay.pause(); set({ first, end, ready, seconds: first }) },
  setSpeed(speed: number) { set({ speed }) },
  get: () => state,
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useDay = () => useSyncExternalStore(subscribe, () => state.pos)
export const usePos = () => useSyncExternalStore(subscribe, () => state.pos)
export const usePlaying = () => useSyncExternalStore(subscribe, () => state.playing)
export const useSpeed = () => useSyncExternalStore(subscribe, () => state.speed)
export const useReplayRange = () => useSyncExternalStore(subscribe, () => state.days)
export const useStart = () => useSyncExternalStore(subscribe, () => state.start)
export const useSeconds = () => useSyncExternalStore(subscribe, () => Math.floor(state.seconds))
export const useTimeReady = () => useSyncExternalStore(subscribe, () => state.ready)
export function isoAt(start: string, day: number) {
  const d = new Date(start + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + day); return d.toISOString().slice(0, 10)
}
export const useAsOf = () => isoAt(useStart(), useDay())
export function clock(seconds: number) { return new Date(seconds * 1000).toISOString().slice(11, 19) }
