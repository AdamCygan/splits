import { describe, expect, it } from 'vitest'
import type { TimeEntry, WorkBreak } from '#/data/types'
import { daySummary } from '#/domain/day-summary'

let n = 0
const e = (over: Partial<TimeEntry>): TimeEntry => ({
  id: `e${++n}`,
  finishedAt: null,
  taskTypeId: 'task',
  projectId: null,
  title: 'PAY-1 Checkout',
  link: null,
  storyPoints: 3,
  workDate: '2026-11-20',
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
  createdAt: '2026-11-20T08:00:00Z',
  ...over,
})
const brk = (
  startTime: string,
  endTime: string,
  minutes: number,
): WorkBreak => ({
  id: `b${++n}`,
  workDate: '2026-11-20',
  startTime,
  endTime,
  durationMinutes: minutes,
  running: false,
  startedAt: null,
  resumeEntryId: null,
})
const types = [
  { id: 'task', kind: 'task', storyPointsRequirement: 'required' },
  { id: 'meet', kind: 'meeting', storyPointsRequirement: 'hidden' },
] as const

describe('day summary', () => {
  const entries = [
    e({ startTime: '09:00', endTime: '10:30', durationMinutes: 90 }),
    e({
      taskTypeId: 'meet',
      title: 'Daily',
      startTime: '10:30',
      endTime: '10:45',
      durationMinutes: 15,
      storyPoints: null,
    }),
    e({ startTime: '10:45', endTime: '12:00', durationMinutes: 75 }),
    e({
      title: 'PAY-2 Refunds',
      startTime: '12:00',
      endTime: '12:30',
      durationMinutes: 30,
    }),
    e({
      title: 'PAY-2 Refunds',
      durationMinutes: 20,
      overtimeMinutes: 20,
    }),
  ]
  const s = daySummary(entries, [brk('12:30', '13:00', 30)], [...types])

  it('Should sum the day and split focus work from meetings', () => {
    expect(s).toMatchObject({
      minutes: 230,
      focusMinutes: 215,
      meetingMinutes: 15,
      meetings: 1,
      overtimeMinutes: 20,
      breakMinutes: 30,
      untimedMinutes: 20,
      span: { start: 9 * 60, end: 13 * 60 },
    })
  })

  it('Should find the longest stretch without meetings and count task switches', () => {
    // 10:45–12:30: dwie sesje różnych zadań bez przerwy między nimi.
    expect(s.longestFocus).toBe(105)
    // PAY-1 → Daily → PAY-1 → PAY-2
    expect(s.switches).toBe(3)
  })

  it('Should list tasks longest first and the timeline in order, with breaks', () => {
    expect(s.tasks.map((r) => [r.title, r.minutes, r.sessions])).toEqual([
      ['PAY-1 Checkout', 165, 2],
      ['PAY-2 Refunds', 50, 2],
      ['Daily', 15, 1],
    ])
    expect(s.blocks.map((b) => b.kind)).toEqual([
      'work',
      'work',
      'work',
      'work',
      'break',
    ])
    expect(s.byType).toEqual([
      { taskTypeId: 'task', minutes: 215 },
      { taskTypeId: 'meet', minutes: 15 },
    ])
  })

  it('Should have no timeline for a day without set hours', () => {
    const empty = daySummary([e({})], [], [...types])
    expect(empty.span).toBeNull()
    expect(empty.untimedMinutes).toBe(60)
  })
})
