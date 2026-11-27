import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '../../src/features/time-entries/data/dto'
import { UNFINISHED_LIMIT, unfinishedTasks } from '#/domain/unfinished'

const today = '2026-11-18'
let n = 0
const e = (over: Partial<TimeEntry>): TimeEntry => ({
  id: `e${++n}`,
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
  createdAt: `2026-11-17T08:00:${String(n).padStart(2, '0')}Z`,
  ...over,
})
const kinds = { task: 'task', meet: 'meeting' } as const
const kindOf = (id: string) => kinds[id as keyof typeof kinds]

describe('unfinished tasks', () => {
  it('Should list tasks from previous days with their total time, newest first', () => {
    const older = e({ title: 'Older', workDate: '2026-11-12' })
    const a1 = e({ workDate: '2026-11-13', durationMinutes: 60 })
    const a2 = e({
      workDate: '2026-11-17',
      startTime: '14:00',
      durationMinutes: 45,
    })
    const a3 = e({
      workDate: '2026-11-17',
      startTime: '09:00',
      durationMinutes: 15,
    })
    const list = unfinishedTasks([older, a1, a2, a3], today, kindOf)
    expect(list.map((u) => u.entry.title)).toEqual(['PAY-142 Gateway', 'Older'])
    expect(list[0]).toMatchObject({
      entry: { id: a2.id },
      workedMinutes: 120,
      sessions: 3,
      lastDate: '2026-11-17',
    })
  })

  it('Should skip finished tasks, tasks worked on today, running ones and meetings', () => {
    const list = unfinishedTasks(
      [
        e({ title: 'Done', finishedAt: '2026-11-17T16:00:00Z' }),
        e({ title: 'Also today' }),
        e({ title: 'Also today', workDate: today }),
        e({ title: 'Running', running: true }),
        e({ title: 'Daily', taskTypeId: 'meet' }),
        e({ title: 'Unknown type', taskTypeId: 'gone' }),
        e({ title: 'Too old', workDate: '2026-11-01' }),
        e({ title: 'Keep' }),
      ],
      today,
      kindOf,
    )
    expect(list.map((u) => u.entry.title)).toEqual(['Keep'])
  })

  it('Should group by link first, like the rest of the app', () => {
    const link = 'https://acme.atlassian.net/browse/PAY-9'
    const list = unfinishedTasks(
      [
        e({ title: 'PAY-9 Old name', link, workDate: '2026-11-16' }),
        e({ title: 'PAY-9 New name', link }),
      ],
      today,
      kindOf,
    )
    expect(list).toHaveLength(1)
    expect(list[0]!.entry.title).toBe('PAY-9 New name')
  })

  it('Should keep the list short', () => {
    const many = Array.from({ length: 10 }, (_, i) => e({ title: `T${i}` }))
    expect(unfinishedTasks(many, today, kindOf)).toHaveLength(UNFINISHED_LIMIT)
  })
})
