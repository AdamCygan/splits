import { describe, expect, it } from 'vitest'
import type { QuickTemplate } from '../../src/features/templates/data/dto'
import {
  isLogged,
  sameTime,
  scheduleRuns,
  scheduledOn,
} from '../../src/features/templates/domain/schedule'

const daily: QuickTemplate = {
  id: 'daily',
  taskTypeId: 'meet',
  projectId: null,
  askProject: false,
  label: 'Daily',
  title: 'Daily stand-up',
  storyPoints: null,
  defaultDurationMinutes: 15,
  hotkey: 1,
  sortOrder: 0,
  schedule: [
    { day: 1, time: '10:00' },
    { day: 2, time: '09:30' },
    { day: 3, time: '09:30' },
    { day: 4, time: '09:30' },
    { day: 5, time: '09:30' },
  ],
}
const retro: QuickTemplate = {
  ...daily,
  id: 'retro',
  label: 'Retro',
  title: 'Retro',
  defaultDurationMinutes: 60,
  schedule: [{ day: 5, time: '09:00' }],
}

describe('recurring meetings', () => {
  it('Should use the time set for that weekday', () => {
    // 2026-11-23 to poniedziałek, 2026-11-27 piątek.
    expect(scheduledOn([daily], '2026-11-23')).toEqual([
      { template: daily, start: '10:00', end: '10:15' },
    ])
    expect(
      scheduledOn([daily, retro], '2026-11-27').map((m) => [
        m.template.label,
        m.start,
        m.end,
      ]),
    ).toEqual([
      ['Retro', '09:00', '10:00'],
      ['Daily', '09:30', '09:45'],
    ])
    expect(scheduledOn([daily], '2026-11-22')).toEqual([])
  })

  it('Should need a duration and stay within the day', () => {
    expect(
      scheduledOn([{ ...daily, defaultDurationMinutes: null }], '2026-11-23'),
    ).toEqual([])
    const late = { ...retro, schedule: [{ day: 5, time: '23:30' }] }
    expect(scheduledOn([late], '2026-11-27')[0]!.end).toBe('23:59')
  })

  it('Should know when the meeting is already logged that day', () => {
    expect(
      isLogged([{ taskTypeId: 'meet', title: ' daily stand-up ' }], daily),
    ).toBe(true)
    expect(
      isLogged([{ taskTypeId: 'task', title: 'Daily stand-up' }], daily),
    ).toBe(false)
  })

  it('Should describe the schedule in week order, joining days with the same time', () => {
    expect(scheduleRuns(daily.schedule, 1)).toEqual([
      { from: 1, to: 1, time: '10:00' },
      { from: 2, to: 5, time: '09:30' },
    ])
    expect(
      scheduleRuns(
        [
          { day: 0, time: '09:00' },
          { day: 1, time: '09:00' },
          { day: 3, time: '09:00' },
        ],
        1,
      ),
    ).toEqual([
      { from: 1, to: 1, time: '09:00' },
      { from: 3, to: 3, time: '09:00' },
      { from: 0, to: 0, time: '09:00' },
    ])
    expect(sameTime(daily.schedule)).toBeNull()
    expect(sameTime(retro.schedule)).toBe('09:00')
  })
})
