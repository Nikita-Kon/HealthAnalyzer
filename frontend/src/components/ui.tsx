import { useEffect, type ReactNode } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { STATUS, type Status } from '@/lib/status'

/** Number that glides to its new value instead of jumping */
export function Ticker({ value, digits = 0, className }: { value: number | null | undefined; digits?: number; className?: string }) {
  const spring = useSpring(value ?? 0, { stiffness: 120, damping: 24, mass: 0.6 })
  const text = useTransform(spring, (v) => v.toFixed(digits))
  useEffect(() => {
    if (value != null) spring.set(value)
  }, [value, spring])
  if (value == null) return <span className={className}>—</span>
  return <motion.span className={`tabular ${className ?? ''}`}>{text}</motion.span>
}

export function StatusDot({ status, size = 8, ring }: { status: Status; size?: number; ring?: boolean }) {
  return (
    <span className="st relative inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: STATUS[status].color, boxShadow: ring ? `0 0 0 3px color-mix(in oklab, ${STATUS[status].color} 22%, transparent), 0 0 12px color-mix(in oklab, ${STATUS[status].color} 55%, transparent)` : undefined }}>
      {(status === 'alert' || status === 'watch') && <span className="absolute inset-0 animate-breathe rounded-full" style={{ boxShadow: `0 0 0 4px color-mix(in oklab, ${STATUS[status].color} 30%, transparent)` }} />}
    </span>
  )
}

export function StatusPill({ status, children }: { status: Status; children?: ReactNode }) {
  const s = STATUS[status]
  const Icon = s.icon
  return (
    <span className="st inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide" style={{ color: s.color, borderColor: `color-mix(in oklab, ${s.color} 38%, transparent)`, background: `color-mix(in oklab, ${s.color} 11%, transparent)` }}>
      <Icon className="size-3.5" aria-hidden />
      {children ?? s.label}
    </span>
  )
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3 ${className ?? ''}`}>{children}</p>
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`glass relative min-w-0 rounded-3xl ${className ?? ''}`}>{children}</section>
}

/** segmented control with a sliding pill */
export function Segmented<T extends string | number>({ value, onChange, options, id, size = 'md' }: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode }[]; id: string; size?: 'sm' | 'md' }) {
  return (
    <div className="relative flex rounded-full border border-line bg-void/40 p-0.5" role="group">
      {options.map((o) => (
        <button
          key={String(o.id)}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`relative z-10 whitespace-nowrap rounded-full font-medium transition-colors duration-500 ${size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'} ${value === o.id ? 'text-void' : 'text-ink-2 hover:text-ink'}`}
        >
          {value === o.id && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 -z-10 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 380, damping: 34 }} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Lightweight SVG sparkline (no chart lib — cheap enough for 16+ instances updating every replay tick) */
export function Sparkline({ values, color = 'var(--color-ice)', width = 72, height = 22, domain, baseline }: { values: (number | null)[]; color?: string; width?: number; height?: number; domain?: [number, number]; baseline?: number | null }) {
  const v = values.filter((x): x is number => x != null)
  if (v.length < 2) return <svg width={width} height={height} aria-hidden />
  const lo = domain?.[0] ?? Math.min(...v, baseline ?? Infinity)
  const hi = domain?.[1] ?? Math.max(...v, baseline ?? -Infinity)
  const pad = (hi - lo) * 0.12 || 1
  const y = (x: number) => height - 2 - ((x - lo + pad) / (hi - lo + 2 * pad)) * (height - 4)
  const step = width / Math.max(1, values.length - 1)
  let d = ''
  let pen = false
  values.forEach((x, i) => {
    if (x == null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${(i * step).toFixed(1)},${y(x).toFixed(1)}`
    pen = true
  })
  const lastI = values.length - 1 - [...values].reverse().findIndex((x) => x != null)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden>
      {baseline != null && <line x1={0} x2={width} y1={y(baseline)} y2={y(baseline)} stroke="var(--color-ink-3)" strokeDasharray="2 3" strokeWidth={1} opacity={0.6} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="st" />
      <circle cx={lastI * step} cy={y(values[lastI]!)} r={2.2} fill={color} />
    </svg>
  )
}
