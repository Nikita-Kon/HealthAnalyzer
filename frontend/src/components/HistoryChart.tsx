import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, type MotionValue } from 'motion/react'
import { Line, LineChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Analytics, MetricId } from '@/api/types'
import type { History } from '@/hooks/useHealthData'
import { isoAt } from '@/hooks/useReplay'
import { estimateGaps } from '@/lib/estimateGaps'
import { METRICS, META, fmt } from '@/lib/metrics'
import { STATUS, metricStatus } from '@/lib/status'
import { Kicker, Segmented } from './ui'

const WINDOWS = [
  { id: 30, label: '30 d' },
  { id: 90, label: '90 d' },
  { id: 999, label: 'All' },
] as const

// keep a sensible minimum span so day-to-day noise doesn't look like a crisis
const MIN_SPAN: Partial<Record<MetricId, number>> = { resting_heart_rate: 14, sleep_duration: 3, sleep_score: 30, exercise_duration: 60 }
const SPRING = { type: 'spring', stiffness: 70, damping: 20, mass: 0.9 } as const
const DRAW_IN = { duration: 1.4, ease: [0.22, 1, 0.36, 1] } as const

/** visible [left, right] day range: slides at a constant width, and zooms out smoothly while the mission is younger than the window */
function view(head: number, span: number, pad: number): [number, number] {
  const R = Math.max(head + pad, Math.min(span, 14))
  return [Math.max(0, R - span), R]
}

function niceTicks(lo: number, hi: number, n: number) {
  const raw = (hi - lo) / Math.max(1, n - 1)
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9 && out.length < n + 1; v += step) out.push(+v.toFixed(6))
  return out
}

/** spring a motion value toward `to` whenever it changes */
function useChase(mv: MotionValue<number>, to: number) {
  useEffect(() => {
    const c = animate(mv, to, SPRING)
    return () => c.stop()
  }, [mv, to])
}

/** snapshot of several motion values, re-rendered at most once per animation frame and only while they move */
function useFrame<K extends string>(mvs: Record<K, MotionValue<number>>) {
  const read = () => Object.fromEntries(Object.entries(mvs).map(([k, mv]) => [k, (mv as MotionValue<number>).get()])) as Record<K, number>
  const [frame, setFrame] = useState(read)
  useEffect(() => {
    let raf = 0
    const kick = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          setFrame(read())
        })
    }
    const offs = Object.values<MotionValue<number>>(mvs).map((mv) => mv.on('change', kick))
    return () => {
      offs.forEach((o) => o())
      cancelAnimationFrame(raf)
    }
  }, Object.values(mvs)) // eslint-disable-line react-hooks/exhaustive-deps
  return frame
}

type Row = { d: number; v: number | null; estimate?: number | null; iso?: boolean }

export function HistoryChart({ history, analytics, metric, onMetric, start, day, days, member, loading = false, error }: { loading?: boolean; error?: Error | null; history: History; analytics?: Analytics; metric: MetricId; onMetric: (m: MetricId) => void; start: string; day: number; days: number; member: string }) {
  const [win, setWin] = useState<number>(90)
  const meta = META[metric]
  const f = analytics?.findings.find((x) => x.metric === metric)
  const st = metricStatus(analytics, metric)
  const color = st === 'watch' || st === 'alert' ? STATUS[st].color : 'var(--color-s1)'

  // a fixed-width window that slides with the replay date (constant px/day → smooth scrolling)
  const winDays = Math.min(win, days)
  const pad = win >= 999 ? 0 : Math.round(winDays * 0.12)
  const span = Math.max(1, winDays - 1 + pad)

  // one value per calendar day so gaps stay gaps; nothing after the replay date is ever handed to the chart
  const series = useMemo(() => {
    const byDate = new Map((history[metric] ?? []).map((r) => [r.date, r.value]))
    const out: (number | null)[] = []
    for (let i = 0; i <= day; i++) out.push(Number.isFinite(byDate.get(isoAt(start, i))) ? byDate.get(isoAt(start, i))! : null)
    return out
  }, [history, metric, day, start])

  const estimates = useMemo(() => estimateGaps(series, meta.domain), [series, meta.domain])
  const estimateColor = 'var(--color-ink-3)'

  // target y-domain from what's visible
  const vals = series.map((value, i) => value ?? estimates[i]).slice(Math.max(0, day - winDays + 1)).filter((v): v is number => v != null)
  const lo0 = meta.domain?.[0] ?? (vals.length ? Math.min(...vals, f?.baseline ?? Infinity) : 0)
  const hi0 = meta.domain?.[1] ?? (vals.length ? Math.max(...vals, f?.baseline ?? -Infinity) : 1)
  const sp = Math.max(hi0 - lo0, MIN_SPAN[metric] ?? 0)
  const yp = meta.domain ? 0 : (sp - (hi0 - lo0)) / 2 + sp * 0.12
  const lo = lo0 - yp, hi = hi0 + yp

  // Animated chart state. Recharts' own animation is off: it morphs points by index, which wobbles on a sliding
  // window. Instead the domains / draw position glide here and Recharts re-renders with them each frame.
  const head = useMotionValue(day) // camera: where the window is
  const pen = useMotionValue(day) // how far the line is drawn
  const yLo = useMotionValue(lo)
  const yHi = useMotionValue(hi)
  const base = useMotionValue(f?.baseline ?? NaN)
  const reveal = useMotionValue(1)
  useChase(yLo, lo)
  useChase(yHi, hi)
  useEffect(() => {
    if (f?.baseline == null) return base.set(NaN)
    if (Number.isNaN(base.get())) return base.jump(f.baseline)
    const c = animate(base, f.baseline, SPRING)
    return () => c.stop()
  }, [base, f?.baseline])

  // new day → glide; member / metric / window switch (or a long seek) → redraw from the left like a pen
  const ctx = `${member}|${metric}|${win}`
  const prevCtx = useRef('')
  useEffect(() => {
    const fresh = prevCtx.current !== ctx || Math.abs(head.get() - day) > span * 0.6
    prevCtx.current = ctx
    if (fresh) {
      head.jump(day)
      pen.jump(view(day, span, pad)[0])
      yLo.jump(lo)
      yHi.jump(hi)
      reveal.jump(0)
      const a = animate(reveal, 1, { duration: 0.9, ease: 'easeOut' })
      const b = animate(pen, day, DRAW_IN)
      return () => (a.stop(), b.stop())
    }
    const c = animate(head, day, SPRING)
    const d = animate(pen, day, SPRING)
    return () => (c.stop(), d.stop())
  }, [ctx, day]) // eslint-disable-line react-hooks/exhaustive-deps

  const fr = useFrame({ head, pen, yLo, yHi, base, reveal })
  const [L, R] = view(fr.head, span, pad)
  const p = Math.min(fr.pen, day)

  // rows actually drawn: visible days up to the pen, plus an interpolated tip so the line grows continuously
  const rows = useMemo(() => {
    const out: Row[] = []
    const i0 = Math.max(0, Math.floor(L) - 1), i1 = Math.min(series.length - 1, Math.floor(p))
    for (let i = i0; i <= i1; i++) out.push({ d: i, v: series[i], estimate: estimates[i], iso: series[i] != null && series[i - 1] == null && series[i + 1] == null })
    const a = series[Math.floor(p)], b = series[Math.floor(p) + 1], t = p - Math.floor(p)
    if (t > 0.01 && a != null && b != null) out.push({ d: p, v: a + (b - a) * t })
    return out
  }, [series, estimates, L, p])

  const yTicks = useMemo(() => niceTicks(fr.yLo, fr.yHi, 5), [fr.yLo, fr.yHi])
  const stepD = [1, 2, 7, 14, 30].find((s) => s / (R - L) >= 0.1) ?? 30
  const xTicks: number[] = []
  for (let d = Math.ceil(L); d <= Math.min(R, days - 1); d++) xTicks.push(d)
  const gaps: { from: number; to: number }[] = []
  for (let d = Math.max(0, Math.ceil(L)); d <= Math.min(day, Math.floor(R)); d++) {
    if (series[d] != null) continue
    const previous = gaps.at(-1)
    if (previous && previous.to === d - 1) previous.to = d
    else gaps.push({ from: d, to: d })
  }
  const missing = gaps.reduce((n, gap) => n + gap.to - gap.from + 1, 0)
  const showBase = !Number.isNaN(fr.base) && fr.base >= fr.yLo && fr.base <= fr.yHi

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Kicker>History · up to the replay date</Kicker>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h3 key={metric} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }} className="mt-1 font-display text-lg font-medium">
              {meta.label}
            </motion.h3>
          </AnimatePresence>
        </div>
        <div className="self-start lg:self-auto">
          <Segmented id="win" size="sm" value={win} onChange={setWin} options={WINDOWS.map((w) => ({ id: w.id, label: w.label }))} />
        </div>
      </div>
      <div className="no-scrollbar -mx-1 mt-3 flex gap-1 overflow-x-auto px-1">
        {METRICS.map((m) => {
          const s = metricStatus(analytics, m.id)
          const on = metric === m.id
          return (
            <button key={m.id} onClick={() => onMetric(m.id)} aria-pressed={on} className={`st relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] ${on ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}>
              {on && <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-full border border-line-2 bg-raise" transition={{ type: 'spring', stiffness: 380, damping: 34 }} />}
              <span className="relative z-10 flex items-center gap-1.5">
                {(s === 'watch' || s === 'alert') && <span className="st size-1.5 rounded-full" style={{ background: STATUS[s].color }} />}
                {m.short}
              </span>
            </button>
          )
        })}
      </div>
      <div className="relative mt-4 h-[220px] sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 10, right: 16, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} strokeDasharray="3 6" />
            {R > p + 0.5 && <ReferenceArea x1={p} x2={R} fill="oklch(1 0 0 / 0.025)" ifOverflow="hidden" label={R - p > span * 0.1 ? { value: 'FUTURE · HIDDEN', position: 'insideTop', fill: 'var(--color-ink-3)', fontSize: 9 } : undefined} />}
            {!loading && !error && gaps.map(gap => (
              <ReferenceArea key={gap.from} x1={Math.max(L, gap.from - 0.4)} x2={Math.min(R, gap.to + 0.4)}
                fill="var(--color-ink-3)" fillOpacity={0.08} ifOverflow="hidden" />
            ))}
            <XAxis dataKey="d" type="number" domain={[L, R]} allowDataOverflow ticks={xTicks} interval={0}
              tickLine={{ stroke: 'var(--color-ink-3)', strokeOpacity: 0.45 }} axisLine={false}
              tick={({ x, y, payload }) => (
                <text x={x} y={Number(y ?? 0) + 12} textAnchor="middle" fill="var(--color-ink-3)" fontSize={10}>
                  {payload && payload.value % stepD === 0 ? isoAt(start, payload.value).slice(5).replace('-', '.') : ''}
                </text>
              )} />
            <YAxis domain={[fr.yLo, fr.yHi]} allowDataOverflow ticks={yTicks} interval={0} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => (Math.abs(v) >= 10 || Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1))} />
            {showBase && <ReferenceLine y={fr.base} stroke="var(--color-ink-3)" strokeDasharray="5 5" label={{ value: `baseline ${fmt(metric, fr.base)}`, position: 'insideTopRight', fill: 'var(--color-ink-3)', fontSize: 10 }} />}
            <ReferenceLine x={p} stroke="var(--color-ice)" strokeOpacity={0.6} ifOverflow="hidden" />
            <Tooltip
              filterNull={false}
              cursor={{ stroke: 'var(--color-ink-3)', strokeDasharray: '3 3' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const r = payload?.find(item => item.payload)?.payload as Row | undefined
                if (!active || !r || !Number.isInteger(r.d)) return null
                return (
                  <div className="rounded-xl border border-line-2 bg-panel-solid/95 px-3 py-2 text-xs shadow-2xl">
                    <p className="font-mono text-[10px] text-ink-3">{isoAt(start, r.d)}</p>
                    <p className="mt-0.5 font-mono text-ink tabular">{r.v != null ? `${fmt(metric, r.v)} ${meta.unit} · measured` : r.estimate != null ? `${fmt(metric, r.estimate)} ${meta.unit} · estimated from prior trend` : 'no measurement'}</p>
                  </div>
                )
              }}
            />
            <Line dataKey="estimate" name="Estimated trend" type="linear" stroke={estimateColor}
              strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false}
              connectNulls={false} isAnimationActive={false} />
            <Line
              type="monotoneX"
              dataKey="v"
              stroke={color}
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
              // Mark every measured calendar day; null days never become zeroes.
              dot={(props: { cx?: number; cy?: number; payload?: Row; index?: number }) => (props.payload?.v != null && Number.isInteger(props.payload.d) && props.cx != null && props.cy != null ? <circle key={props.index} cx={props.cx} cy={props.cy} r={2.5} fill={color} /> : <g key={props.index} />)}
              activeDot={{ r: 4, stroke: 'var(--color-panel-solid)', strokeWidth: 2 }}
              style={{ filter: `drop-shadow(0 0 6px color-mix(in oklab, ${color} 45%, transparent))` }}
            />
          </LineChart>
        </ResponsiveContainer>
        {(loading || error || !vals.length) && (
          <div role={error ? 'alert' : 'status'} className="absolute inset-0 grid place-items-center rounded-xl bg-panel-solid/90 px-6 text-center text-sm text-ink-3">
            {loading ? 'Loading daily history…' : error ? 'History could not be loaded. Please try again.' : 'No measurements for this period.'}
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Dots and solid lines are measured. Muted dashed lines continue the prior trend across missing days (visual estimates only).
        {!loading && !error && missing > 0 ? ` ${missing} missing day${missing === 1 ? '' : 's'} in view.` : ''}
      </p>
    </div>
  )
}
