import { AnimatePresence, motion } from 'motion/react'
import { CircleDashed, Layers, Sparkles } from 'lucide-react'
import type { Analytics, MetricId } from '@/api/types'
import { META, fmt } from '@/lib/metrics'
import { STATUS, isAnomaly } from '@/lib/status'
import { Kicker } from './ui'

const item = {
  initial: { opacity: 0, y: -6, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: 4, filter: 'blur(4px)' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
}

export function Notifications({ analytics, onPick }: { analytics?: Analytics; onPick: (m: MetricId) => void }) {
  const singles = (analytics?.findings ?? []).filter((f) => isAnomaly(f.status))
  const combined = analytics?.combined_findings ?? []
  const insufficient = (analytics?.findings ?? []).filter((f) => f.status === 'insufficient_data')
  const f = (m: MetricId) => analytics?.findings.find((x) => x.metric === m)

  return (
    <div className="flex flex-col gap-2.5">
      <AnimatePresence initial={false} mode="popLayout">
        {analytics?.status === 'insufficient_data' && (
          <motion.div key="insufficient" layout {...item} className="rounded-2xl border border-dashed border-line-2 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
              <CircleDashed className="size-4" aria-hidden /> Not enough data yet
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">A personal baseline needs at least 7 valid daily observations in the previous 14 days. Keep the replay running.</p>
          </motion.div>
        )}

        {combined.map((c) => (
          <motion.article key={'c' + c.metrics.join()} layout {...item} className="st relative overflow-hidden rounded-2xl border p-4" style={{ borderColor: 'color-mix(in oklab, var(--color-alert) 45%, transparent)', background: 'linear-gradient(160deg, color-mix(in oklab, var(--color-alert) 16%, transparent), transparent 70%)' }}>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--color-alert)' }}>
              <Layers className="size-3.5" aria-hidden /> Combined change
            </p>
            <h4 className="mt-2 font-display text-[15px] font-medium leading-snug text-ink">{c.message}</h4>
            <ul className="mt-3 space-y-1.5">
              {c.metrics.map((m) => {
                const x = f(m)
                return (
                  <li key={m}>
                    <button onClick={() => onPick(m)} className="flex w-full items-center gap-2 rounded-xl bg-void/40 px-3 py-2 text-left text-[12.5px] transition-colors duration-500 hover:bg-void/60">
                      <span className="text-ink-2">{META[m].label}</span>
                      <span className="ml-auto font-mono tabular text-ink">
                        {x?.current == null ? <span className="text-ink-3">not measured today</span> : <>{fmt(m, x.current)} <span className="text-ink-3">vs {fmt(m, x.baseline)}</span></>}
                      </span>
                      {x?.deviation_percent != null && (
                        <span className="w-14 text-right font-mono tabular" style={{ color: 'var(--color-alert)' }}>
                          {x.deviation_percent > 0 ? '+' : ''}
                          {x.deviation_percent.toFixed(0)}%
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">Both changes appear in the same 3-day window. Co-occurrence is not causation.</p>
          </motion.article>
        ))}

        {singles.map((x) => (
          <motion.button key={'s' + x.metric} layout {...item} onClick={() => onPick(x.metric)} className="st w-full rounded-2xl border border-line bg-panel p-4 text-left transition-colors duration-500 hover:border-line-2">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--color-watch)' }}>
              <STATUS.watch.icon className="size-3.5" aria-hidden /> Statistical change
            </p>
            <h4 className="mt-1.5 text-[14px] font-medium text-ink">{x.message}</h4>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <dt className="text-ink-3">Now</dt>
                <dd className="mt-0.5 font-mono text-[13px] tabular text-ink">
                  {fmt(x.metric, x.current)} <span className="text-[10px] text-ink-3">{META[x.metric].unit}</span>
                </dd>
              </div>
              <div>
                <dt className="text-ink-3">Baseline</dt>
                <dd className="mt-0.5 font-mono text-[13px] tabular text-ink-2">{fmt(x.metric, x.baseline)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Deviation</dt>
                <dd className="mt-0.5 font-mono text-[13px] tabular" style={{ color: 'var(--color-watch)' }}>
                  {x.deviation_percent == null ? '—' : `${x.deviation_percent > 0 ? '+' : ''}${x.deviation_percent.toFixed(1)}%`}
                </dd>
              </div>
            </dl>
            <p className="mt-2.5 font-mono text-[10px] text-ink-3">
              median of {x.sample_count} days · {x.method.replace('_', ' ')}
              {x.trend && x.trend !== 'insufficient_data' ? ` · trend ${x.trend}` : ''}
            </p>
          </motion.button>
        ))}

        {analytics && analytics.status === 'no_change_detected' && (
          <motion.div key="calm" layout {...item} className="rounded-2xl border border-line bg-panel p-4">
            <p className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-nominal)' }}>
              <Sparkles className="size-4" aria-hidden /> Everything within personal baseline
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">No statistical changes for this crew member on the replay date.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {insufficient.length > 0 && analytics?.status !== 'insufficient_data' && (
        <div className="px-1 pt-1">
          <Kicker>Waiting for data</Kicker>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">{insufficient.map((x) => META[x.metric].short).join(', ')} — not enough recent measurements for a baseline.</p>
        </div>
      )}
    </div>
  )
}
