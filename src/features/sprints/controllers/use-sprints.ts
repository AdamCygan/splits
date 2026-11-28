import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DAY_OFF_KINDS } from '#/features/days-off/data/dto'
import type { Sprint } from '#/features/sprints/data/dto'
import { todayIn } from '#/shared/domain/dates'
import { sprintAvailability } from '#/features/days-off/domain/days-off'
import {
  averageMinutesPerSp,
  sprintDay,
  sprintStats,
  timeGoalProgress,
} from '#/features/sprints/domain/sprint-stats'
import { sprintOverview } from '#/features/sprints/domain/sprints'
import { historyStart } from '#/features/settings/domain/workday'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'
import { daysOffQuery } from '#/features/days-off/data/queries'
import { meQuery } from '#/features/account/data/queries'
import { settingsQuery } from '#/features/settings/data/queries'
import { sprintsQuery } from '#/features/sprints/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { rangeEntriesQuery } from '#/features/time-entries/data/queries'
import { useMessages } from '#/i18n/context'
import { daysOffMessages } from '#/i18n/messages/days-off'

/** Ile zakończonych sprintów porównujemy (plus bieżący). */
export const HISTORY = 6

/**
 * ViewModel strony Sprinty: bieżący sprint z liczbami, dostępnością i celami czasu,
 * historia zakończonych sprintów, trend i średni czas na SP.
 */
export function useSprintsViewModel() {
  const off = useMessages(daysOffMessages)
  const settings = useQuery(settingsQuery).data
  const user = useQuery(meQuery).data
  const sprints = useQuery(sprintsQuery)
  const types = useQuery(taskTypesQuery).data ?? []
  const today = todayIn(settings?.timezone)

  const overview = useMemo(
    () => sprintOverview(sprints.data ?? [], today, HISTORY),
    [sprints.data, today],
  )
  const { current, upcoming, shown, from } = overview
  const entries = useQuery({
    ...rangeEntriesQuery(from, today),
    enabled: shown.length > 0,
  })
  const stats = useMemo(
    () =>
      shown.map((dateSpan) => sprintStats(dateSpan, entries.data ?? [], types)),
    [shown, entries.data, types],
  )
  const currentStats = current ? stats[0] : undefined
  const pastStats = current ? stats.slice(1) : stats
  // Średnia z zakończonych sprintów; gdy żadnego nie ma, z bieżącego.
  const basis = pastStats.length ? pastStats : stats
  const daysOff =
    useQuery({
      ...daysOffQuery(from, overview.lastDay),
      enabled: shown.length > 0,
    }).data ?? []
  const oldest = historyStart(
    today,
    hasProAccess(user) ? null : FREE_LIMITS.historyDays,
  )

  const availability = (sprint: Pick<Sprint, 'startsOn' | 'endsOn'>) =>
    sprintAvailability(
      sprint,
      settings?.workingDays ?? [1, 2, 3, 4, 5],
      daysOff,
    )
  const day = current ? sprintDay(current, today) : undefined

  return {
    today,
    current,
    upcoming,
    day,
    currentStats,
    pastStats,
    stats,
    types,
    sprintsPending: sprints.isPending,
    entriesPending: entries.isPending,
    clamped: oldest !== null && from < oldest,
    average: averageMinutesPerSp(basis),
    averaged: basis.filter((sprint) => sprint.minutesPerSp !== null).length,
    goals:
      current && currentStats && day && current.timeGoals.length > 0
        ? timeGoalProgress(
            current.timeGoals,
            currentStats.types,
            day.day,
            day.total,
          )
        : [],
    typeOf: (id: string) => types.find((type) => type.id === id),
    availability,
    /** Dni wolne sprintu wg rodzaju, np. „Urlop 2, Święto 1”. */
    offSummary: (byKind: ReturnType<typeof availability>['byKind']) =>
      DAY_OFF_KINDS.filter((dayOffKind) => byKind[dayOffKind])
        .map((dayOffKind) => `${off.kinds[dayOffKind]} ${byKind[dayOffKind]}`)
        .join(', '),
  }
}

export type SprintsViewModel = ReturnType<typeof useSprintsViewModel>
