import { describe, expect, it } from 'vitest'
import {
  estimateMisses,
  hourHeatmap,
  hourTicks,
  stackOrder,
  timeBuckets,
} from '../../src/features/reports/domain/analytics'

const makeEntry = (
  workDate: string,
  taskTypeId: string,
  durationMinutes: number,
) => ({
  workDate,
  taskTypeId,
  durationMinutes,
})

describe('analytics', () => {
  it('Should bucket time per day with every day of the period', () => {
    const { unit, buckets } = timeBuckets(
      [
        makeEntry('2026-11-16', 'a', 60),
        makeEntry('2026-11-16', 'b', 30),
        makeEntry('2026-11-18', 'a', 45),
      ],
      '2026-11-16',
      '2026-11-18',
    )
    expect(unit).toBe('day')
    expect(
      buckets.map((timeBucket) => [
        timeBucket.from,
        timeBucket.minutes,
        timeBucket.byType,
      ]),
    ).toEqual([
      ['2026-11-16', 90, { a: 60, b: 30 }],
      ['2026-11-17', 0, {}],
      ['2026-11-18', 45, { a: 45 }],
    ])
  })

  it('Should switch to weeks starting on Monday for long periods', () => {
    const { unit, buckets } = timeBuckets(
      [
        makeEntry('2026-09-02', 'a', 60),
        makeEntry('2026-09-06', 'a', 30),
        makeEntry('2026-11-16', 'a', 10),
      ],
      '2026-09-01',
      '2026-11-17',
    )
    expect(unit).toBe('week')
    expect(buckets[0]).toMatchObject({ from: '2026-08-31', minutes: 90 })
    expect(buckets.at(-1)).toMatchObject({
      from: '2026-11-16',
      to: '2026-11-17',
      minutes: 10,
    })
  })

  it('Should spread timed entries over the hours of the weekday grid', () => {
    const map = hourHeatmap([
      { workDate: '2026-11-16', startTime: '09:30', endTime: '11:00' }, // poniedziałek
      { workDate: '2026-11-21', startTime: '22:15', endTime: '22:45' }, // sobota
      { workDate: '2026-11-17', startTime: null, endTime: null },
    ])
    expect(map.cells[0]!.slice(9, 11)).toEqual([30, 60])
    expect(map.cells[5]![22]).toBe(30)
    expect(map).toMatchObject({ max: 60, firstHour: 9, lastHour: 22 })
  })

  it('Should list the biggest estimate misses first', () => {
    const rows = [
      { key: 'a', title: 'A', minutes: 300, estimateMinutes: 240 },
      { key: 'b', title: 'B', minutes: 60, estimateMinutes: 180 },
      { key: 'c', title: 'C', minutes: 90, estimateMinutes: null },
    ]
    expect(
      estimateMisses(rows).map((estimateMiss) => [
        estimateMiss.key,
        estimateMiss.diff,
      ]),
    ).toEqual([
      ['b', -120],
      ['a', 60],
    ])
  })

  it('Should order stack layers so neighbours are easy to tell apart', () => {
    const order = stackOrder([
      { kind: 'meeting', sortOrder: 0 },
      { kind: 'task', sortOrder: 1 },
      { kind: 'code_review', sortOrder: 2 },
      { kind: 'custom', sortOrder: 3 },
    ])
    expect(order.map((row) => row.kind)).toEqual([
      'task',
      'custom',
      'code_review',
      'meeting',
    ])
  })

  it('Should make round hour ticks', () => {
    expect(hourTicks(7 * 60).map((hourTick) => hourTick / 60)).toEqual([
      0, 2, 4, 6, 8,
    ])
    expect(hourTicks(30).map((hourTick) => hourTick / 60)).toEqual([0, 1])
  })
})

describe('story points earned by time worked', () => {
  it('Should use the estimate first, then the SP scale', async () => {
    const { earnedPoints, taskBudget } =
      await import('../../src/features/story-points/domain/sp-scale')
    const scale = [
      { points: 3, maxMinutes: 240 },
      { points: 5, maxMinutes: 480 },
    ]
    expect(taskBudget(5, null, scale)).toBe(480)
    expect(taskBudget(5, 300, scale)).toBe(300)
    expect(taskBudget(8, null, scale)).toBeNull()
    expect(taskBudget(null, null, scale)).toBeNull()
    // 3 h z 8 h przy 5 SP = 1,9 SP; ponad budżet to najwyżej pełne SP.
    expect(earnedPoints(5, 180, 480)).toBe(1.9)
    expect(earnedPoints(5, 600, 480)).toBe(5)
    expect(earnedPoints(5, 0, 480)).toBe(0)
  })
})
