import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { addDays, todayIn } from '#/shared/domain/dates'
import { daySummary, sessionsOfTask } from '#/features/day/domain/day-summary'
import type { DayBlock } from '#/features/day/domain/day-summary'
import { daysOffQuery } from '#/features/days-off/data/queries'
import { projectsQuery } from '#/features/projects/data/queries'
import { settingsQuery } from '#/features/settings/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { breaksQuery } from '#/features/breaks/data/queries'
import { rangeEntriesQuery } from '#/features/time-entries/data/queries'
import { useUpdateNote } from '#/features/time-entries/controllers/use-update-note'

/**
 * ViewModel podsumowania dnia: wpisy i przerwy (bez działających), dzień wolny,
 * sumy z domain/day-summary, nawigacja dzień w przód/tył i otwieranie zadań.
 */
export function useDayViewModel(date: string) {
  const navigate = useNavigate()
  const settings = useQuery(settingsQuery).data
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = useQuery(projectsQuery).data ?? []
  const entries = useQuery(rangeEntriesQuery(date, date))
  const breaks = useQuery(breaksQuery(date)).data ?? []
  const dayOff = useQuery(daysOffQuery(date, date)).data?.[0]
  const updateNote = useUpdateNote()
  const today = todayIn(settings?.timezone)
  const list = (entries.data ?? []).filter((entry) => !entry.running)
  const summary = daySummary(
    list,
    breaks.filter((workBreak) => !workBreak.running),
    types,
  )
  const typeOf = (id: string | null) => types.find((type) => type.id === id)

  return {
    date,
    previous: addDays(date, -1),
    /** Następny dzień tylko do dziś (przyszłość jest pusta). */
    next: date < today ? addDays(date, 1) : null,
    dayOff,
    summary,
    target: settings?.workdayTargetMinutes ?? 0,
    pending: entries.isPending,
    empty: list.length === 0,
    types,
    typeOf,
    /** Kolor rodzaju pracy (z zapasowym, gdy rodzaj zniknął). */
    colorOf: (id: string | null) => typeOf(id)?.color ?? 'var(--wt-custom)',
    projectOf: (id: string | null) =>
      projects.find((project) => project.id === id),
    sessionsOf: (key: string) => sessionsOfTask(list, key),
    saveNote: (id: string, note: string) =>
      updateNote.mutateAsync({ id, note }),
    /** Odcinek pracy na osi otwiera stronę zadania. */
    openBlock: (block: DayBlock | undefined) => {
      const row = summary.tasks.find(
        (taskRow) => taskRow.key === block?.taskKey,
      )
      if (!block || block.kind !== 'work' || !row) return
      void navigate({
        to: '/app/task',
        search: {
          type: row.taskTypeId,
          title: row.title,
          ...(row.link ? { link: row.link } : {}),
        },
      })
    },
  }
}

export type DayViewModel = ReturnType<typeof useDayViewModel>
