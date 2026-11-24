import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '#/data/types'
import { taskStats } from '#/domain/summary'
import { summaryValues } from '#/features/time-entries/summary'

let n = 0
const e = (over: Partial<TimeEntry>): TimeEntry => ({
  id: `e${++n}`,
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
  it('shows the day and the hours of the session each note comes from', () => {
    const stats = taskStats([
      e({
        workDate: '2026-11-24',
        startTime: '13:00',
        endTime: '14:30',
        durationMinutes: 90,
        note: 'Wired the retry\ninto checkout',
      }),
      e({ workDate: '2026-11-23', durationMinutes: 45, note: 'Spike' }),
    ])
    const { notes } = summaryValues('en', stats, e({}), { name: 'Task' })
    expect(notes.split('\n')).toEqual([
      expect.stringMatching(/^- Mon.*23.*, 45m: Spike$/),
      expect.stringMatching(
        /^- Tue.*24.*, 1:00 PM–2:30 PM: Wired the retry into checkout$/,
      ),
    ])
  })
})
