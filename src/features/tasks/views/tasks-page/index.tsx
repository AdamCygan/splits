import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { ColorDot } from '#/components/ui/controls'
import { ProgressBar } from '#/components/ui/progress-bar'
import { StatGrid, StatTile } from '#/components/ui/stats'
import { percentOf } from '#/shared/domain/numbers'
import { sprintDay } from '#/features/sprints/domain/sprint-stats'
import { SectionHeader } from '#/features/settings/views/ui'
import { SummaryDialog } from '#/features/time-entries/views/summary-dialog'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate, formatDateRange } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'
import { DeleteTaskDialog } from '../delete-task-dialog'
import { TaskFilters } from './task-filters'
import { TaskRowView } from './task-row'
import { useTasksViewModel } from '../../controllers/use-tasks'
import type { TasksProps, TasksViewModel } from '../../controllers/use-tasks'

/**
 * Strona Zadania (widok w MVVM): sprint, liczby, filtry i lista zadań w grupach.
 * Stan i dane: `useTasksViewModel`; reguły listy: domain/task-list.
 */
export function TasksPage(props: TasksProps = {}) {
  const messages = useMessages(panelMessages).tasks
  const viewModel = useTasksViewModel(props)
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader title={messages.title} lead={messages.lead} />
      <SprintBanner viewModel={viewModel} />
      <TaskStats viewModel={viewModel} />
      <TaskFilters viewModel={viewModel} />

      {viewModel.isFree && (
        <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          {messages.freeNote}
          <Link
            to="/app/settings/plan"
            className="font-semibold text-ink underline underline-offset-4"
          >
            {messages.upgrade}
          </Link>
        </p>
      )}

      <TaskList viewModel={viewModel} />

      <DeleteTaskDialog
        task={viewModel.deletingTask}
        date={null}
        sessions={viewModel.deletingTask?.sessions ?? 0}
        minutes={viewModel.deletingTask?.minutes ?? 0}
        onClose={viewModel.closeDelete}
      />
      {viewModel.summarizing && (
        <SummaryDialog
          entry={viewModel.summarizing}
          type={viewModel.typeOf(viewModel.summarizing.taskTypeId)}
          onClose={viewModel.closeSummary}
        />
      )}
    </div>
  )
}

interface SprintBannerProps {
  viewModel: TasksViewModel
}

/** Wybrany sprint: nazwa, daty, dzień sprintu, cel i postęp czasu. */
function SprintBanner({ viewModel }: SprintBannerProps) {
  const messages = useMessages(panelMessages).tasks
  const { locale } = useI18n()
  const { sprint, today } = viewModel
  if (!sprint) return null
  const day = sprintDay(sprint, today)
  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="type-heading text-xl">{sprint.name}</p>
        <p className="text-sm text-ink-soft tabular-nums">
          {formatDateRange(locale, sprint.startsOn, sprint.endsOn)}
          <span aria-hidden> · </span>
          {sprint.endsOn < today
            ? messages.sprintEnded
            : fmt(messages.sprintDay, day)}
        </p>
      </div>
      {sprint.goal && <p className="mt-1 text-[0.9375rem]">{sprint.goal}</p>}
      <ProgressBar value={(day.day / day.total) * 100} className="mt-3 h-1" />
    </div>
  )
}

interface TaskStatsProps {
  viewModel: TasksViewModel
}

/** Liczby nad listą: zadania (zakończone), SP (wobec pojemności), czas, ponad wycenę. */
function TaskStats({ viewModel }: TaskStatsProps) {
  const messages = useMessages(panelMessages).tasks
  const format = useFormat()
  const { totals, sprint } = viewModel
  return (
    <StatGrid className="mb-6">
      <StatTile
        label={messages.tiles.tasks}
        value={String(totals.tasks)}
        hint={fmt(messages.tiles.doneOf, { done: viewModel.doneCount })}
      />
      <StatTile
        label={messages.tiles.sp}
        value={format.number(viewModel.spTotal)}
        hint={
          sprint?.capacityStoryPoints
            ? fmt(messages.tiles.spOf, {
                capacity: format.number(sprint.capacityStoryPoints),
              })
            : undefined
        }
      />
      <StatTile
        label={messages.tiles.time}
        value={format.minutes(totals.minutes)}
        hint={
          totals.minutesPerSp === null
            ? undefined
            : fmt(messages.tiles.perSp, {
                time: format.minutes(totals.minutesPerSp),
              })
        }
      />
      <StatTile
        label={messages.tiles.over}
        value={viewModel.estimatedCount ? String(viewModel.overCount) : '–'}
        hint={
          viewModel.estimatedCount
            ? fmt(messages.tiles.overOf, { total: viewModel.estimatedCount })
            : undefined
        }
      />
    </StatGrid>
  )
}

interface TaskListProps {
  viewModel: TasksViewModel
}

/** Lista w grupach (rodzaj, dzień albo jedna), ładowanie, pusty stan i „Pokaż więcej”. */
function TaskList({ viewModel }: TaskListProps) {
  const messages = useMessages(panelMessages).tasks
  const format = useFormat()
  const { locale } = useI18n()
  if (viewModel.pending)
    return (
      <div
        role="status"
        className="space-y-3 rounded-2xl border border-line bg-surface p-5"
      >
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            aria-hidden
            className="h-14 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    )
  const hasNoVisibleTasks = viewModel.visible.length === 0
  if (hasNoVisibleTasks)
    return (
      <div className="rounded-2xl border border-line bg-surface px-5 py-8 sm:px-6">
        <p className="text-ink-soft">
          {viewModel.filtering ? messages.noMatch : messages.empty}
        </p>
        {viewModel.filtering ? (
          <Button
            variant="outline"
            className="mt-4"
            onClick={viewModel.clearFilters}
          >
            {messages.clear}
          </Button>
        ) : (
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/app">{messages.emptyCta}</Link>
          </Button>
        )}
      </div>
    )
  const groupTitle = (key: string) =>
    viewModel.grouping === 'kind'
      ? (viewModel.typeOf(key)?.name ?? '?')
      : viewModel.grouping === 'day'
        ? formatDate(locale, key, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })
        : messages.title
  return (
    <>
      <p role="status" className="mb-3 text-sm text-ink-soft">
        {format.plural(messages.showing, viewModel.visible.length)}
      </p>
      <div className="space-y-5">
        {viewModel.groups.map((group) => {
          const type =
            viewModel.grouping === 'kind'
              ? viewModel.typeOf(group.key)
              : undefined
          const percent = percentOf(group.minutes, viewModel.totals.minutes)
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
                  {format.plural(messages.group.count, group.items.length)}
                  <span aria-hidden> · </span>
                  {format.minutes(group.minutes)}
                  {viewModel.grouping !== 'none' && (
                    <>
                      <span aria-hidden> · </span>
                      {fmt(messages.group.share, { percent })}
                    </>
                  )}
                </p>
              </header>
              <div
                aria-hidden
                className="hidden grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_8.5rem_8.5rem_8.75rem] gap-x-5 border-b border-line px-6 py-2 text-xs font-medium text-ink-soft lg:grid"
              >
                <span />
                <span>{messages.columns.task}</span>
                <span className="text-right">{messages.columns.sp}</span>
                <span>{messages.columns.time}</span>
                <span>{messages.columns.estimate}</span>
                <span />
              </div>
              <ul className="divide-y divide-line">
                {group.items.map((item) => (
                  <TaskRowView
                    key={item.row.key}
                    item={item}
                    viewModel={viewModel}
                  />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      {viewModel.hasMore && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={viewModel.showMore}>
            {fmt(messages.more, { n: viewModel.moreCount })}
          </Button>
        </div>
      )}
    </>
  )
}
