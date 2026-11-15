import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Search, X } from 'lucide-react'
import type { Analytics, AstronautListItem } from '@/api/types'
import { crewMember, matchCrew } from '@/lib/crew'
import { STATUS, crewStatus, isAnomaly } from '@/lib/status'
import { Kicker, StatusDot } from './ui'

type Props = {
  crew: AstronautListItem[]
  analytics: Record<string, Analytics | undefined>
  selected: string
  onSelect: (id: string) => void
}

function CrewSearch({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`group relative flex items-center ${className ?? ''}`}>
      <Search className="pointer-events-none absolute left-3 size-3.5 text-ink-3 transition-colors duration-500 group-focus-within:text-ice" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
        placeholder="Search ID, callsign, role…"
        aria-label="Search crew"
        className="h-9 w-full rounded-full border border-line bg-void/40 pl-8 pr-8 text-[12.5px] text-ink outline-none transition-[border-color,background-color] duration-500 placeholder:text-ink-3 focus:border-line-2 focus:bg-void/60 [&::-webkit-search-cancel-button]:hidden"
      />
      <AnimatePresence>
        {value && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-2 grid size-5 place-items-center rounded-full text-ink-3 hover:text-ink"
          >
            <X className="size-3.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </label>
  )
}

/** desktop: vertical rail, fixed order (no reshuffling when someone's status changes) */
export function CrewRail({ crew, analytics, selected, onSelect }: Props) {
  const [q, setQ] = useState('')
  const attention = crew.filter((c) => ['watch', 'alert'].includes(crewStatus(analytics[c.id]))).length
  const shown = crew.filter((c) => matchCrew(c, q))
  return (
    <nav aria-label="Crew" className="flex min-h-0 flex-col">
      <div className="flex items-end justify-between px-3 pb-3">
        <div>
          <Kicker>Crew roster</Kicker>
          <h2 className="mt-1 whitespace-nowrap font-display text-base font-medium">{crew.length} members</h2>
        </div>
        <p className="st max-w-[72px] pb-0.5 text-right text-[10px] text-ink-3">
          <span className="font-display text-base font-medium tabular" style={{ color: attention ? 'var(--color-watch)' : 'var(--color-ink-2)' }}>
            {attention}
          </span>{' '}
          need attention
        </p>
      </div>
      <CrewSearch value={q} onChange={setQ} className="mx-1 mb-2" />
      <ul className="no-scrollbar -mr-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {shown.map((c) => {
            const a = analytics[c.id]
            const st = crewStatus(a)
            const n = a?.findings.filter((f) => isAnomaly(f.status)).length ?? 0
            const active = c.id === selected
            const m = crewMember(c.id)
            return (
              <motion.li key={c.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                <button onClick={() => onSelect(c.id)} aria-current={active} title={`${m.code} · ${m.callsign} · ${m.role.label}`} className="group relative flex w-full items-center gap-3 rounded-2xl px-3 py-[7px] text-left">
                  {active && <motion.span layoutId="crew-active" className="absolute inset-0 rounded-2xl border border-line-2 bg-raise/80" transition={{ type: 'spring', stiffness: 340, damping: 34 }} />}
                  <span className="relative z-10 flex w-full items-center gap-3">
                    <StatusDot status={st} ring={st === 'alert'} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] text-ink">{m.code}</span>
                        <span className={`st truncate text-[13px] ${active ? 'text-ink' : 'text-ink-2 group-hover:text-ink'}`}>{m.callsign}</span>
                        <span className="font-mono text-[9.5px] text-ink-3">{m.role.code}</span>
                      </span>
                      <span className="st mt-0.5 block font-mono text-[10px] uppercase tracking-wider" style={{ color: n ? STATUS[st].color : 'var(--color-ink-3)' }}>
                        {!a ? 'syncing…' : st === 'unknown' ? 'not enough data' : n ? `${n} change${n > 1 ? 's' : ''}${a?.combined_findings.length ? ' · combined' : ''}` : 'within baseline'}
                      </span>
                    </span>
                  </span>
                </button>
              </motion.li>
            )
          })}
        </AnimatePresence>
        {!shown.length && <li className="px-3 py-6 text-center text-[12.5px] text-ink-3">No crew member matches “{q.trim()}”.</li>}
      </ul>
    </nav>
  )
}

/** tablet / phone: search + horizontal strip */
export function CrewStrip({ crew, analytics, selected, onSelect }: Props) {
  const [q, setQ] = useState('')
  const shown = crew.filter((c) => matchCrew(c, q))
  return (
    <div>
      <CrewSearch value={q} onChange={setQ} className="mb-2" />
      <nav aria-label="Crew" className="no-scrollbar -mx-4 flex snap-x gap-1.5 overflow-x-auto scroll-px-4 px-4 py-1">
        {shown.map((c) => {
          const st = crewStatus(analytics[c.id])
          const active = c.id === selected
          const m = crewMember(c.id)
          return (
            <button key={c.id} onClick={() => onSelect(c.id)} aria-current={active} className="relative flex h-10 shrink-0 snap-start items-center gap-2 rounded-full px-3.5">
              {active ? (
                <motion.span layoutId="crew-strip" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 380, damping: 34 }} />
              ) : (
                <span className="absolute inset-0 rounded-full border border-line bg-panel" />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <StatusDot status={st} size={7} />
                <span className={`font-mono text-xs transition-colors duration-500 ${active ? 'text-void' : 'text-ink-2'}`}>{m.code}</span>
                <span className={`text-xs transition-colors duration-500 ${active ? 'text-void/70' : 'text-ink-3'}`}>{m.callsign}</span>
              </span>
            </button>
          )
        })}
        {!shown.length && <p className="px-1 py-2.5 text-[12.5px] text-ink-3">No match.</p>}
      </nav>
    </div>
  )
}
