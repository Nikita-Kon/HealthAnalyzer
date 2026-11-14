import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Analytics, MetricId, Summary } from '@/api/types'
import type { History } from '@/hooks/useHealthData'
import { upTo } from '@/hooks/useHealthData'
import { METRICS, META } from '@/lib/metrics'
import { HAZARD, STATUS, metricStatus } from '@/lib/status'
import { Sparkline, StatusDot, Ticker } from './ui'

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

export function Vitals({ summary, analytics, history, asOf, active, onPick }: { summary?: Summary; analytics?: Analytics; history: History; asOf: string; active: MetricId; onPick: (m: MetricId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {METRICS.map((m) => {
        const s = summary?.metrics[m.id]
        const f = analytics?.findings.find((x) => x.metric === m.id)
        const st = metricStatus(analytics, m.id)
        const age = s ? daysBetween(s.measured_at, asOf) : null
        const dev = f?.deviation_percent
        const Trend = f?.trend === 'increasing' ? ArrowUpRight : f?.trend === 'decreasing' ? ArrowDownRight : ArrowRight
        const flagged = st === 'watch' || st === 'alert'
        const spark = upTo(history[m.id], asOf).filter((x) => daysBetween(x.date, asOf) < 21)
        const isActive = active === m.id
        return (
          <button
            key={m.id}
            onClick={() => onPick(m.id)}
            aria-pressed={isActive}
            className={`st group relative flex min-w-0 flex-col rounded-2xl border p-3 text-left sm:p-3.5 ${isActive ? 'border-line-2 bg-raise/70' : 'border-line bg-panel hover:border-line-2'}`}
            style={flagged ? { borderColor: `color-mix(in oklab, ${STATUS[st].color} 45%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${STATUS[st].color} 18%, transparent), 0 10px 40px -18px ${STATUS[st].color}` } : undefined}
          >
            <span className="flex items-center gap-2">
              <StatusDot status={st} size={6} />
              <span className="truncate text-[11.5px] text-ink-2">{m.short}</span>
              <span title={HAZARD[m.hazard].label} className="ml-auto font-mono text-[9.5px] text-ink-3">
                {HAZARD[m.hazard].letter}
              </span>
            </span>
            <span className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-[26px] font-medium leading-none tracking-tight sm:text-[28px]">
                <Ticker value={s?.value} digits={m.digits} />
              </span>
              <span className="text-xs text-ink-3">{m.unit}</span>
            </span>
            <span className="mt-2 flex min-h-[16px] items-center gap-1 font-mono text-[10.5px]">
              {f && f.status !== 'insufficient_data' && dev != null ? (
                <span className="st flex items-center gap-0.5" style={{ color: flagged ? STATUS[st].color : 'var(--color-ink-3)' }}>
                  <Trend className="size-3" aria-hidden />
                  {dev > 0 ? '+' : ''}
                  {dev.toFixed(0)}% vs base {f.baseline?.toFixed(META[m.id].digits)}
                </span>
              ) : (
                <span className="text-ink-3">{s ? 'baseline pending' : 'no data yet'}</span>
              )}
            </span>
            <span className="mt-2 flex items-end justify-between gap-2">
              <span className={`font-mono text-[9.5px] ${age && age > 0 ? 'text-watch/80' : 'text-ink-3'}`}>{s ? (age === 0 ? 'today' : `${age}d ago`) : ''}</span>
              <Sparkline values={spark.map((x) => x.value)} baseline={f?.baseline} color={flagged ? STATUS[st].color : 'var(--color-ice)'} width={64} height={20} domain={META[m.id].domain} />
            </span>
          </button>
        )
      })}
    </div>
  )
}
