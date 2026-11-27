import type { WorkKind } from '#/config/work-types'
import type {
  TimeEntry,
  UnfinishedTask,
} from '#/features/time-entries/data/dto'
import { addDays } from './dates'
import { aggregateTasks } from './task-groups'

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
  return aggregateTasks(entries)
    .filter(
      (task) =>
        task.lastDate < today &&
        task.lastDate >= from &&
        !task.running &&
        !task.finished &&
        ![undefined, 'meeting'].includes(kindOf(task.latest.taskTypeId)),
    )
    .slice(0, UNFINISHED_LIMIT)
    .map((task) => ({
      entry: task.latest,
      workedMinutes: task.workedMinutes,
      sessions: task.sessions.length,
      lastDate: task.lastDate,
    }))
}
