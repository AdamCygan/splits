import { describe, expect, it } from 'vitest'
import type { TimeEntryInput } from '#/data/types'
import {
  elapsedSeconds,
  isFutureStart,
  minutesBetween,
  parseDuration,
  stoppedValues,
  validateEntry,
} from '#/domain/entries'

const base: TimeEntryInput = {
  taskTypeId: 't',
  projectId: null,
  title: 'PAY-142 Payment gateway',
  link: null,
  storyPoints: 3,
  workDate: '2026-11-02',
  startTime: '09:15',
  endTime: '11:25',
  durationMinutes: 130,
  note: null,
  overtimeMinutes: null,
  overtimeNote: null,
  running: false,
}
const optional = {
  linkRequirement: 'optional',
  descriptionRequirement: 'optional',
  storyPointsRequirement: 'required',
} as const

describe('entries', () => {
  it('parses human durations', () => {
    expect(parseDuration('90')).toBe(90)
    expect(parseDuration('1:30')).toBe(90)
    expect(parseDuration('1h 15m')).toBe(75)
    expect(parseDuration('1,5h')).toBe(90)
    expect(parseDuration('45 min')).toBe(45)
    expect(parseDuration('soon')).toBeNull()
  })
  it('measures a time range within a day', () => {
    expect(minutesBetween('09:15', '11:25')).toBe(130)
    expect(minutesBetween('11:00', '10:00')).toBeNull()
  })
  it('accepts an entry with optional notes left empty', () => {
    expect(validateEntry(base, optional)).toEqual([])
  })
  it('requires notes and links when the work type says so', () => {
    const strict = {
      linkRequirement: 'required',
      descriptionRequirement: 'required',
      storyPointsRequirement: 'required',
    } as const
    expect(validateEntry(base, strict)).toEqual([
      { field: 'link', code: 'required' },
      { field: 'note', code: 'required' },
    ])
    expect(
      validateEntry(
        {
          ...base,
          link: 'https://gitlab.com/a/-/merge_requests/1',
          note: 'Reviewed',
        },
        strict,
      ),
    ).toEqual([])
  })
  it('limits notes to 2000 characters and checks links and time', () => {
    expect(
      validateEntry({ ...base, note: 'x'.repeat(2001) }, optional),
    ).toContainEqual({ field: 'note', code: 'too_long' })
    expect(
      validateEntry({ ...base, link: 'gitlab.com/x' }, optional),
    ).toContainEqual({ field: 'link', code: 'invalid_url' })
    expect(
      validateEntry({ ...base, endTime: '09:00' }, optional),
    ).toContainEqual({ field: 'time', code: 'time_order' })
    expect(
      validateEntry(
        { ...base, startTime: null, endTime: null, durationMinutes: 0 },
        optional,
      ),
    ).toContainEqual({ field: 'time', code: 'duration_range' })
  })

  it('follows the story point setting of the work type', () => {
    const noSp = { ...base, storyPoints: null }
    expect(validateEntry(noSp, optional)).toEqual([
      { field: 'storyPoints', code: 'required' },
    ])
    const review = { ...optional, storyPointsRequirement: 'optional' } as const
    expect(validateEntry(noSp, review)).toEqual([])
    expect(validateEntry(base, review)).toEqual([])
    expect(validateEntry({ ...base, storyPoints: 0 }, review)).toContainEqual({
      field: 'storyPoints',
      code: 'invalid',
    })
    const meeting = { ...optional, storyPointsRequirement: 'hidden' } as const
    expect(validateEntry(noSp, meeting)).toEqual([])
    expect(validateEntry(base, meeting)).toContainEqual({
      field: 'storyPoints',
      code: 'invalid',
    })
  })

  it('accepts a running timer without an end time', () => {
    const timer = { ...base, endTime: null, durationMinutes: 0, running: true }
    expect(validateEntry(timer, optional)).toEqual([])
    expect(
      validateEntry({ ...timer, startTime: null }, optional),
    ).toContainEqual({ field: 'time', code: 'invalid' })
    expect(isFutureStart('12:00', '11:59')).toBe(true)
    expect(isFutureStart('11:59', '11:59')).toBe(false)
  })
  it('computes values when a timer stops', () => {
    const entry = {
      workDate: '2026-11-02',
      startTime: '09:15',
      startedAt: '2026-11-02T08:15:00.000Z',
    }
    expect(stoppedValues(entry, '2026-11-02', '11:25')).toEqual({
      running: false,
      startTime: '09:15',
      endTime: '11:25',
      durationMinutes: 130,
    })
    // zatrzymany w tej samej minucie: minimum 1 minuta
    expect(stoppedValues(entry, '2026-11-02', '09:15')).toMatchObject({
      endTime: '09:16',
      durationMinutes: 1,
    })
    // po północy zostaje sam czas trwania
    const after = stoppedValues(
      entry,
      '2026-11-03',
      '00:30',
      new Date('2026-11-02T23:30:00.000Z'),
    )
    expect(after).toEqual({
      running: false,
      startTime: null,
      endTime: null,
      durationMinutes: 915,
    })
    expect(
      elapsedSeconds(
        '2026-11-02T08:15:00.000Z',
        Date.parse('2026-11-02T08:16:05.000Z'),
      ),
    ).toBe(65)
  })
})
