import { motion } from 'motion/react'
import { TEAM } from '@/lib/crew'

/** Metamorphosis mark — a chrysalis opening into wings, drawn on first paint */
export function BrandMark({ className }: { className?: string }) {
  const ease = [0.22, 1, 0.36, 1] as const
  const wing = { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 } }
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <motion.path {...wing} transition={{ duration: 1.1, ease }} d="M16 15C13 8 7 4.5 4.5 6.5 2.5 8.2 4 14 9 16c-4 1.5-5 6-2.6 7.6C9 25.2 13.5 22 16 17" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <motion.path {...wing} transition={{ duration: 1.1, delay: 0.12, ease }} d="M16 15c3-7 9-10.5 11.5-8.5C29.5 8.2 28 14 23 16c4 1.5 5 6 2.6 7.6C23 25.2 18.5 22 16 17" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <motion.path initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.7, ease }} style={{ transformOrigin: '16px 16px' }} d="M16 11.5v13" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

export function Brand() {
  return (
    <a href="#" className="group flex shrink-0 items-center gap-2.5" aria-label={`${TEAM} · AstroHealth`}>
      <span className="relative grid size-9 place-items-center rounded-xl border border-line-2 bg-panel transition-[box-shadow,border-color] duration-700 group-hover:border-ice/40 group-hover:shadow-[0_0_24px_oklch(0.86_0.1_210/0.35)]">
        <BrandMark className="size-5 text-ice" />
      </span>
      <span className="leading-none">
        <span className="block font-display text-[15px] font-semibold tracking-tight">
          {TEAM}
          <span className="ml-1.5 font-normal text-ink-3">/ AstroHealth</span>
        </span>
        <span className="mt-1 hidden font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-3 sm:block">Crew health monitor · NASA Space Apps 2026</span>
      </span>
    </a>
  )
}
