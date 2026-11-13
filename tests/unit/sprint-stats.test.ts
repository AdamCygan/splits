import { describe, expect, it } from 'vitest'
import type { Sprint, TimeEntry } from '#/data/types'
import {
  averageMinutesPerSp,
  estimateOf,
  sprintDay,
  sprintStats,
} from '#/domain/sprint-stats'

const types = [
  { id: 'task', storyPointsRequirement: 'required' as const },
  { id: 'meeting', storyPointsRequirement: 'hidden' as const },
]
const sprint: Sprint = {
  id: 's1',
  number: 14,
  name: 'Sprint 14',
  goal: null,
  startsOn: '2026-11-02',
  endsOn: '2026-11-15',
  capacityStoryPoints: 30,
  fromCadence: true,
}
let n = 0
const entry = (over: Partial<TimeEntry>): TimeEntry => ({
  id: `e${n++}`,
  taskTypeId: 'task',
  projectId: null,
  title: 'PAY-142',
  link: null,
  storyPoints: 5,
  workDate: '2026-11-03',
  startTime: null,
  endTime: null,
  durationMinutes: 60,
  note: null,
  overtimeMinutes: null,
  overtimeNote: null,
  running: false,
  paused: false,
  startedAt: null,
  createdAt: `2026-11-03T10:00:0${n % 10}Z`,
  ...over,
})

describe('sprintStats', () => {
  it('counts only entries inside the sprint and SP once per task', () => {
    const stats = sprintStats(
      sprint,
      [
        entry({ durationMinutes: 120 }),
        entry({ durationMinutes: 180, workDate: '2026-11-04' }),
        entry({ title: 'PAY-150', storyPoints: 3, durationMinutes: 240 }),
        entry({
          taskTypeId: 'meeting',
          title: 'Planning',
          storyPoints: null,
          durationMinutes: 90,
        }),
        entry({ title: 'Old', workDate: '2026-11-01', durationMinutes: 600 }),
        entry({ title: 'Next', workDate: '2026-11-16', durationMinutes: 600 }),
      ],
      types,
    )
    expect(stats.minutes).toBe(630)
    expect(stats.storyPoints).toBe(8)
    expect(stats.tasks).toBe(3)
    // (120 + 180 + 240) min na 8 SP: spotkanie bez SP nie zawyża wyniku.
    expect(stats.minutesPerSp).toBe(68)
    expect(stats.types.map((r) => [r.taskTypeId, r.minutes])).toEqual([
      ['task', 540],
      ['meeting', 90],
    ])
  })

  it('is empty for a sprint without entries', () => {
    expect(sprintStats(sprint, [], types)).toMatchObject({
      minutes: 0,
      storyPoints: 0,
      minutesPerSp: null,
      types: [],
    })
  })
})

describe('averageMinutesPerSp', () => {
  it('weights sprints by their story points', () => {
    expect(
      averageMinutesPerSp([
        { minutesPerSp: 120, storyPoints: 30 },
        { minutesPerSp: 240, storyPoints: 10 },
        { minutesPerSp: null, storyPoints: 0 },
      ]),
    ).toBe(150)
    expect(
      averageMinutesPerSp([{ minutesPerSp: null, storyPoints: 0 }]),
    ).toBeNull()
  })
})

describe('sprintDay', () => {
  it('clamps to the sprint', () => {
    expect(sprintDay(sprint, '2026-11-02')).toEqual({ day: 1, total: 14 })
    expect(sprintDay(sprint, '2026-11-10')).toEqual({ day: 9, total: 14 })
    expect(sprintDay(sprint, '2026-12-01')).toEqual({ day: 14, total: 14 })
    expect(sprintDay(sprint, '2026-10-01')).toEqual({ day: 1, total: 14 })
  })
})

describe('estimateOf', () => {
  const scale = [
    { points: 1, maxMinutes: 120 },
    { points: 3, maxMinutes: 480 },
    { points: 5, maxMinutes: 960 },
  ]
  it('compares time with the range for the task’s story points', () => {
    expect(estimateOf({ storyPoints: 3, minutes: 300 }, scale)).toMatchObject({
      status: 'within',
      min: 120,
      max: 480,
      overBy: 0,
    })
    expect(estimateOf({ storyPoints: 3, minutes: 480 }, scale)?.status).toBe(
      'within',
    )
    expect(estimateOf({ storyPoints: 3, minutes: 600 }, scale)).toMatchObject({
      status: 'over',
      overBy: 120,
    })
    expect(estimateOf({ storyPoints: 3, minutes: 120 }, scale)?.status).toBe(
      'under',
    )
    expect(estimateOf({ storyPoints: 1, minutes: 30 }, scale)?.status).toBe(
      'within',
    )
  })
  it('has no verdict without story points or outside the scale', () => {
    expect(estimateOf({ storyPoints: null, minutes: 300 }, scale)).toBeNull()
    expect(estimateOf({ storyPoints: 8, minutes: 300 }, scale)).toBeNull()
  })
})
