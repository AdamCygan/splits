import { maxOf } from '#/shared/domain/numbers'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { extractTaskKey } from '#/features/task-types/domain/rules'

/** Pola dostępne w szablonie podsumowania zadania. Kolejność = kolejność przycisków w edytorze. */
export const SUMMARY_PLACEHOLDERS = [
  'task',
  'total',
  'sessions',
  'days',
  'sp',
  'type',
  'key',
  'link',
  'first',
  'last',
  'notes',
  'breakdown',
  'intervals',
  'overtime',
] as const
export type SummaryPlaceholder = (typeof SUMMARY_PLACEHOLDERS)[number]
export type SummaryValues = Record<SummaryPlaceholder, string>

export const SUMMARY_TEMPLATE_MAX = 2000

/** Wpisy należące do tego samego zadania: ten sam link, a bez linku ten sam tytuł i typ. */
export function sameTask(
  entry: Pick<TimeEntry, 'link' | 'title' | 'taskTypeId'>,
  otherEntry: Pick<TimeEntry, 'link' | 'title' | 'taskTypeId'>,
) {
  if (entry.link && otherEntry.link)
    return entry.link.trim() === otherEntry.link.trim()
  if (entry.link || otherEntry.link) return false
  return (
    entry.taskTypeId === otherEntry.taskTypeId &&
    entry.title.trim().toLocaleLowerCase() ===
      otherEntry.title.trim().toLocaleLowerCase()
  )
}

export interface TaskStats {
  totalMinutes: number
  sessions: number
  days: Array<{ date: string; minutes: number }>
  /** Odcinki czasu w kolejności: start i koniec ('HH:MM') albo null dla wpisów „sam czas”. */
  intervals: Array<{
    date: string
    start: string | null
    end: string | null
    minutes: number
  }>
  /** Największa wartość SP z wpisów (SP opisuje zadanie, nie sesję); null = zadanie bez SP. */
  storyPoints: number | null
  /** Notatki z sesji, od najstarszej, z godzinami sesji (null dla wpisów „sam czas”). */
  notes: Array<{
    date: string
    start: string | null
    end: string | null
    minutes: number
    note: string
  }>
  /** Nadgodziny zadania: łączny czas i opisy z wpisów, od najstarszego. */
  overtimeMinutes: number
  overtimeNotes: Array<{ date: string; minutes: number; note: string }>
  first: string
  last: string
}

/** SP zadania: największa wartość z jego wpisów, null gdy żaden wpis nie ma SP. */
export function maxPoints(
  entries: ReadonlyArray<Pick<TimeEntry, 'storyPoints'>>,
): number | null {
  return maxOf(entries.map((part) => part.storyPoints))
}

/** Estymata zadania: największa podana w jego sesjach (null = żadna). */
export function maxEstimate(
  entries: ReadonlyArray<Pick<TimeEntry, 'estimateMinutes'>>,
): number | null {
  return maxOf(entries.map((part) => part.estimateMinutes))
}

export function taskStats(entries: ReadonlyArray<TimeEntry>): TaskStats {
  const sorted = [...entries].sort((left, right) =>
    (left.workDate + (left.startTime ?? '')).localeCompare(
      right.workDate + (right.startTime ?? ''),
    ),
  )
  const byDay = new Map<string, number>()
  for (const timeEntry of sorted)
    byDay.set(
      timeEntry.workDate,
      (byDay.get(timeEntry.workDate) ?? 0) + timeEntry.durationMinutes,
    )
  return {
    totalMinutes: sorted.reduce(
      (sum, timeEntry) => sum + timeEntry.durationMinutes,
      0,
    ),
    sessions: sorted.length,
    days: [...byDay].map(([date, minutes]) => ({ date, minutes })),
    intervals: sorted.map((timeEntry) => ({
      date: timeEntry.workDate,
      start: timeEntry.startTime,
      end: timeEntry.endTime,
      minutes: timeEntry.durationMinutes,
    })),
    storyPoints: maxPoints(sorted),
    notes: sorted
      .filter((timeEntry) => timeEntry.note?.trim())
      .map((timeEntry) => ({
        date: timeEntry.workDate,
        start: timeEntry.startTime,
        end: timeEntry.endTime,
        minutes: timeEntry.durationMinutes,
        note: timeEntry.note!.trim(),
      })),
    overtimeMinutes: sorted.reduce(
      (sum, timeEntry) => sum + (timeEntry.overtimeMinutes ?? 0),
      0,
    ),
    overtimeNotes: sorted
      .filter((timeEntry) => timeEntry.overtimeMinutes !== null)
      .map((timeEntry) => ({
        date: timeEntry.workDate,
        minutes: timeEntry.overtimeMinutes!,
        note: timeEntry.overtimeNote?.trim() ?? '',
      })),
    first: sorted[0]?.workDate ?? '',
    last: sorted.at(-1)?.workDate ?? '',
  }
}

/** Wypełnia {pola}; nieznane pola zostają bez zmian, żeby literówka była widoczna w podglądzie. */
export function renderSummary(template: string, values: SummaryValues): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    (SUMMARY_PLACEHOLDERS as ReadonlyArray<string>).includes(name)
      ? values[name as SummaryPlaceholder]
      : match,
  )
}

/** Pola z szablonu, których nie znamy (do ostrzeżenia w edytorze). */
export function unknownPlaceholders(template: string): Array<string> {
  const names = [...template.matchAll(/\{(\w+)\}/g)].map(
    (regExpExecArray) => regExpExecArray[1]!,
  )
  return [
    ...new Set(
      names.filter(
        (line) =>
          !(SUMMARY_PLACEHOLDERS as ReadonlyArray<string>).includes(line),
      ),
    ),
  ]
}

export const taskKeyOf = (entry: Pick<TimeEntry, 'link'>) =>
  entry.link ? extractTaskKey(entry.link) : null
