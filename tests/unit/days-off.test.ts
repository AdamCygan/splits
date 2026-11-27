import { describe, expect, it } from 'vitest'
import type { DayOff } from '#/data/types'
import { groupDaysOff, sprintAvailability } from '#/domain/days-off'

const off = (
  date: string,
  kind: DayOff['kind'] = 'vacation',
  note: string | null = null,
): DayOff => ({ date, kind, note })
const WEEK = [1, 2, 3, 4, 5]

describe('days off', () => {
  it('Should join a vacation across the weekend and split by kind', () => {
    // pt 2026-11-13, pn 2026-11-16, wt 17; śr 18 to L4.
    const ranges = groupDaysOff(
      [
        off('2026-11-16'),
        off('2026-11-13'),
        off('2026-11-17'),
        off('2026-11-18', 'sick'),
      ],
      WEEK,
    )
    expect(ranges).toEqual([
      {
        from: '2026-11-13',
        to: '2026-11-17',
        kind: 'vacation',
        note: null,
        date: '2026-11-13',
        days: 3,
      },
      {
        from: '2026-11-18',
        to: '2026-11-18',
        kind: 'sick',
        note: null,
        date: '2026-11-18',
        days: 1,
      },
    ])
  })

  it('Should not join days with a working day between them', () => {
    const ranges = groupDaysOff([off('2026-11-16'), off('2026-11-18')], WEEK)
    expect(ranges.map((r) => [r.from, r.to])).toEqual([
      ['2026-11-16', '2026-11-16'],
      ['2026-11-18', '2026-11-18'],
    ])
  })

  it('Should count the working days a sprint really had', () => {
    const sprint = { startsOn: '2026-11-09', endsOn: '2026-11-20' }
    expect(
      sprintAvailability(sprint, WEEK, [
        off('2026-11-11', 'holiday'),
        off('2026-11-16'),
        off('2026-11-17'),
        off('2026-11-14'), // sobota: nie zmniejsza dni roboczych
        off('2026-11-23'), // po sprincie
      ]),
    ).toEqual({
      working: 10,
      off: 3,
      available: 7,
      byKind: { holiday: 1, vacation: 2 },
    })
  })
})
