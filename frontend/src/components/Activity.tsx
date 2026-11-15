import { useId, useMemo } from 'react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { Footprints } from 'lucide-react'
import { isoAt } from '@/hooks/useReplay'
import { Kicker, Ticker } from './ui'

const DAYS = 14

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Daily steps on the replay date against the previous two weeks — context for training load, not analysed */
export function Activity({ data, asOf }: { data?: { date: string; value: number }[]; asOf: string }) {
  const gid = useId()
  const byDate = useMemo(() => new Map((data ?? []).map((x) => [x.date, x.value])), [data])
  const bars = Array.from({ length: DAYS }, (_, i) => {
    const date = isoAt(asOf, i - DAYS + 1)
    return { date, value: byDate.get(date) ?? null }
  })
  const today = bars[DAYS - 1].value
  const prev = bars.slice(0, -1).map((b) => b.value).filter((v): v is number => v != null)
  const base = prev.length >= 7 ? median(prev) : null
  const dev = today != null && base ? Math.round(((today - base) / base) * 100) : null
  const top = Math.max(base ?? 0, ...bars.map((b) => b.value ?? 0), 1000) * 1.08

  return (
    <div className="w-full sm:w-[248px]">
      <div className="flex items-center justify-between">
        <Kicker className="flex items-center gap-1.5">
          <Footprints className="size-3" aria-hidden /> Activity · steps
        </Kicker>
        <span className="font-mono text-[10px] text-ink-3">{DAYS}d</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-display text-[22px] font-medium leading-none tracking-tight">
          <Ticker value={today} group />
        </span>
        <span className="font-mono text-[10.5px] text-ink-3">
          {today == null ? (data ? 'not worn' : '') : dev == null ? 'baseline pending' : `${dev > 0 ? '+' : ''}${dev}% vs median`}
        </span>
      </div>
      <div className="mt-2 h-[46px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 2, right: 0, left: 0, bottom: 0 }} barCategoryGap={2}>
            <defs>
              <linearGradient id={`${gid}-now`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-ice)" />
                <stop offset="100%" stopColor="var(--color-ice)" stopOpacity={0.45} />
              </linearGradient>
              <filter id={`${gid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <YAxis hide domain={[0, top]} allowDataOverflow />
            <Tooltip
              cursor={{ fill: 'oklch(1 0 0 / 0.04)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const b = payload?.[0]?.payload as (typeof bars)[number] | undefined
                if (!active || !b) return null
                return (
                  <div className="rounded-xl border border-line-2 bg-panel-solid/95 px-3 py-2 text-xs shadow-2xl">
                    <p className="font-mono text-[10px] text-ink-3">{b.date}</p>
                    <p className="mt-0.5 font-mono text-ink tabular">{b.value == null ? 'not worn' : `${b.value.toLocaleString('en-US')} steps`}</p>
                  </div>
                )
              }}
            />
            {base != null && <ReferenceLine y={base} stroke="var(--color-ink-3)" strokeDasharray="3 4" strokeOpacity={0.7} />}
            <Bar dataKey="value" radius={[3, 3, 1, 1]} isAnimationActive={false}>
              {bars.map((b, i) => (
                <Cell
                  key={b.date}
                  fill={i === DAYS - 1 ? `url(#${gid}-now)` : `oklch(0.86 0.1 210 / ${(0.1 + (0.22 * i) / (DAYS - 2)).toFixed(3)})`}
                  filter={i === DAYS - 1 ? `url(#${gid}-glow)` : undefined}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9.5px] text-ink-3">
        <span>−{DAYS - 1}d</span>
        <span>today</span>
      </div>
    </div>
  )
}
