import type { TaskRow } from './report'

export type TaskGrouping = 'kind' | 'day' | 'none'
export type TaskStatus = 'open' | 'running' | 'done'
export type TaskStatusFilter = 'all' | 'open' | 'done'

/** Stan zadania na liście: trwa (timer), zakończone (oznaczone) albo w toku. */
export const taskStatus = (
  row: Pick<TaskRow, 'key' | 'running'>,
  finished: ReadonlySet<string>,
): TaskStatus =>
  row.running ? 'running' : finished.has(row.key) ? 'done' : 'open'

export const matchesStatus = (status: TaskStatus, filter: TaskStatusFilter) =>
  filter === 'all' ||
  (filter === 'done' ? status === 'done' : status !== 'done')

export type TaskGroup<T> = {
  /** id rodzaju pracy, data (YYYY-MM-DD) albo 'all'. */
  key: string
  items: Array<T>
  minutes: number
}

/**
 * Grupy listy zadań: według rodzaju pracy (najwięcej czasu najpierw), według dnia
 * ostatniej pracy (najnowszy najpierw) albo jedna grupa. Kolejność w grupie zostaje.
 */
export function groupTaskList<T extends { row: TaskRow }>(
  items: ReadonlyArray<T>,
  by: TaskGrouping,
): Array<TaskGroup<T>> {
  if (by === 'none')
    return [
      {
        key: 'all',
        items: [...items],
        minutes: items.reduce((s, x) => s + x.row.minutes, 0),
      },
    ]
  const groups = new Map<string, TaskGroup<T>>()
  for (const item of items) {
    const key = by === 'kind' ? item.row.taskTypeId : item.row.last
    const group = groups.get(key) ?? { key, items: [], minutes: 0 }
    group.items.push(item)
    group.minutes += item.row.minutes
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) =>
    by === 'kind'
      ? b.minutes - a.minutes || a.key.localeCompare(b.key)
      : b.key.localeCompare(a.key),
  )
}
