import type { WorkKind } from '#/config/work-types'
import type { TimeEntry, UnfinishedTask } from '#/data/types'
import { addDays } from './dates'
import { taskGroupKey } from './report'

/** Ile dni wstecz szukamy zadań do dokończenia. */
export const UNFINISHED_LOOKBACK_DAYS = 14
/** Najwięcej pozycji na liście „Do dokończenia”. */
export const UNFINISHED_LIMIT = 6

/**
 * Zadania z poprzednich dni, które nie są zakończone: ostatnia praca w ciągu
 * `UNFINISHED_LOOKBACK_DAYS` dni przed `today`, bez pracy dziś (dzisiejsze są już na liście dnia),
 * bez znacznika „zakończone” i nie z typów spotkań (spotkanie się nie „kontynuuje”).
 * Najświeższe najpierw.
 */
export function unfinishedTasks(
  entries: ReadonlyArray<TimeEntry>,
  today: string,
  kindOf: (taskTypeId: string) => WorkKind | undefined,
): Array<UnfinishedTask> {
  const from = addDays(today, -UNFINISHED_LOOKBACK_DAYS)
  const groups = new Map<string, Array<TimeEntry>>()
  for (const e of entries) {
    const key = taskGroupKey(e)
    const list = groups.get(key)
    if (list) list.push(e)
    else groups.set(key, [e])
  }
  const result: Array<UnfinishedTask> = []
  for (const list of groups.values()) {
    const latest = list.reduce((a, b) => (newer(b, a) ? b : a))
    if (latest.workDate >= today || latest.workDate < from) continue
    if (list.some((e) => e.running || e.finishedAt !== null)) continue
    const kind = kindOf(latest.taskTypeId)
    if (!kind || kind === 'meeting') continue
    result.push({
      entry: latest,
      workedMinutes: list.reduce((sum, e) => sum + e.durationMinutes, 0),
      sessions: list.length,
      lastDate: latest.workDate,
    })
  }
  return result
    .sort((a, b) => (newer(a.entry, b.entry) ? -1 : 1))
    .slice(0, UNFINISHED_LIMIT)
}

/** Później tego dnia: najpierw dzień, potem godzina startu, potem kolejność dodania. */
const newer = (a: TimeEntry, b: TimeEntry) =>
  a.workDate !== b.workDate
    ? a.workDate > b.workDate
    : (a.startTime ?? '') !== (b.startTime ?? '')
      ? (a.startTime ?? '') > (b.startTime ?? '')
      : a.createdAt > b.createdAt
