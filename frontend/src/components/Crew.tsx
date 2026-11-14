import { motion } from 'motion/react'
import type { Analytics, AstronautListItem } from '@/api/types'
import { upTo } from '@/hooks/useHealthData'
import { STATUS, crewStatus, isAnomaly } from '@/lib/status'
import { Kicker, Sparkline, StatusDot } from './ui'

type Props = {
  crew: AstronautListItem[]
  analytics: Record<string, Analytics | undefined>
  rhr: Record<string, { date: string; value: number }[]>
  asOf: string
  selected: string
  onSelect: (id: string) => void
}

function last(rows: { date: string; value: number }[], asOf: string, n: number) {
  const r = upTo(rows, asOf)
  return r.slice(-n).map((x) => x.value)
}

/** desktop: vertical rail, fixed order (no reshuffling when someone's status changes) */
export function CrewRail({ crew, analytics, rhr, asOf, selected, onSelect }: Props) {
  const attention = crew.filter((c) => ['watch', 'alert'].includes(crewStatus(analytics[c.id]))).length
  return (
    <nav aria-label="Crew" className="flex min-h-0 flex-col">
      <div className="flex items-end justify-between px-3 pb-3">
        <div>
          <Kicker>Demo crew · PMData</Kicker>
          <h2 className="mt-1 font-display text-lg font-medium">{crew.length} members</h2>
        </div>
        <p className="st pb-0.5 text-right text-xs text-ink-3">
          <span className="font-display text-base font-medium tabular" style={{ color: attention ? 'var(--color-watch)' : 'var(--color-ink-2)' }}>
            {attention}
          </span>{' '}
          need attention
        </p>
      </div>
      <ul className="no-scrollbar -mr-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto pr-1">
        {crew.map((c) => {
          const a = analytics[c.id]
          const st = crewStatus(a)
          const n = a?.findings.filter((f) => isAnomaly(f.status)).length ?? 0
          const active = c.id === selected
          return (
            <li key={c.id}>
              <button onClick={() => onSelect(c.id)} aria-current={active} className="group relative flex w-full items-center gap-3 rounded-2xl px-3 py-[7px] text-left">
                {active && <motion.span layoutId="crew-active" className="absolute inset-0 rounded-2xl border border-line-2 bg-raise/80" transition={{ type: 'spring', stiffness: 340, damping: 34 }} />}
                <span className="relative z-10 flex w-full items-center gap-3">
                  <StatusDot status={st} ring={st === 'alert'} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-ink">{c.id.toUpperCase()}</span>
                      <span className={`st truncate text-[13px] ${active ? 'text-ink' : 'text-ink-2 group-hover:text-ink'}`}>{c.name.replace(/^Demo Crew /, 'Demo crew ')}</span>
                    </span>
                    <span className="st mt-0.5 block font-mono text-[10px] uppercase tracking-wider" style={{ color: n ? STATUS[st].color : 'var(--color-ink-3)' }}>
                      {st === 'unknown' ? 'not enough data' : n ? `${n} change${n > 1 ? 's' : ''}${a?.combined_findings.length ? ' · combined' : ''}` : 'within baseline'}
                    </span>
                  </span>
                  <Sparkline values={last(rhr[c.id] ?? [], asOf, 21)} color={st === 'nominal' || st === 'unknown' ? 'var(--color-ink-3)' : STATUS[st].color} width={58} height={20} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** tablet / phone: horizontal strip */
export function CrewStrip({ crew, analytics, selected, onSelect }: Props) {
  return (
    <nav aria-label="Crew" className="no-scrollbar -mx-4 flex snap-x gap-1.5 overflow-x-auto scroll-px-4 px-4 py-1">
      {crew.map((c) => {
        const st = crewStatus(analytics[c.id])
        const active = c.id === selected
        return (
          <button key={c.id} onClick={() => onSelect(c.id)} aria-current={active} className="relative flex h-10 shrink-0 snap-start items-center gap-2 rounded-full px-3.5">
            {active ? (
              <motion.span layoutId="crew-strip" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 380, damping: 34 }} />
            ) : (
              <span className="absolute inset-0 rounded-full border border-line bg-panel" />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <StatusDot status={st} size={7} />
              <span className={`font-mono text-xs transition-colors duration-500 ${active ? 'text-void' : 'text-ink-2'}`}>{c.id.toUpperCase()}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
