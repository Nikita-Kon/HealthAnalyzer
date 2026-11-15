import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { HeartPulse, Move3d } from 'lucide-react'
import type { Analytics } from '@/api/types'
import { bodyMap, type Organ } from '@/lib/body'
import { STATUS } from '@/lib/status'

const BodyScene = lazy(() => import('./BodyScene'))

// ?lite (or no WebGL) → skip the 3D scene; handy on weak devices and for perf testing
const LITE = (() => {
  if (typeof window === 'undefined') return true
  if (new URLSearchParams(window.location.search).has('lite')) return true
  try {
    const c = document.createElement('canvas')
    return !(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return true
  }
})()

export function BodyStage({ analytics, bpm }: { analytics?: Analytics; bpm: number | null }) {
  const organs = useMemo(() => bodyMap(analytics), [analytics])
  const [selected, setSelected] = useState<Organ | null>(null)
  const labels = useRef(new Map<Organ, HTMLElement>())

  return (
    <div className="relative h-[min(54svh,560px)] min-h-[360px] w-full overflow-hidden sm:h-[min(66svh,700px)]">
      {/* scanner frame */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(48%_52%_at_50%_48%,oklch(0.32_0.07_215/0.35),transparent_72%)]" />
      {LITE ? (
        <div className="grid h-full place-items-center font-mono text-[11px] uppercase tracking-[0.3em] text-ink-3">3D view off</div>
      ) : (
        <Suspense fallback={<div className="grid h-full place-items-center font-mono text-[11px] uppercase tracking-[0.3em] text-ink-3">Calibrating scan…</div>}>
          <BodyScene organs={organs} selected={selected} bpm={bpm ?? 60} labels={labels} />
        </Suspense>
      )}

      {/* organ labels, positioned by the scene every frame */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {organs.map((o) => {
          const flagged = o.status === 'watch' || o.status === 'alert'
          const show = flagged || selected === o.organ
          const c = STATUS[o.status].color
          return (
            <div
              key={o.organ}
              ref={(el) => {
                if (el) labels.current.set(o.organ, el)
                else labels.current.delete(o.organ)
              }}
              data-side="r"
              className="group absolute left-0 top-0"
              style={{ willChange: 'transform' }}
            >
              <button
                onClick={() => setSelected(selected === o.organ ? null : o.organ)}
                tabIndex={show ? 0 : -1}
                className={`st relative flex items-center whitespace-nowrap pl-7 group-data-[side=l]:pl-0 group-data-[side=l]:pr-7 ${show ? 'pointer-events-auto opacity-100' : 'opacity-0'}`}
              >
                <span className="absolute left-0 top-1/2 h-px w-6 group-data-[side=l]:left-auto group-data-[side=l]:right-0" style={{ background: `linear-gradient(90deg, ${c}, transparent)` }} />
                <span className="st rounded-full border px-3 py-1 text-[11.5px] backdrop-blur-md" style={{ color: c, borderColor: `color-mix(in oklab, ${c} 45%, transparent)`, background: 'oklch(0.14 0.014 255 / 0.72)' }}>
                  <span className="font-medium">{o.title}</span>
                  <span className="ml-1.5 hidden text-ink-3 sm:inline">{o.system}</span>
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute left-4 top-4 sm:left-5 sm:top-5">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
          <HeartPulse className="size-3.5 text-alert/80" style={{ animation: `breathe ${60 / (bpm ?? 60)}s ease-in-out infinite` }} aria-hidden />
          {bpm ?? '—'} bpm rest
        </p>
      </div>
      <p className="pointer-events-none absolute right-4 top-4 hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 sm:flex">
        <Move3d className="size-3.5" aria-hidden /> drag to rotate
      </p>

      {/* organ legend / selector */}
      <div className="no-scrollbar absolute inset-x-0 bottom-3 flex gap-1.5 overflow-x-auto px-3 sm:flex-wrap sm:justify-center">
        {organs.map((o) => {
          const s = STATUS[o.status]
          const Icon = s.icon
          return (
            <button
              key={o.organ}
              onClick={() => setSelected(selected === o.organ ? null : o.organ)}
              aria-pressed={selected === o.organ}
              title={o.detail}
              className={`st flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] backdrop-blur-md ${selected === o.organ ? 'border-line-2 bg-raise/90 text-ink' : 'border-line bg-void/50 text-ink-2 hover:text-ink'}`}
            >
              <Icon className="st size-3.5" style={{ color: s.color }} aria-hidden />
              {o.title}
            </button>
          )
        })}
      </div>
      {selected && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-4">
          <p className="max-w-md rounded-2xl border border-line bg-panel-solid/85 px-4 py-2 text-center text-[12px] text-ink-2 backdrop-blur-md">{organs.find((o) => o.organ === selected)?.detail}</p>
        </div>
      )}
    </div>
  )
}
