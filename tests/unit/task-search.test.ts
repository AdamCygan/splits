import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '../../src/features/time-entries/data/dto'
import {
  groupSearchResults,
  likePattern,
} from '../../src/features/tasks/domain/task-search'

let n = 0
const e = (over: Partial<TimeEntry>): TimeEntry => ({
  id: `e${++n}`,
  finishedAt: null,
  taskTypeId: 'task',
  projectId: null,
  title: 'PAY-139 Refund API',
  link: null,
  storyPoints: 3,
  workDate: '2026-11-10',
  startTime: null,
  endTime: null,
  durationMinutes: 60,
  note: null,
  overtimeMinutes: null,
  overtimeNote: null,
  estimateMinutes: null,
  extensionMinutes: null,
  extensionNote: null,
  running: false,
  paused: false,
  startedAt: null,
  createdAt: `2026-11-10T08:00:${String(n).padStart(2, '0')}Z`,
  ...over,
})

describe('task search', () => {
  it('Should group sessions into tasks, newest first, with totals and state', () => {
    const results = groupSearchResults([
      e({ workDate: '2026-11-10', finishedAt: '2026-11-11T10:00:00Z' }),
      e({ workDate: '2026-11-11', durationMinutes: 30 }),
      e({ title: 'PAY-140 Refund UI', workDate: '2026-11-20', running: true }),
    ])
    expect(
      results.map((r) => [
        r.entry.title,
        r.workedMinutes,
        r.sessions,
        r.lastDate,
        r.finished,
        r.running,
      ]),
    ).toEqual([
      ['PAY-140 Refund UI', 60, 1, '2026-11-20', false, true],
      ['PAY-139 Refund API', 90, 2, '2026-11-11', true, false],
    ])
  })

  it('Should treat % and _ in the query as plain characters', () => {
    expect(likePattern(' 50%_off ')).toBe('%50\\%\\_off%')
  })
})
