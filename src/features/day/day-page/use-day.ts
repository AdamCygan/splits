import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { addDays, todayIn } from '#/domain/dates'
import { daySummary, sessionsOfTask } from '#/domain/day-summary'
import type { DayBlock } from '#/domain/day-summary'
import {
  daysOffQuery,
  projectsQuery,
  settingsQuery,
  taskTypesQuery,
} from '#/features/settings/queries'
import { breaksQuery, rangeEntriesQuery } from '#/features/time-entries/queries'
import { useUpdateNote } from '#/features/time-entries/use-update-note'

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
  const list = (entries.data ?? []).filter((e) => !e.running)
  const summary = daySummary(
    list,
    breaks.filter((b) => !b.running),
    types,
  )
  const typeOf = (id: string | null) => types.find((x) => x.id === id)

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
    projectOf: (id: string | null) => projects.find((p) => p.id === id),
    sessionsOf: (key: string) => sessionsOfTask(list, key),
    saveNote: (id: string, note: string) =>
      updateNote.mutateAsync({ id, note }),
    /** Odcinek pracy na osi otwiera stronę zadania. */
    openBlock: (block: DayBlock | undefined) => {
      const row = summary.tasks.find((r) => r.key === block?.taskKey)
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
