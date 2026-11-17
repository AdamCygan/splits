import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '#/data/types'
import { taskInsights } from '#/domain/task-insights'

let n = 0
const e = (over: Partial<TimeEntry>): TimeEntry => ({
  id: `e${++n}`,
  taskTypeId: 'task',
  projectId: null,
  title: 'PAY-142 Gateway',
  link: null,
  storyPoints: 5,
  workDate: '2026-11-16',
  startTime: null,
  endTime: null,
  durationMinutes: 0,
  note: null,
  overtimeMinutes: null,
  overtimeNote: null,
  estimateMinutes: null,
  extensionMinutes: null,
  extensionNote: null,
  running: false,
  paused: false,
  startedAt: null,
  createdAt: '2026-11-16T08:00:00Z',
  ...over,
})

describe('task insights', () => {
  it('counts sessions, days and what interrupted the task', () => {
    const a = e({ startTime: '09:00', endTime: '09:40', durationMinutes: 40 })
    const b = e({ startTime: '10:30', endTime: '12:00', durationMinutes: 90 })
    const c = e({ startTime: '13:00', endTime: '13:30', durationMinutes: 30 })
    const d = e({ workDate: '2026-11-18', durationMinutes: 60 })
    const hotfix = e({
      title: 'Hotfix checkout',
      taskTypeId: 'extra',
      startTime: '09:40',
      endTime: '10:20',
      durationMinutes: 40,
    })
    const standup = e({
      title: 'Stand-up',
      taskTypeId: 'meeting',
      startTime: '12:30',
      endTime: '12:45',
      durationMinutes: 15,
    })
    const hotfix2 = e({
      title: 'Hotfix checkout',
      taskTypeId: 'extra',
      startTime: '12:45',
      endTime: '13:00',
      durationMinutes: 15,
    })
    const later = e({
      title: 'Other',
      startTime: '15:00',
      endTime: '16:00',
      durationMinutes: 60,
    })

    const x = taskInsights(
      [d, c, a, b],
      [a, b, c, d, hotfix, standup, hotfix2, later],
    )!
    expect(x).toMatchObject({
      minutes: 220,
      sessions: 4,
      firstDate: '2026-11-16',
      lastDate: '2026-11-18',
      spanDays: 3,
      averageSession: 55,
      longestSession: 90,
      shortestSession: 30,
      minutesPerInterruption: 110,
    })
    expect(x.days).toEqual([
      { date: '2026-11-16', minutes: 160, sessions: 3 },
      { date: '2026-11-18', minutes: 60, sessions: 1 },
    ])
    expect(
      x.gaps.map((g) => [
        g.from,
        g.to,
        g.minutes,
        g.between.map((item) => item.title),
      ]),
    ).toEqual([
      ['09:40', '10:30', 50, ['Hotfix checkout']],
      ['12:00', '13:00', 60, ['Stand-up', 'Hotfix checkout']],
    ])
    expect(x.interruptedBy).toEqual([
      { title: 'Hotfix checkout', taskTypeId: 'extra', minutes: 55, times: 2 },
      { title: 'Stand-up', taskTypeId: 'meeting', minutes: 15, times: 1 },
    ])
  })

  it('has no interruptions for one session and nothing for no sessions', () => {
    expect(taskInsights([], [])).toBeNull()
    const one = taskInsights([e({ durationMinutes: 45 })], [])!
    expect(one).toMatchObject({
      sessions: 1,
      gaps: [],
      minutesPerInterruption: null,
    })
  })
})
