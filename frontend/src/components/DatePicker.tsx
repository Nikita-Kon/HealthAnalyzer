import { useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { isoAt, replay, useDay, useStart, useTotalDays, useLive } from '@/hooks/useReplay'

const phoneQuery = '(width < 640px)'
const subscribePhone = (notify: () => void) => {
  const query = window.matchMedia(phoneQuery)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}

export function DatePicker({ children }: { children: React.ReactNode }) {
  const phone = useSyncExternalStore(subscribePhone, () => window.matchMedia(phoneQuery).matches, () => false)
  const day = useDay(), start = useStart(), total = useTotalDays(), live = useLive()
  const selected = isoAt(start, day), last = isoAt(start, Math.max(0, total - 4))
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(selected.slice(0, 7))
  const first = new Date(month + '-01T00:00:00Z')
  const offset = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const move = (n: number) => setMonth(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1)).toISOString().slice(0, 7))
  const calendar = (<>
        <button aria-label="Close date picker" className="fixed inset-0 z-50 cursor-default max-sm:bg-black/50" onClick={() => setOpen(false)} />
        <div role="dialog" aria-label="Replay calendar" className="max-sm:fixed max-sm:left-1/2 max-sm:right-auto max-sm:top-1/2 max-sm:-translate-x-1/2 max-sm:-translate-y-1/2 max-sm:mt-0 max-sm:max-h-[calc(100dvh-32px)] max-sm:overflow-y-auto absolute right-0 top-full z-[60] mt-3 w-[300px] max-w-[calc(100vw-24px)] rounded-3xl border border-line-2 bg-panel-solid p-5 text-ink shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <button autoFocus aria-label="Previous month" disabled={month <= start.slice(0, 7)} onClick={() => move(-1)} className="rounded-lg px-3 py-1 hover:bg-raise disabled:opacity-25">‹</button>
            <h2 className="font-display text-sm">{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
            <button aria-label="Next month" disabled={month >= last.slice(0, 7)} onClick={() => move(1)} className="rounded-lg px-3 py-1 hover:bg-raise disabled:opacity-25">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {['M','T','W','T','F','S','S'].map((d,i) => <span key={i} className="pb-2 text-ink-3">{d}</span>)}
            {Array.from({ length: offset }, (_, i) => <span key={`blank${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, '0')}`
              const disabled = !!live || date < start || date > last
              return <button key={date} aria-label={date} aria-pressed={date === selected} disabled={disabled}
                onClick={() => { replay.seek(Math.round((Date.parse(date) - Date.parse(start)) / 864e5)); setOpen(false) }}
                className={`h-8 rounded-full transition-colors disabled:opacity-20 ${date === selected ? 'bg-ice text-void' : 'hover:bg-raise'}`}>{i + 1}</button>
            })}
          </div>
          <p className="mt-4 text-left text-xs leading-relaxed text-ink-3">{live ? 'Stop live simulation to choose a historical date.' : 'The final 3 days are reserved for live simulation.'}</p>
          <button onClick={() => setOpen(false)} className="mt-3 w-full rounded-xl border border-line py-2 text-xs hover:bg-raise">Close</button>
        </div>
      </>)
  return (
    <div className="relative" onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}>
      <button aria-label="Choose replay date" aria-expanded={open} onClick={() => { setMonth(selected.slice(0, 7)); setOpen(!open) }} className="rounded-xl px-2 py-1 text-right transition-colors hover:bg-raise focus-visible:outline-ice">{children}</button>
      {open && (phone ? createPortal(calendar, document.body) : calendar)}
    </div>
  )
}
