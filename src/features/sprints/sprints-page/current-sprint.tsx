import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '#/components/ui/button'
import { ColorDot } from '#/components/ui/controls'
import { StatGrid, StatTile } from '#/components/ui/stats'
import { percentOf } from '#/domain/numbers'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate, formatDateRange } from '#/i18n/format'
import { daysOffMessages } from '#/i18n/messages/days-off'
import { panelMessages } from '#/i18n/messages/panel'
import { TimeGoals } from './time-goals'
import { TypeBar } from './type-bar'
import type { SprintsViewModel } from './use-sprints'

/** Bieżący sprint: dzień sprintu, liczby, dostępność, cele czasu, podział i linki. */
export function CurrentSprint({ vm }: { vm: SprintsViewModel }) {
  const t = useMessages(panelMessages).sprints
  const { locale } = useI18n()
  const { current } = vm
  return (
    <section
      aria-labelledby="current-sprint"
      className="rounded-2xl border border-line bg-surface"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <p className="text-sm font-medium text-ink-soft">{t.current}</p>
          <h2 id="current-sprint" className="type-heading text-2xl">
            {current ? current.name : t.noCurrent}
          </h2>
        </div>
        {current && (
          <p className="text-sm text-ink-soft">
            {formatDateRange(locale, current.startsOn, current.endsOn)}
          </p>
        )}
      </header>
      {current && vm.currentStats ? (
        <CurrentSprintBody vm={vm} />
      ) : (
        <div className="px-5 py-6 sm:px-6">
          {vm.sprintsPending ? (
            <div
              aria-hidden
              className="h-24 animate-pulse rounded-lg bg-muted"
            />
          ) : (
            <Link
              to="/app/settings/sprints"
              className={buttonVariants({ variant: 'default' })}
            >
              {t.noCurrentCta}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

function CurrentSprintBody({ vm }: { vm: SprintsViewModel }) {
  const t = useMessages(panelMessages).sprints
  const tasks = useMessages(panelMessages).tasks
  const off = useMessages(daysOffMessages)
  const format = useFormat()
  const { locale } = useI18n()
  const { current, currentStats: stats, day, upcoming } = vm
  if (!current || !stats || !day) return null
  const available = vm.availability(current)
  const dayOf = fmt(t.dayOf, day)
  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="mb-5">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="font-medium">{dayOf}</span>
          {current.goal && (
            <span className="max-w-[60%] truncate text-ink-soft">
              {t.goal}: {current.goal}
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-label={dayOf}
          aria-valuemin={0}
          aria-valuemax={day.total}
          aria-valuenow={day.day}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="bar-grow h-full rounded-full bg-ink"
            style={{ width: `${(day.day / day.total) * 100}%` }}
          />
        </div>
      </div>

      <StatGrid cols={5} className="rounded-xl">
        <StatTile
          label={t.logged}
          value={format.minutes(stats.minutes)}
          hint={
            stats.overtimeMinutes > 0
              ? fmt(tasks.summary.overtime, {
                  time: format.minutes(stats.overtimeMinutes),
                })
              : undefined
          }
        />
        <StatTile
          label={t.points}
          value={
            current.capacityStoryPoints
              ? fmt(t.ofCapacity, {
                  done: format.number(stats.storyPoints),
                  capacity: format.number(current.capacityStoryPoints),
                })
              : format.sp(stats.storyPoints)
          }
        />
        <StatTile
          label={t.perSp}
          value={
            stats.minutesPerSp === null
              ? '–'
              : format.minutes(stats.minutesPerSp)
          }
          hint={stats.minutesPerSp === null ? t.noSp : undefined}
        />
        <StatTile label={t.tasks} value={String(stats.tasks)} />
        <StatTile
          className="col-span-2 lg:col-span-1"
          label={off.sprint.available}
          value={fmt(off.sprint.availableValue, {
            available: available.available,
            working: available.working,
          })}
          hint={
            available.off === 0
              ? off.sprint.none
              : format
                  .plural(off.sprint.off, available.off)
                  .replace('{kinds}', vm.offSummary(available.byKind))
          }
        />
      </StatGrid>

      {vm.goals.length > 0 && (
        <TimeGoals progress={vm.goals} types={vm.types} />
      )}

      {stats.minutes === 0 ? (
        <p className="mt-5 text-ink-soft">
          {vm.entriesPending ? '…' : t.empty}
        </p>
      ) : (
        <div className="mt-6">
          <h3 className="mb-3 font-semibold">{t.breakdown}</h3>
          <TypeBar rows={stats.types} types={vm.types} className="h-4" />
          <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.types.map((r) => {
              const type = vm.typeOf(r.taskTypeId)
              return (
                <li
                  key={r.taskTypeId}
                  className="flex items-center gap-2.5 text-[0.9375rem]"
                >
                  <ColorDot color={type?.color ?? 'var(--wt-custom)'} />
                  <span className="min-w-0 flex-1 truncate">
                    {type?.name ?? '?'}
                  </span>
                  <span className="tabular-nums">
                    {format.minutes(r.minutes)}
                  </span>
                  <span className="w-11 text-right text-ink-soft tabular-nums">
                    {percentOf(r.minutes, stats.minutes)}%
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-ink-soft">
          {upcoming &&
            fmt(t.upcoming, {
              name: upcoming.name,
              date: formatDate(locale, upcoming.startsOn, {
                day: 'numeric',
                month: 'short',
              }),
            })}
        </p>
        <span className="flex flex-wrap gap-2">
          <Link
            to="/app/tasks"
            search={{ sprint: current.id }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {t.openTasks}
          </Link>
          <Link
            to="/app/analytics"
            search={{ sprint: current.id }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {t.openReport}
            <ArrowRight aria-hidden />
          </Link>
        </span>
      </div>
    </div>
  )
}
