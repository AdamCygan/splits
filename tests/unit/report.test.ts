import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '../../src/features/time-entries/data/dto'
import {
  byType,
  groupTasks,
  isValidRange,
  presetRange,
  reportCsv,
  sortRows,
  spForType,
  totalsOf,
} from '#/domain/report'

let n = 0
const entry = (patch: Partial<TimeEntry>): TimeEntry => ({
  id: String(++n),
  finishedAt: null,
  taskTypeId: 'task',
  projectId: null,
  title: 'PAY-142 Payment gateway',
  link: 'https://acme.atlassian.net/browse/PAY-142',
  storyPoints: 3,
  workDate: '2026-11-02',
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
  createdAt: `2026-11-02T10:00:0${n}.000Z`,
  ...patch,
})

const types = [
  { id: 'task', storyPointsRequirement: 'required' },
  { id: 'cr', storyPointsRequirement: 'optional' },
  { id: 'meeting', storyPointsRequirement: 'hidden' },
] as const

describe('report', () => {
  const entries = [
    entry({ durationMinutes: 130 }),
    entry({ durationMinutes: 95, workDate: '2026-11-03', storyPoints: 5 }),
    entry({
      taskTypeId: 'cr',
      title: 'CR !481',
      link: 'https://gitlab.com/a/-/merge_requests/481',
      storyPoints: null,
      durationMinutes: 25,
    }),
    entry({
      taskTypeId: 'cr',
      title: 'CR !479',
      link: 'https://gitlab.com/a/-/merge_requests/479',
      storyPoints: 0.5,
      durationMinutes: 20,
    }),
    // Spotkanie z SP zapisanymi zanim typ dostał „bez SP”: w raporcie się nie liczą.
    entry({
      taskTypeId: 'meeting',
      title: 'Planning',
      link: null,
      storyPoints: 0.5,
      durationMinutes: 60,
    }),
  ]

  it('Should group sessions of a task and count its SP once', () => {
    const rows = groupTasks(entries, types)
    expect(rows).toHaveLength(4)
    const pay = rows.find((r) => r.taskKey === 'PAY-142')!
    expect(pay).toMatchObject({
      minutes: 225,
      sessions: 2,
      days: 2,
      storyPoints: 5,
      first: '2026-11-02',
      last: '2026-11-03',
    })
    expect(rows.find((r) => r.title === 'Planning')!.storyPoints).toBeNull()
    expect(rows.find((r) => r.title === 'CR !481')!.storyPoints).toBeNull()
  })

  it('Should total time and SP, with time per SP from tasks that have SP', () => {
    const totals = totalsOf(groupTasks(entries, types))
    expect(totals).toEqual({
      minutes: 330,
      overtimeMinutes: 0,
      storyPoints: 5.5,
      tasks: 4,
      // (225 + 20) / 5.5
      minutesPerSp: 45,
      extensionMinutes: 0,
      estimated: { tasks: 0, estimateMinutes: 0, actualMinutes: 0 },
    })
    expect(totalsOf([]).minutesPerSp).toBeNull()
  })

  it('Should split by kind of work in the order of work types', () => {
    const rows = byType(groupTasks(entries, types), ['task', 'cr', 'meeting'])
    expect(
      rows.map((r) => [r.taskTypeId, r.minutes, r.storyPoints, r.withoutSp]),
    ).toEqual([
      ['task', 225, 5, 0],
      ['cr', 45, 0.5, 1],
      ['meeting', 60, 0, 1],
    ])
  })

  it('Should sort tasks without SP below the ones with SP', () => {
    const rows = sortRows(groupTasks(entries, types), 'storyPoints', 'desc')
    expect(rows.map((r) => r.storyPoints)).toEqual([5, 0.5, null, null])
  })

  it('Should pick SP for a work type', () => {
    const review = {
      storyPointsRequirement: 'optional',
      defaultStoryPoints: null,
    } as const
    expect(spForType(review, null)).toBeNull()
    expect(spForType(review, 2)).toBe(2)
    expect(
      spForType(
        { storyPointsRequirement: 'hidden', defaultStoryPoints: null },
        3,
      ),
    ).toBeNull()
    expect(
      spForType(
        { storyPointsRequirement: 'required', defaultStoryPoints: 2 },
        null,
      ),
    ).toBe(2)
  })

  it('Should build calendar ranges', () => {
    // 2026-11-04 to środa; tydzień od poniedziałku.
    expect(presetRange('this_week', '2026-11-04', 1)).toEqual({
      from: '2026-11-02',
      to: '2026-11-08',
    })
    expect(presetRange('last_week', '2026-11-04', 1)).toEqual({
      from: '2026-10-26',
      to: '2026-11-01',
    })
    expect(presetRange('this_month', '2026-11-04', 1)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    })
    expect(presetRange('last_month', '2026-01-15', 1)).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
    expect(presetRange('last_30', '2026-11-04', 1)).toEqual({
      from: '2026-10-06',
      to: '2026-11-04',
    })
    expect(isValidRange({ from: '2026-11-05', to: '2026-11-04' })).toBe(false)
    expect(isValidRange({ from: '2026-02-30', to: '2026-03-04' })).toBe(false)
  })

  it('Should export CSV safe for spreadsheets', () => {
    const csv = reportCsv(
      groupTasks(
        [entry({ title: '=HYPERLINK("x"), "quoted"', link: null })],
        types,
      ),
      { head: ['Task'], typeName: () => 'Task', projectName: () => '' },
    )
    const line = csv.split('\r\n')[1]!
    expect(line.startsWith(`"'=HYPERLINK(""x""), ""quoted"""`)).toBe(true)
    expect(line).toContain(',3,60,1.00,1,1,2026-11-02,2026-11-02')
  })
})

describe('task summary intervals', () => {
  it('Should list time ranges per day for {intervals}', async () => {
    const { sampleValues } = await import('#/features/time-entries/summary')
    const en = sampleValues('en').intervals
    expect(en).toContain('9:15 AM–11:25 AM (2h 10m)')
    expect(en).toContain('6:40 AM–7:20 AM (40m)')
    expect(en.split('\n')).toHaveLength(3)
    expect(sampleValues('pl').intervals).toContain('6:40–7:20 (40 min)')
  })
})
