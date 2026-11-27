import { describe, expect, it } from 'vitest'
import type { TaskRow } from '../../src/features/reports/domain/report'
import {
  NO_TASK_FILTERS,
  activeFilterCount,
  filterTaskRows,
  groupTaskList,
  matchesStatus,
  matchesTaskQuery,
  taskPeriodRange,
  taskStatus,
} from '../../src/features/tasks/domain/task-list'

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

  it('Should group by kind of work, most time first, keeping the order inside', () => {
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

  it('Should group by the day of last work, newest first, or not at all', () => {
    expect(groupTaskList(items, 'day').map((g) => g.key)).toEqual([
      '2026-11-25',
      '2026-11-20',
    ])
    expect(groupTaskList(items, 'none')).toEqual([
      { key: 'all', items, minutes: 375 },
    ])
  })

  it('Should know done, running and in-progress tasks for the status filter', () => {
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

describe('task list filters and period', () => {
  const base: TaskRow = {
    key: 'a',
    title: 'Fix login retry',
    link: 'https://jira.example.com/browse/PH-12',
    taskKey: 'PH-12',
    taskTypeId: 't1',
    projectId: null,
    storyPoints: 3,
    minutes: 120,
    overtimeMinutes: 0,
    overtimeNotes: [],
    estimateMinutes: null,
    extensionMinutes: 0,
    extensionNotes: [],
    sessions: 2,
    days: 1,
    first: '2026-11-20',
    last: '2026-11-21',
    running: false,
  }
  const rows = [
    { row: base, estimate: { status: 'over' as const } },
    {
      row: {
        ...base,
        key: 'b',
        title: 'Review PR',
        link: null,
        taskKey: null,
        taskTypeId: 't2',
      },
      estimate: null,
    },
  ]

  it('Should filter by text in title, link or ticket number', () => {
    const f = { ...NO_TASK_FILTERS, query: 'ph-12' }
    expect(filterTaskRows(rows, f, new Set()).map((x) => x.row.key)).toEqual([
      'a',
    ])
    expect(matchesTaskQuery(rows[1]!.row, 'review')).toBe(true)
  })

  it('Should filter by type, estimate and status', () => {
    expect(
      filterTaskRows(rows, { ...NO_TASK_FILTERS, typeId: 't2' }, new Set()),
    ).toHaveLength(1)
    expect(
      filterTaskRows(
        rows,
        { ...NO_TASK_FILTERS, estimate: 'over' },
        new Set(),
      )[0]?.row.key,
    ).toBe('a')
    expect(
      filterTaskRows(
        rows,
        { ...NO_TASK_FILTERS, status: 'done' },
        new Set(['b']),
      )[0]?.row.key,
    ).toBe('b')
  })

  it('Should count filters that differ from the defaults', () => {
    expect(activeFilterCount(NO_TASK_FILTERS, 'd30')).toBe(0)
    expect(
      activeFilterCount(
        { ...NO_TASK_FILTERS, typeId: 'x', status: 'open' },
        'd90',
      ),
    ).toBe(3)
  })

  it('Should build the date range for a period or a sprint', () => {
    const today = '2026-11-27'
    expect(
      taskPeriodRange({
        choice: 'd30',
        sprint: undefined,
        today,
        oldest: null,
        freeDays: null,
      }),
    ).toEqual({ from: '2026-10-29', to: today })
    expect(
      taskPeriodRange({
        choice: 'd90',
        sprint: undefined,
        today,
        oldest: '2026-10-29',
        freeDays: 30,
      }).from,
    ).toBe('2026-10-29')
    const sprint = { startsOn: '2026-10-01', endsOn: '2026-12-10' }
    expect(
      taskPeriodRange({
        choice: 'sprint:s',
        sprint,
        today,
        oldest: '2026-10-29',
        freeDays: 30,
      }),
    ).toEqual({ from: '2026-10-29', to: today })
    expect(
      taskPeriodRange({
        choice: 'sprint:s',
        sprint,
        today,
        oldest: null,
        freeDays: null,
      }).from,
    ).toBe('2026-10-01')
  })
})
