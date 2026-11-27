import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { ColorDot } from '#/components/ui/controls'
import { ProgressBar } from '#/components/ui/progress-bar'
import { StatGrid, StatTile } from '#/components/ui/stats'
import { percentOf } from '#/domain/numbers'
import { sprintDay } from '#/domain/sprint-stats'
import { SectionHeader } from '#/features/settings/components/ui'
import { SummaryDialog } from '#/features/time-entries/components/summary-dialog'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate, formatDateRange } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'
import { DeleteTaskDialog } from '../delete-task-dialog'
import { TaskFilters } from './task-filters'
import { TaskRowView } from './task-row'
import { useTasksViewModel } from './use-tasks'
import type { TasksProps, TasksViewModel } from './use-tasks'

/**
 * Strona Zadania (widok w MVVM): sprint, liczby, filtry i lista zadań w grupach.
 * Stan i dane: `useTasksViewModel`; reguły listy: domain/task-list.
 */
export function TasksPage(props: TasksProps = {}) {
  const t = useMessages(panelMessages).tasks
  const vm = useTasksViewModel(props)
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title={t.title} lead={t.lead} />
      <SprintBanner vm={vm} />
      <TaskStats vm={vm} />
      <TaskFilters vm={vm} />

      {vm.isFree && (
        <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          {t.freeNote}
          <Link
            to="/app/settings/plan"
            className="font-semibold text-ink underline underline-offset-4"
          >
            {t.upgrade}
          </Link>
        </p>
      )}

      <TaskList vm={vm} />

      <DeleteTaskDialog
        task={vm.deletingTask}
        date={null}
        sessions={vm.deletingTask?.sessions ?? 0}
        minutes={vm.deletingTask?.minutes ?? 0}
        onClose={vm.closeDelete}
      />
      {vm.summarizing && (
        <SummaryDialog
          entry={vm.summarizing}
          type={vm.typeOf(vm.summarizing.taskTypeId)}
          onClose={vm.closeSummary}
        />
      )}
    </div>
  )
}

interface SprintBannerProps {
  vm: TasksViewModel
}

/** Wybrany sprint: nazwa, daty, dzień sprintu, cel i postęp czasu. */
function SprintBanner({ vm }: SprintBannerProps) {
  const t = useMessages(panelMessages).tasks
  const { locale } = useI18n()
  const { sprint, today } = vm
  if (!sprint) return null
  const day = sprintDay(sprint, today)
  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="type-heading text-xl">{sprint.name}</p>
        <p className="text-sm text-ink-soft tabular-nums">
          {formatDateRange(locale, sprint.startsOn, sprint.endsOn)}
          <span aria-hidden> · </span>
          {sprint.endsOn < today ? t.sprintEnded : fmt(t.sprintDay, day)}
        </p>
      </div>
      {sprint.goal && <p className="mt-1 text-[0.9375rem]">{sprint.goal}</p>}
      <ProgressBar value={(day.day / day.total) * 100} className="mt-3 h-1" />
    </div>
  )
}

interface TaskStatsProps {
  vm: TasksViewModel
}

/** Liczby nad listą: zadania (zakończone), SP (wobec pojemności), czas, ponad wycenę. */
function TaskStats({ vm }: TaskStatsProps) {
  const t = useMessages(panelMessages).tasks
  const format = useFormat()
  const { totals, sprint } = vm
  return (
    <StatGrid className="mb-6">
      <StatTile
        label={t.tiles.tasks}
        value={String(totals.tasks)}
        hint={fmt(t.tiles.doneOf, { done: vm.doneCount })}
      />
      <StatTile
        label={t.tiles.sp}
        value={format.number(vm.spTotal)}
        hint={
          sprint?.capacityStoryPoints
            ? fmt(t.tiles.spOf, {
                capacity: format.number(sprint.capacityStoryPoints),
              })
            : undefined
        }
      />
      <StatTile
        label={t.tiles.time}
        value={format.minutes(totals.minutes)}
        hint={
          totals.minutesPerSp === null
            ? undefined
            : fmt(t.tiles.perSp, { time: format.minutes(totals.minutesPerSp) })
        }
      />
      <StatTile
        label={t.tiles.over}
        value={vm.estimatedCount ? String(vm.overCount) : '–'}
        hint={
          vm.estimatedCount
            ? fmt(t.tiles.overOf, { total: vm.estimatedCount })
            : undefined
        }
      />
    </StatGrid>
  )
}

interface TaskListProps {
  vm: TasksViewModel
}

/** Lista w grupach (rodzaj, dzień albo jedna), ładowanie, pusty stan i „Pokaż więcej”. */
function TaskList({ vm }: TaskListProps) {
  const t = useMessages(panelMessages).tasks
  const format = useFormat()
  const { locale } = useI18n()
  if (vm.pending)
    return (
      <div
        role="status"
        className="space-y-3 rounded-2xl border border-line bg-surface p-5"
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden
            className="h-14 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    )
  if (vm.visible.length === 0)
    return (
      <div className="rounded-2xl border border-line bg-surface px-5 py-8 sm:px-6">
        <p className="text-ink-soft">{vm.filtering ? t.noMatch : t.empty}</p>
        {vm.filtering ? (
          <Button variant="outline" className="mt-4" onClick={vm.clearFilters}>
            {t.clear}
          </Button>
        ) : (
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/app">{t.emptyCta}</Link>
          </Button>
        )}
      </div>
    )
  const groupTitle = (key: string) =>
    vm.grouping === 'kind'
      ? (vm.typeOf(key)?.name ?? '?')
      : vm.grouping === 'day'
        ? formatDate(locale, key, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })
        : t.title
  return (
    <>
      <p role="status" className="mb-3 text-sm text-ink-soft">
        {format.plural(t.showing, vm.visible.length)}
      </p>
      <div className="space-y-5">
        {vm.groups.map((group) => {
          const type = vm.grouping === 'kind' ? vm.typeOf(group.key) : undefined
          const percent = percentOf(group.minutes, vm.totals.minutes)
          return (
            <section
              key={group.key}
              aria-labelledby={`group-${group.key}`}
              className="overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-muted/40 px-5 py-3 sm:px-6">
                <h2
                  id={`group-${group.key}`}
                  className="flex items-center gap-2 font-semibold"
                >
                  {type && <ColorDot color={type.color} />}
                  {groupTitle(group.key)}
                </h2>
                <p className="text-sm text-ink-soft tabular-nums">
                  {format.plural(t.group.count, group.items.length)}
                  <span aria-hidden> · </span>
                  {format.minutes(group.minutes)}
                  {vm.grouping !== 'none' && (
                    <>
                      <span aria-hidden> · </span>
                      {fmt(t.group.share, { percent })}
                    </>
                  )}
                </p>
              </header>
              <div
                aria-hidden
                className="hidden grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_8.5rem_8.5rem_8.75rem] gap-x-5 border-b border-line px-6 py-2 text-xs font-medium text-ink-soft lg:grid"
              >
                <span />
                <span>{t.columns.task}</span>
                <span className="text-right">{t.columns.sp}</span>
                <span>{t.columns.time}</span>
                <span>{t.columns.estimate}</span>
                <span />
              </div>
              <ul className="divide-y divide-line">
                {group.items.map((item) => (
                  <TaskRowView key={item.row.key} item={item} vm={vm} />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      {vm.hasMore && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={vm.showMore}>
            {fmt(t.more, { n: vm.moreCount })}
          </Button>
        </div>
      )}
    </>
  )
}
