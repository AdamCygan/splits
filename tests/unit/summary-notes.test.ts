import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '../../src/features/time-entries/data/dto'
import { taskStats } from '../../src/features/tasks/domain/summary'
import { summaryValues } from '../../src/features/time-entries/domain/summary'

let count = 0
const makeTimeEntry = (over: Partial<TimeEntry>): TimeEntry => ({
  id: `e${++count}`,
  finishedAt: null,
  taskTypeId: 'task',
  projectId: null,
  title: 'PAY-1 Checkout',
  link: null,
  storyPoints: 3,
  workDate: '2026-11-23',
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
  createdAt: '2026-11-23T08:00:00Z',
  ...over,
})

describe('summary notes', () => {
  it('Should show the day and the hours of the session each note comes from', () => {
    const stats = taskStats([
      makeTimeEntry({
        workDate: '2026-11-24',
        startTime: '13:00',
        endTime: '14:30',
        durationMinutes: 90,
        note: 'Wired the retry\ninto checkout',
      }),
      makeTimeEntry({
        workDate: '2026-11-23',
        durationMinutes: 45,
        note: 'Spike',
      }),
    ])
    const { notes } = summaryValues('en', stats, makeTimeEntry({}), {
      name: 'Task',
    })
    expect(notes.split('\n')).toEqual([
      expect.stringMatching(/^- Mon.*23.*, 45m: Spike$/),
      expect.stringMatching(
        /^- Tue.*24.*, 1:00 PM–2:30 PM: Wired the retry into checkout$/,
      ),
    ])
  })
})
