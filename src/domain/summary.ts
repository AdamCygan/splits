import type { TimeEntry } from '#/data/types'
import { extractTaskKey } from './rules'

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
  a: Pick<TimeEntry, 'link' | 'title' | 'taskTypeId'>,
  b: Pick<TimeEntry, 'link' | 'title' | 'taskTypeId'>,
) {
  if (a.link && b.link) return a.link.trim() === b.link.trim()
  if (a.link || b.link) return false
  return (
    a.taskTypeId === b.taskTypeId &&
    a.title.trim().toLocaleLowerCase() === b.title.trim().toLocaleLowerCase()
  )
}

export type TaskStats = {
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
  notes: Array<{ date: string; note: string }>
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
  const points = entries
    .map((e) => e.storyPoints)
    .filter((p): p is number => p !== null)
  return points.length ? Math.max(...points) : null
}

export function taskStats(entries: ReadonlyArray<TimeEntry>): TaskStats {
  const sorted = [...entries].sort((a, b) =>
    (a.workDate + (a.startTime ?? '')).localeCompare(
      b.workDate + (b.startTime ?? ''),
    ),
  )
  const byDay = new Map<string, number>()
  for (const e of sorted)
    byDay.set(e.workDate, (byDay.get(e.workDate) ?? 0) + e.durationMinutes)
  return {
    totalMinutes: sorted.reduce((sum, e) => sum + e.durationMinutes, 0),
    sessions: sorted.length,
    days: [...byDay].map(([date, minutes]) => ({ date, minutes })),
    intervals: sorted.map((e) => ({
      date: e.workDate,
      start: e.startTime,
      end: e.endTime,
      minutes: e.durationMinutes,
    })),
    storyPoints: maxPoints(sorted),
    notes: sorted
      .filter((e) => e.note?.trim())
      .map((e) => ({ date: e.workDate, note: e.note!.trim() })),
    overtimeMinutes: sorted.reduce(
      (sum, e) => sum + (e.overtimeMinutes ?? 0),
      0,
    ),
    overtimeNotes: sorted
      .filter((e) => e.overtimeMinutes !== null)
      .map((e) => ({
        date: e.workDate,
        minutes: e.overtimeMinutes!,
        note: e.overtimeNote?.trim() ?? '',
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
  const names = [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!)
  return [
    ...new Set(
      names.filter(
        (n) => !(SUMMARY_PLACEHOLDERS as ReadonlyArray<string>).includes(n),
      ),
    ),
  ]
}

export const taskKeyOf = (entry: Pick<TimeEntry, 'link'>) =>
  entry.link ? extractTaskKey(entry.link) : null
