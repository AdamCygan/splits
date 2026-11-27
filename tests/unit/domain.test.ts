import { describe, expect, it } from 'vitest'
import type { SprintCadence } from '../../src/features/sprints/data/dto'
import {
  addDays,
  diffDays,
  isValidDate,
  startOfWeek,
  weekday,
} from '#/domain/dates'
import {
  extractTaskKey,
  PROJECT_KEY_RE,
  sameName,
  TIME_RE,
  USERNAME_RE,
} from '#/domain/rules'
import {
  rangeFor,
  scalePresets,
  suggestPoints,
  validateScale,
} from '#/domain/sp-scale'
import {
  cadenceNumberAt,
  cadenceSprint,
  missingCadenceSprints,
  previewCadence,
  rangesOverlap,
  sprintName,
  sprintPhase,
  sprintWorkingDays,
} from '#/domain/sprints'

describe('dates', () => {
  it('Should add days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('Should count days without DST drift', () => {
    expect(diffDays('2026-03-27', '2026-03-30')).toBe(3)
    expect(diffDays('2026-10-23', '2026-10-26')).toBe(3)
  })
  it('Should validate real calendar dates only', () => {
    expect(isValidDate('2028-02-29')).toBe(true)
    expect(isValidDate('2026-02-29')).toBe(false)
    expect(isValidDate('2026-13-01')).toBe(false)
    expect(isValidDate('02-11-2026')).toBe(false)
  })
  it('Should find the start of the week', () => {
    expect(weekday('2026-11-02')).toBe(1) // poniedziałek
    expect(startOfWeek('2026-11-05', 1)).toBe('2026-11-02')
    expect(startOfWeek('2026-11-05', 0)).toBe('2026-11-01')
  })
})

describe('sprints', () => {
  const cadence: SprintCadence = {
    lengthDays: 14,
    anchorDate: '2026-10-05',
    namePattern: 'Sprint {n}',
    autoCreate: true,
  }

  it('Should name sprints from a pattern', () => {
    expect(sprintName('Sprint {n}', 4)).toBe('Sprint 4')
    expect(sprintName('S{n}-{n}', 2)).toBe('S2-2')
    expect(sprintName('Iteration', 7)).toBe('Iteration 7')
  })
  it('Should compute the n-th sprint of a cadence', () => {
    expect(cadenceSprint(cadence, 1)).toEqual({
      number: 1,
      name: 'Sprint 1',
      startsOn: '2026-10-05',
      endsOn: '2026-10-18',
    })
    expect(cadenceSprint(cadence, 3)).toMatchObject({
      startsOn: '2026-11-02',
      endsOn: '2026-11-15',
    })
  })
  it('Should map a day to a sprint number', () => {
    expect(cadenceNumberAt(cadence, '2026-10-04')).toBe(0)
    expect(cadenceNumberAt(cadence, '2026-10-18')).toBe(1)
    expect(cadenceNumberAt(cadence, '2026-10-19')).toBe(2)
  })
  it('Should preview upcoming sprints starting with the current one', () => {
    const preview = previewCadence(cadence, '2026-11-02', 3)
    expect(preview.map((s) => s.number)).toEqual([3, 4, 5])
  })
  it('Should create missing cadence sprints without overlapping manual ones', () => {
    const manual = [
      { number: null, startsOn: '2026-10-19', endsOn: '2026-10-25' },
    ]
    const missing = missingCadenceSprints(cadence, manual, '2026-11-02')
    expect(missing.map((s) => s.number)).toEqual([1, 3, 4])
    expect(
      missingCadenceSprints(
        { ...cadence, autoCreate: false },
        [],
        '2026-11-02',
      ),
    ).toEqual([])
  })
  it('Should detect overlap with inclusive ends', () => {
    expect(
      rangesOverlap(
        { startsOn: '2026-11-01', endsOn: '2026-11-14' },
        { startsOn: '2026-11-14', endsOn: '2026-11-20' },
      ),
    ).toBe(true)
    expect(
      rangesOverlap(
        { startsOn: '2026-11-01', endsOn: '2026-11-13' },
        { startsOn: '2026-11-14', endsOn: '2026-11-20' },
      ),
    ).toBe(false)
  })
  it('Should tell the sprint phase and working days', () => {
    const sprint = { startsOn: '2026-11-02', endsOn: '2026-11-15' }
    expect(sprintPhase(sprint, '2026-11-01')).toBe('upcoming')
    expect(sprintPhase(sprint, '2026-11-15')).toBe('current')
    expect(sprintPhase(sprint, '2026-11-16')).toBe('past')
    expect(sprintWorkingDays(sprint, [1, 2, 3, 4, 5])).toBe(10)
  })
})

describe('story point scale', () => {
  const scale = [
    { points: 1, maxMinutes: 60 },
    { points: 2, maxMinutes: 120 },
    { points: 3, maxMinutes: 240 },
    { points: 5, maxMinutes: 480 },
  ]

  it.each(Object.entries(scalePresets))(
    'Should accept the %s preset',
    (_name, preset) => {
      expect(validateScale(preset)).toEqual([])
    },
  )
  it('Should report issues at the row that has them', () => {
    expect(validateScale([])).toEqual([{ code: 'empty' }])
    expect(
      validateScale([
        { points: 3, maxMinutes: 240 },
        { points: 2, maxMinutes: 300 },
      ]),
    ).toEqual([{ code: 'not_increasing', index: 0 }])
    expect(
      validateScale([
        { points: 2, maxMinutes: 60 },
        { points: 2, maxMinutes: 120 },
      ]),
    ).toContainEqual({ code: 'duplicate_points', index: 1 })
    expect(validateScale([{ points: 0, maxMinutes: 0 }])).toEqual([
      { code: 'points_range', index: 0 },
      { code: 'minutes_range', index: 0 },
    ])
  })
  it('Should give the time range of a value', () => {
    expect(rangeFor(scale, 1)).toEqual({ min: 0, max: 60 })
    expect(rangeFor(scale, 3)).toEqual({ min: 120, max: 240 })
    expect(rangeFor(scale, 8)).toBeNull()
  })
  it('Should suggest the smallest value that fits the time', () => {
    expect(suggestPoints(scale, 30)).toBe(1)
    expect(suggestPoints(scale, 121)).toBe(3)
    expect(suggestPoints(scale, 480)).toBe(5)
    expect(suggestPoints(scale, 481)).toBeNull()
  })
})

describe('rules', () => {
  it('Should validate identifiers', () => {
    expect(PROJECT_KEY_RE.test('PAY')).toBe(true)
    expect(PROJECT_KEY_RE.test('pay')).toBe(false)
    expect(PROJECT_KEY_RE.test('P')).toBe(false)
    expect(USERNAME_RE.test('jan.kowalski')).toBe(true)
    expect(USERNAME_RE.test('.jan')).toBe(false)
    expect(TIME_RE.test('09:30')).toBe(true)
    expect(TIME_RE.test('24:00')).toBe(false)
  })
  it('Should compare names ignoring case and spaces', () => {
    expect(sameName(' Code Review ', 'code review')).toBe(true)
  })
  it('Should extract task keys from links', () => {
    expect(extractTaskKey('https://acme.atlassian.net/browse/PAY-142')).toBe(
      'PAY-142',
    )
    expect(
      extractTaskKey('https://gitlab.com/acme/api/-/merge_requests/481'),
    ).toBe('!481')
    expect(extractTaskKey('https://github.com/acme/api/pull/12')).toBe('#12')
    expect(extractTaskKey('https://example.com')).toBeNull()
  })
})
