import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Analytics, MetricId } from '@/api/types'
import type { History } from '@/hooks/useHealthData'
import { isoAt } from '@/hooks/useReplay'
import { METRICS, META, fmt } from '@/lib/metrics'
import { STATUS, metricStatus } from '@/lib/status'
import { Kicker, Segmented } from './ui'

const WINDOWS = [
  { id: 30, label: '30 d' },
  { id: 90, label: '90 d' },
  { id: 999, label: 'All' },
] as const

export function HistoryChart({ history, analytics, metric, onMetric, start, day, days }: { history: History; analytics?: Analytics; metric: MetricId; onMetric: (m: MetricId) => void; start: string; day: number; days: number }) {
  const [win, setWin] = useState<number>(90)
  const meta = META[metric]
  const f = analytics?.findings.find((x) => x.metric === metric)
  const st = metricStatus(analytics, metric)
  const color = st === 'watch' || st === 'alert' ? STATUS[st].color : 'var(--color-s1)'

  // one row per calendar day so gaps stay gaps; values after the replay date are never included
  const from = Math.max(0, day - Math.min(win, days) + 1)
  const to = Math.min(days - 1, day + (win >= 999 ? 0 : Math.round(win * 0.12)))
  const rows = useMemo(() => {
    const byDate = new Map((history[metric] ?? []).map((r) => [r.date, r.value]))
    const out: { d: number; date: string; v: number | null }[] = []
    for (let i = from; i <= to; i++) {
      const date = isoAt(start, i)
      out.push({ d: i, date, v: i <= day ? (byDate.get(date) ?? null) : null })
    }
    return out
  }, [history, metric, from, to, day, start])
  const vals = rows.map((r) => r.v).filter((v): v is number => v != null)
  const lo = meta.domain?.[0] ?? (vals.length ? Math.min(...vals, f?.baseline ?? Infinity) : 0)
  const hi = meta.domain?.[1] ?? (vals.length ? Math.max(...vals, f?.baseline ?? -Infinity) : 1)
  // keep a sensible minimum span so day-to-day noise doesn't look like a crisis
  const MIN_SPAN: Partial<Record<MetricId, number>> = { resting_heart_rate: 14, sleep_duration: 3, sleep_score: 30, exercise_duration: 60 }
  const span = Math.max(hi - lo, MIN_SPAN[metric] ?? 0)
  const pad = meta.domain ? 0 : (span - (hi - lo)) / 2 + span * 0.12

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Kicker>History · up to the replay date</Kicker>
          <h3 className="mt-1 font-display text-lg font-medium">{meta.label}</h3>
        </div>
        <div className="self-start lg:self-auto">
          <Segmented id="win" size="sm" value={win} onChange={setWin} options={WINDOWS.map((w) => ({ id: w.id, label: w.label }))} />
        </div>
      </div>
      <div className="no-scrollbar -mx-1 mt-3 flex gap-1 overflow-x-auto px-1">
        {METRICS.map((m) => {
          const s = metricStatus(analytics, m.id)
          return (
            <button key={m.id} onClick={() => onMetric(m.id)} aria-pressed={metric === m.id} className={`st flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] ${metric === m.id ? 'border-line-2 bg-raise text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'}`}>
              {(s === 'watch' || s === 'alert') && <span className="st size-1.5 rounded-full" style={{ background: STATUS[s].color }} />}
              {m.short}
            </button>
          )
        })}
      </div>
      <div className="mt-4 h-[220px] sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 10, right: 16, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="hist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} strokeDasharray="3 6" />
            {to > day && <ReferenceArea x1={day} x2={to} fill="oklch(1 0 0 / 0.025)" label={{ value: 'FUTURE · HIDDEN', position: 'insideTop', fill: 'var(--color-ink-3)', fontSize: 9 }} />}
            <XAxis dataKey="d" type="number" domain={[from, to]} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(i) => isoAt(start, i).slice(5).replace('-', '.')} />
            <YAxis domain={[lo - pad, hi + pad]} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1))} />
            {f?.baseline != null && <ReferenceLine y={f.baseline} stroke="var(--color-ink-3)" strokeDasharray="5 5" label={{ value: `baseline ${fmt(metric, f.baseline)}`, position: 'insideTopRight', fill: 'var(--color-ink-3)', fontSize: 10 }} />}
            <ReferenceLine x={day} stroke="var(--color-ice)" strokeOpacity={0.6} />
            <Tooltip
              cursor={{ stroke: 'var(--color-ink-3)', strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as { date: string; v: number | null } | undefined
                if (!active || !p) return null
                return (
                  <div className="rounded-xl border border-line-2 bg-panel-solid/95 px-3 py-2 text-xs shadow-2xl">
                    <p className="font-mono text-[10px] text-ink-3">{p.date}</p>
                    <p className="mt-0.5 font-mono text-ink tabular">
                      {p.v == null ? 'no measurement' : `${fmt(metric, p.v)} ${meta.unit}`}
                    </p>
                  </div>
                )
              }}
            />
            <Area type="monotoneX" dataKey="v" stroke={color} strokeWidth={2} fill="url(#hist)" connectNulls={false} isAnimationActive={false} dot={false} activeDot={{ r: 4, stroke: 'var(--color-panel-solid)', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
