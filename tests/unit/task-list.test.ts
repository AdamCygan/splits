import { describe, expect, it } from 'vitest'
import type { TaskRow } from '#/domain/report'
import { groupTaskList, matchesStatus, taskStatus } from '#/domain/task-list'

const row = (over: Partial<TaskRow>): { row: TaskRow } => ({
  row: {
    key: over.title ?? 'x',
    title: 'x',
    link: null,
    taskKey: null,
    taskTypeId: 'task',
    projectId: null,
    storyPoints: null,
    minutes: 60,
    overtimeMinutes: 0,
    overtimeNotes: [],
    estimateMinutes: null,
    extensionMinutes: 0,
    extensionNotes: [],
    sessions: 1,
    days: 1,
    first: '2026-11-20',
    last: '2026-11-20',
    running: false,
    ...over,
  },
})

describe('task list', () => {
  const items = [
    row({ title: 'A', taskTypeId: 'review', minutes: 30, last: '2026-11-25' }),
    row({ title: 'B', taskTypeId: 'task', minutes: 300, last: '2026-11-20' }),
    row({ title: 'C', taskTypeId: 'review', minutes: 45, last: '2026-11-20' }),
  ]

  it('groups by kind of work, most time first, keeping the order inside', () => {
    expect(
      groupTaskList(items, 'kind').map((g) => [
        g.key,
        g.minutes,
        g.items.map((x) => x.row.title),
      ]),
    ).toEqual([
      ['task', 300, ['B']],
      ['review', 75, ['A', 'C']],
    ])
  })

  it('groups by the day of last work, newest first, or not at all', () => {
    expect(groupTaskList(items, 'day').map((g) => g.key)).toEqual([
      '2026-11-25',
      '2026-11-20',
    ])
    expect(groupTaskList(items, 'none')).toEqual([
      { key: 'all', items, minutes: 375 },
    ])
  })

  it('knows done, running and in-progress tasks for the status filter', () => {
    const finished = new Set(['A'])
    expect(taskStatus(items[0]!.row, finished)).toBe('done')
    expect(taskStatus({ key: 'A', running: true }, finished)).toBe('running')
    expect(taskStatus(items[1]!.row, finished)).toBe('open')
    expect(matchesStatus('running', 'open')).toBe(true)
    expect(matchesStatus('done', 'open')).toBe(false)
    expect(matchesStatus('done', 'done')).toBe(true)
    expect(matchesStatus('open', 'all')).toBe(true)
  })
})
