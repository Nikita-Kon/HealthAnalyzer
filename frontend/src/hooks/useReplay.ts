import { useSyncExternalStore } from 'react'

export const SPEEDS = [
  { id: 1, label: '1x' }, { id: 60, label: '60x' },
  { id: 600, label: '600x' }, { id: 3600, label: '3600x' },
] as const

type State = { start: string; days: number; pos: number; playing: boolean; speed: number; seconds: number; first: number; end: number; ready: boolean; live: string | null }
let state: State = { start: '2019-11-01', days: 1, pos: 0, playing: false, speed: 1, seconds: 0, first: 0, end: 86399, ready: false, live: null }
const subs = new Set<() => void>()
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach(f => f()) }
let raf = 0, last = 0
let liveAnchor = { at: 0, wall: 0, end: 0 }
function loop(t: number) {
  if (state.live) {
    const at = Math.min(liveAnchor.end - 1, liveAnchor.at + (performance.now() - liveAnchor.wall))
    const elapsed = (at - Date.parse(state.start + 'T00:00:00Z')) / 1000
    set({ pos: Math.floor(elapsed / 86400), seconds: elapsed % 86400, playing: at < liveAnchor.end - 1 })
    if (state.playing) raf = requestAnimationFrame(loop)
    return
  }
  const dt = Math.min(0.1, (t - last) / 1000)
  last = t
  const seconds = Math.min(state.end, state.seconds + dt * state.speed)
  set({ seconds, playing: seconds < state.end })
  if (state.playing) raf = requestAnimationFrame(loop)
}
export const replay = {
  init(start: string, days: number, at?: number) { if (state.live) return; set({ start, days, pos: Math.min(Math.max(0, days - 4), Math.max(0, at ?? state.pos)) }) },
  play() {
    if (state.live || state.playing || !state.ready) return
    if (state.seconds >= state.end) state.seconds = state.first
    set({ playing: true }); last = performance.now(); raf = requestAnimationFrame(loop)
  },
  pause() { cancelAnimationFrame(raf); set({ playing: false }) },
  toggle() { state.playing ? replay.pause() : replay.play() },
  restart() { if (state.live) return; set({ seconds: state.first }) },
  seek(pos: number) {
    if (state.live) return
    const day = Math.min(Math.max(0, state.days - 4), Math.max(0, Math.round(pos)))
    if (day === state.pos) return
    replay.pause(); set({ pos: day, seconds: 0, ready: false })
  },
  step(n: number) { replay.seek(state.pos + n) },
  seekSeconds(seconds: number) { if (state.live) return; set({ seconds: Math.min(state.end, Math.max(state.first, seconds)) }) },
  timeRange(first: number, end: number, ready: boolean) { if (state.live) return; replay.pause(); set({ first, end, ready, seconds: first }) },
  setSpeed(speed: number) { set({ speed }) },
  startLive(session: { session_id: string; simulated_at: string; ends_at: string }) {
    replay.pause()
    liveAnchor = { at: Date.parse(session.simulated_at + 'Z'), wall: performance.now(), end: Date.parse(session.ends_at + 'Z') }
    set({ live: session.session_id, playing: true, speed: 1 })
    loop(performance.now())
  },
  syncLive(at: string) { if (state.live) liveAnchor = { ...liveAnchor, at: Date.parse(at + 'Z'), wall: performance.now() } },
  stopLive() { replay.pause(); set({ live: null, pos: Math.max(0, state.days - 4), seconds: 0, ready: false }) },
  get: () => state,
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useDay = () => useSyncExternalStore(subscribe, () => state.pos)
export const usePos = () => useSyncExternalStore(subscribe, () => state.pos)
export const usePlaying = () => useSyncExternalStore(subscribe, () => state.playing)
export const useSpeed = () => useSyncExternalStore(subscribe, () => state.speed)
export const useReplayRange = () => useSyncExternalStore(subscribe, () => state.live ? state.days : Math.max(1, state.days - 3))
export const useStart = () => useSyncExternalStore(subscribe, () => state.start)
export const useSeconds = () => useSyncExternalStore(subscribe, () => Math.floor(state.seconds))
export const useTimeReady = () => useSyncExternalStore(subscribe, () => state.ready)
export function isoAt(start: string, day: number) {
  const d = new Date(start + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + day); return d.toISOString().slice(0, 10)
}
export const useAsOf = () => isoAt(useStart(), useDay())
export function clock(seconds: number) { return new Date(seconds * 1000).toISOString().slice(11, 19) }

export const useLive = () => useSyncExternalStore(subscribe, () => state.live)
export const useTotalDays = () => useSyncExternalStore(subscribe, () => state.days)
