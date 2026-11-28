import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '../../src/features/time-entries/data/dto'
import {
  UNFINISHED_LIMIT,
  unfinishedTasks,
} from '../../src/features/time-entries/domain/unfinished'

const today = '2026-11-18'
let count = 0
const makeTimeEntry = (over: Partial<TimeEntry>): TimeEntry => ({
  id: `e${++count}`,
  finishedAt: null,
  taskTypeId: 'task',
  projectId: null,
  title: 'PAY-142 Gateway',
  link: null,
  storyPoints: 5,
  workDate: '2026-11-17',
  startTime: null,
  endTime: null,
  durationMinutes: 30,
  note: null,
  overtimeMinutes: null,
  overtimeNote: null,
  estimateMinutes: null,
  extensionMinutes: null,
  extensionNote: null,
  running: false,
  paused: false,
  startedAt: null,
  createdAt: `2026-11-17T08:00:${String(count).padStart(2, '0')}Z`,
  ...over,
})
const kinds = { task: 'task', meet: 'meeting' } as const
const kindOf = (id: string) => kinds[id as keyof typeof kinds]

describe('unfinished tasks', () => {
  it('Should list tasks from previous days with their total time, newest first', () => {
    const older = makeTimeEntry({ title: 'Older', workDate: '2026-11-12' })
    const timeEntry = makeTimeEntry({
      workDate: '2026-11-13',
      durationMinutes: 60,
    })
    const secondEntry = makeTimeEntry({
      workDate: '2026-11-17',
      startTime: '14:00',
      durationMinutes: 45,
    })
    const thirdEntry = makeTimeEntry({
      workDate: '2026-11-17',
      startTime: '09:00',
      durationMinutes: 15,
    })
    const list = unfinishedTasks(
      [older, timeEntry, secondEntry, thirdEntry],
      today,
      kindOf,
    )
    expect(list.map((unfinishedTask) => unfinishedTask.entry.title)).toEqual([
      'PAY-142 Gateway',
      'Older',
    ])
    expect(list[0]).toMatchObject({
      entry: { id: secondEntry.id },
      workedMinutes: 120,
      sessions: 3,
      lastDate: '2026-11-17',
    })
  })

  it('Should skip finished tasks, tasks worked on today, running ones and meetings', () => {
    const list = unfinishedTasks(
      [
        makeTimeEntry({ title: 'Done', finishedAt: '2026-11-17T16:00:00Z' }),
        makeTimeEntry({ title: 'Also today' }),
        makeTimeEntry({ title: 'Also today', workDate: today }),
        makeTimeEntry({ title: 'Running', running: true }),
        makeTimeEntry({ title: 'Daily', taskTypeId: 'meet' }),
        makeTimeEntry({ title: 'Unknown type', taskTypeId: 'gone' }),
        makeTimeEntry({ title: 'Too old', workDate: '2026-11-01' }),
        makeTimeEntry({ title: 'Keep' }),
      ],
      today,
      kindOf,
    )
    expect(list.map((unfinishedTask) => unfinishedTask.entry.title)).toEqual([
      'Keep',
    ])
  })

  it('Should group by link first, like the rest of the app', () => {
    const link = 'https://acme.atlassian.net/browse/PAY-9'
    const list = unfinishedTasks(
      [
        makeTimeEntry({
          title: 'PAY-9 Old name',
          link,
          workDate: '2026-11-16',
        }),
        makeTimeEntry({ title: 'PAY-9 New name', link }),
      ],
      today,
      kindOf,
    )
    expect(list).toHaveLength(1)
    expect(list[0]!.entry.title).toBe('PAY-9 New name')
  })

  it('Should keep the list short', () => {
    const many = Array.from({ length: 10 }, (_unused, index) =>
      makeTimeEntry({ title: `T${index}` }),
    )
    expect(unfinishedTasks(many, today, kindOf)).toHaveLength(UNFINISHED_LIMIT)
  })
})
