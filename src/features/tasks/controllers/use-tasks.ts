import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { todayIn } from '#/shared/domain/dates'
import {
  groupTasks,
  sortRows,
  totalsOf,
} from '#/features/reports/domain/report'
import type { TaskRow, TaskSort } from '#/features/reports/domain/report'
import { estimateOf } from '#/features/sprints/domain/sprint-stats'
import { startedSprints } from '#/features/sprints/domain/sprints'
import { aggregateTasks } from '#/features/tasks/domain/task-groups'
import {
  NO_TASK_FILTERS,
  activeFilterCount,
  filterTaskRows,
  groupTaskList,
  taskPeriodRange,
  taskStatus,
} from '#/features/tasks/domain/task-list'
import type {
  TaskFilters,
  TaskGrouping,
  TaskPeriodChoice,
} from '#/features/tasks/domain/task-list'
import { historyStart } from '#/features/settings/domain/workday'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'
import { meQuery } from '#/features/account/data/queries'
import { scaleQuery } from '#/features/story-points/data/queries'
import { settingsQuery } from '#/features/settings/data/queries'
import { sprintsQuery } from '#/features/sprints/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { useResumeTask } from '#/features/time-entries/views/timer'
import { rangeEntriesQuery } from '#/features/time-entries/data/queries'

/** Ile zadań pokazujemy naraz (dalej „Pokaż więcej”). */
export const PAGE = 30

export interface TasksProps {
  /** Sprint z adresu (?sprint=): od razu pokazuje jego zadania. */
  sprint?: string
  onSprintChange?: (sprintId: string | undefined) => void
}

/**
 * ViewModel strony Zadania: okres albo sprint, filtry, sortowanie i grupowanie,
 * zadania z wycenami i liczby nad listą. Reguły (zakres dat, filtry, stan zadania)
 * są w domain/task-list i domain/task-groups.
 */
export function useTasksViewModel({
  sprint: initialSprint,
  onSprintChange,
}: TasksProps) {
  const settings = useQuery(settingsQuery).data
  const user = useQuery(meQuery).data
  const types = useQuery(taskTypesQuery).data ?? []
  const scale = useQuery(scaleQuery).data ?? []
  const allSprints = useQuery(sprintsQuery).data ?? []
  const today = todayIn(settings?.timezone)
  const isFree = !hasProAccess(user)
  const oldest = historyStart(today, isFree ? FREE_LIMITS.historyDays : null)

  const [choice, setChoice] = useState<TaskPeriodChoice>(
    initialSprint ? `sprint:${initialSprint}` : 'd30',
  )
  const [search, setSearch] = useState('')
  const [filters, setFilters] =
    useState<Omit<TaskFilters, 'query'>>(NO_TASK_FILTERS)
  const [grouping, setGrouping] = useState<TaskGrouping>('kind')
  const [sort, setSort] = useState<TaskSort>('last')
  const [limit, setLimit] = useState(PAGE)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [summarizing, setSummarizing] = useState<TimeEntry | null>(null)
  const [deletingTask, setDeletingTask] = useState<TaskRow | null>(null)
  const query = useDeferredValue(search).trim().toLocaleLowerCase()
  const resume = useResumeTask()

  // Sprinty, które już się zaczęły (najnowsze pierwsze); w Free tylko te z ostatnich 30 dni.
  const sprintOptions = startedSprints(allSprints, today, oldest).slice(0, 26)
  const sprint = choice.startsWith('sprint:')
    ? allSprints.find((s) => `sprint:${s.id}` === choice)
    : undefined
  const { from, to } = taskPeriodRange({
    choice,
    sprint,
    today,
    oldest,
    freeDays: isFree ? FREE_LIMITS.historyDays : null,
  })
  const entries = useQuery(rangeEntriesQuery(from, to))

  const { rows, latest, finished } = useMemo(() => {
    const list = entries.data ?? []
    // Ostatnia sesja zadania: z niej startuje „Kontynuuj” i podsumowanie.
    const tasks = aggregateTasks(list)
    return {
      rows: sortRows(
        groupTasks(list, types),
        sort,
        sort === 'title' ? 'asc' : 'desc',
      ).map((row) => ({ row, estimate: estimateOf(row, scale) })),
      latest: new Map(tasks.map((x) => [x.key, x.latest])),
      finished: new Set(tasks.filter((x) => x.finished).map((x) => x.key)),
    }
  }, [entries.data, types, scale, sort])

  const allFilters: TaskFilters = { ...filters, query }
  const filtered = filterTaskRows(rows, allFilters, finished)
  const visible = filtered.slice(0, limit)
  const estimated = filtered.filter((x) => x.estimate !== null)
  const typeOf = (id: string) => types.find((x) => x.id === id)

  // Zmiana filtrów wraca do pierwszej strony wyników.
  const setFilter = <TKey extends keyof typeof filters>(
    key: TKey,
    value: (typeof filters)[TKey],
  ) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setLimit(PAGE)
  }

  return {
    today,
    isFree,
    sprint,
    sprintOptions,
    choice: isFree && !sprint ? 'd30' : choice,
    search,
    filters,
    grouping,
    sort,
    filtersOpen,
    activeFilters: activeFilterCount(allFilters, choice),
    filtering: Boolean(
      query ||
      filters.typeId ||
      filters.estimate !== 'all' ||
      filters.status !== 'all',
    ),
    pending: entries.isPending,
    usedTypes: types.filter((x) => rows.some((r) => r.row.taskTypeId === x.id)),
    filtered,
    visible,
    groups: groupTaskList(visible, grouping),
    longest: Math.max(1, ...visible.map((x) => x.row.minutes)),
    totals: totalsOf(filtered.map((x) => x.row)),
    spTotal: filtered.reduce((sum, x) => sum + (x.row.storyPoints ?? 0), 0),
    doneCount: filtered.filter((x) => taskStatus(x.row, finished) === 'done')
      .length,
    estimatedCount: estimated.length,
    overCount: estimated.filter((x) => x.estimate?.status === 'over').length,
    hasMore: filtered.length > limit,
    moreCount: Math.min(PAGE, filtered.length - limit),
    resumeBusy: resume.isPending,
    summarizing,
    deletingTask,
    typeOf,
    latestOf: (row: TaskRow) => latest.get(row.key),
    statusOf: (row: TaskRow) => taskStatus(row, finished),
    // akcje
    setSearch: (value: string) => {
      setSearch(value)
      setLimit(PAGE)
    },
    setFilter,
    setChoice: (next: TaskPeriodChoice) => {
      setChoice(next)
      setLimit(PAGE)
      onSprintChange?.(next.startsWith('sprint:') ? next.slice(7) : undefined)
    },
    setGrouping,
    setSort,
    toggleFilters: () => setFiltersOpen((v) => !v),
    clearFilters: () => {
      setSearch('')
      setFilters(NO_TASK_FILTERS)
    },
    showMore: () => setLimit((n) => n + PAGE),
    resume: (entry: TimeEntry) => resume.mutate(entry.id),
    summarize: setSummarizing,
    closeSummary: () => setSummarizing(null),
    askDelete: setDeletingTask,
    closeDelete: () => setDeletingTask(null),
  }
}

export type TasksViewModel = ReturnType<typeof useTasksViewModel>
export type TaskListItem = TasksViewModel['visible'][number]
