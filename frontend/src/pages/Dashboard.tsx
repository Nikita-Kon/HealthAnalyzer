import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ServerCrash } from 'lucide-react'
import { api, USING_MOCK } from '@/api/client'
import type { MetricId } from '@/api/types'
import { useAnalytics, useAstronauts, useCrewAnalytics, useHistory, useSteps, useSummary, useThrottled } from '@/hooks/useHealthData'
import { isoAt, replay, useAsOf, useDay, useReplayRange, useSpeed, useStart, useLive } from '@/hooks/useReplay'
import { crewStatus, isAnomaly } from '@/lib/status'
import { TEAM, crewMember } from '@/lib/crew'
import { Brand } from '@/components/Brand'
import { CrewRail, CrewStrip } from '@/components/Crew'
import { useHeartRate } from '@/hooks/useHeartRate'
import { IntradayHeartRate } from '@/components/IntradayHeartRate'
import { BodyStage } from '@/components/body/BodyStage'
import { Vitals } from '@/components/Vitals'
import { Activity } from '@/components/Activity'
import { Notifications } from '@/components/Notifications'
import { MissionDate, ReplayBar, LiveSimulationButton } from '@/components/Replay'
import { Card, Kicker, StatusPill } from '@/components/ui'

const HistoryChart = lazy(() => import('@/components/HistoryChart').then((m) => ({ default: m.HistoryChart })))
const DEMO_START_DAY = 56 // just before the P01 demo episode

function useSelected(ids: string[]) {
  const read = () => window.location.hash.replace('#', '').toLowerCase()
  const [sel, setSel] = useState(read)
  useEffect(() => {
    const on = () => setSel(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const valid = ids.includes(sel) ? sel : (ids[0] ?? '')
  const select = (id: string) => {
    history.replaceState(null, '', `#${id}`)
    setSel(id)
  }
  return [valid, select] as const
}

export default function Dashboard() {
  const crewQ = useAstronauts()
  const crew = crewQ.data ?? []
  const ids = useMemo(() => crew.map((c) => c.id), [crew])
  const [sel, select] = useSelected(ids)

  // replay range = union of all participants' data
  const details = useQueries({ queries: ids.map((id) => ({ queryKey: ['astronaut', id], queryFn: () => api.astronaut(id), staleTime: Infinity })) })
  const range = useMemo(() => {
    const f = details.map((d) => d.data?.first_record_date).filter(Boolean) as string[]
    const l = details.map((d) => d.data?.last_record_date).filter(Boolean) as string[]
    if (!f.length || !l.length) return null
    const start = f.sort()[0], end = l.sort().at(-1)!
    return { start, days: Math.round((Date.parse(end) - Date.parse(start)) / 864e5) + 1 }
  }, [details.map((d) => d.dataUpdatedAt).join()]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (range) replay.init(range.start, range.days, replay.get().days > 1 ? undefined : Math.min(DEMO_START_DAY, range.days - 1))
  }, [range])

  const live = useLive()
  const speed = useSpeed()
  const asOf = useAsOf()
  const day = useDay()
  const start = useStart()
  const days = useReplayRange()
  const asOfSel = useThrottled(live ? isoAt(start, Math.max(0, day - 1)) : asOf, speed >= 4 ? 140 : 0)
  const asOfCrew = useThrottled(live ? isoAt(start, Math.max(0, day - 1)) : asOf, speed >= 4 ? 450 : speed >= 1 ? 120 : 0)

  const heart = useHeartRate(sel, asOf)
  const history = useHistory(sel || null)
  const analytics = useAnalytics(sel || null, asOfSel).data
  const summary = useSummary(sel || null, asOfSel).data
  const steps = useSteps(sel || null).data
  const crewA = useCrewAnalytics(ids, asOfCrew)
  const [metric, setMetric] = useState<MetricId>('resting_heart_rate')

  const me = sel ? crewMember(sel) : null
  const st = crewStatus(analytics)
  const nChanges = analytics?.findings.filter((f) => isAnomaly(f.status)).length ?? 0
  const pick = (m: MetricId) => {
    setMetric(m)
    document.getElementById('history')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  if (crewQ.isError)
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <ServerCrash className="mx-auto size-8 text-ink-3" />
          <p className="mt-4 font-display text-xl">Backend is not reachable</p>
          <p className="mt-2 max-w-sm text-sm text-ink-3">Start FastAPI on :8000 or set VITE_API_URL=mock. {String(crewQ.error?.message ?? '')}</p>
        </div>
      </div>
    )

  const crewProps = { crew, analytics: crewA, selected: sel, onSelect: select }

  return (
    <div className="min-h-dvh pb-28 lg:pb-10">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-line bg-void/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1680px] items-center gap-4 px-4 py-3 max-sm:flex-wrap max-sm:gap-y-2 sm:px-6 lg:gap-6">
          <Brand />
          <div className="hidden min-w-0 flex-1 lg:block">
            <ReplayBar />
          </div>
          <div className="ml-auto max-sm:w-full lg:ml-0">
            <div className="flex items-center gap-3 max-sm:justify-between"><LiveSimulationButton /><MissionDate /></div>
          </div>
        </div>
      </header>

      {/* MOBILE REPLAY — thumb zone */}
      <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden">
        <ReplayBar />
      </div>

      <main className="mx-auto grid max-w-[1680px] grid-cols-[minmax(0,1fr)] gap-4 px-4 pt-4 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)_320px] xl:grid-cols-[232px_minmax(0,1fr)_340px] lg:gap-5 lg:pt-5">
        {/* crew rail */}
        <aside className="hidden lg:sticky lg:top-[84px] lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex lg:max-h-[calc(100dvh-104px)] lg:self-start">
          <Card className="flex w-full flex-col p-2 pt-4">
            <CrewRail {...crewProps} />
          </Card>
        </aside>

        <div className="lg:hidden">
          <CrewStrip {...crewProps} />
        </div>

        {/* Keep the profile and vitals together so sidebar content cannot stretch the profile. */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:gap-5">
        {/* crew member */}
        <Card delay={0.05} className="shrink-0">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4 px-5 py-5 sm:flex-nowrap sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
              <Kicker>
                {me?.code ?? '—'} · {me?.role.label ?? ''} · as of {asOfSel}
              </Kicker>
                <span className="sm:hidden"><StatusPill status={st}>{analytics ? undefined : 'Syncing'}</StatusPill></span>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.h1
                  key={sel}
                  initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-1.5 font-display text-[clamp(1.6rem,3.2vw,2.6rem)] font-medium leading-[1.05] tracking-tight"
                >
                  {me?.callsign ?? '—'}
                </motion.h1>
              </AnimatePresence>
              <p className="st mt-2 text-[13px] text-ink-2 sm:text-sm">
                {!analytics
                  ? 'Syncing with mission data…'
                  : st === 'unknown'
                  ? 'Collecting enough days for a personal baseline.'
                  : st === 'nominal'
                    ? 'All tracked metrics are within the personal baseline.'
                    : `${nChanges} statistical change${nChanges === 1 ? '' : 's'}${analytics?.combined_findings.length ? `, ${analytics.combined_findings.length} combined` : ''} against the personal baseline.`}
              </p>
            </div>
            <div className="hidden h-[104px] w-px shrink-0 self-center bg-line sm:block" />
            <Activity data={steps?.data} asOf={asOfSel} />
            <span className="hidden shrink-0 sm:block"><StatusPill status={st}>{analytics ? undefined : 'Syncing'}</StatusPill></span>
          </div>
        </Card>

        {/* vitals */}
        <section className="min-w-0" aria-label="Current measurements">
          <Vitals summary={summary} analytics={analytics} history={history.data} asOf={asOfSel} active={metric} onPick={pick} />
        </section>

        </div>

        <Card className="p-4 sm:p-6 lg:col-start-2 lg:row-start-2">
          <IntradayHeartRate heart={heart} />
        </Card>

        {/* history */}
        <Card delay={0.12} className="scroll-mt-24 p-4 sm:p-6 lg:col-start-2 lg:col-span-2 lg:row-start-3">
          <div id="history" className="scroll-mt-28" />
          <Suspense fallback={<div className="h-[320px]" />}>
            <HistoryChart loading={history.loading} error={history.error} history={history.data} analytics={analytics} metric={metric} onMetric={setMetric} start={start} day={day} days={days} member={sel} />
          </Suspense>
        </Card>

        {/* alerts */}
        <aside className="min-h-0 lg:relative lg:col-start-3 lg:row-start-1 lg:self-stretch">
          <Card delay={0.08} className="flex min-h-0 flex-col overflow-hidden p-4 sm:p-5 lg:absolute lg:inset-0">
            <div className="mb-4 flex shrink-0 items-end justify-between">
              <div>
                <Kicker>Notifications</Kicker>
                <h2 className="mt-1 font-display text-lg font-medium">Alerts & explanations</h2>
              </div>
              <span className="font-mono text-xs text-ink-3 tabular">{nChanges + (analytics?.combined_findings.length ?? 0)}</span>
            </div>
            <div role="region" aria-label="Alerts list" tabIndex={0} className="min-h-0 max-h-[360px] flex-1 overflow-y-auto overscroll-contain pr-1 lg:max-h-none">
              <Notifications analytics={analytics} onPick={pick} />
            </div>
          </Card>
        </aside>

        {/* 3D body map */}
        <Card delay={0.2} className="flex flex-col overflow-hidden lg:col-start-3 lg:row-start-2">
          <div className="relative z-10 flex items-end justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
            <div>
              <Kicker>Body map · {me?.code ?? '—'}</Kicker>
              <h2 className="mt-1 font-display text-lg font-medium">3D health scan</h2>
            </div>
            <StatusPill status={st} />
          </div>
          <BodyStage analytics={analytics} bpm={heart.current?.bpm ?? null} />
        </Card>
      </main>

      <footer className="mx-auto max-w-[1680px] px-4 pb-6 pt-8 font-mono text-[10.5px] leading-relaxed text-ink-3 sm:px-6">
        <p>
          Participants are PMData volunteers on Earth, shown as demo crew members. Decision-support prototype, not a medical device. {USING_MOCK ? 'Running on mock data.' : 'Live API.'} Replay date {isoAt(start, day)}.
        </p>
        <p className="mt-1">Built by team {TEAM} for the NASA Space Apps Challenge 2026.</p>
        <p className="mt-1">3D body: MakeHuman base mesh (CC0) · skeleton & organs from Z-Anatomy / BodyParts3D (CC BY-SA 4.0), adapted.</p>
      </footer>
    </div>
  )
}
