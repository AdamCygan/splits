import { describe, expect, it } from 'vitest'
import type { TimeEntry, TimeEntryInput } from '#/data/types'
import { validateEntry } from '#/domain/entries'
import { groupTasks, reportCsv, totalsOf } from '#/domain/report'
import { renderSummary, taskStats } from '#/domain/summary'
import { summaryValues } from '#/features/time-entries/summary'

const base: TimeEntryInput = {
  taskTypeId: 't',
  projectId: null,
  title: 'Checkout hotfix',
  link: null,
  storyPoints: null,
  workDate: '2026-11-12',
  startTime: '17:00',
  endTime: '19:30',
  durationMinutes: 150,
  note: null,
  overtimeMinutes: 90,
  overtimeNote: 'Rolled back the cache change after the evening release.',
  estimateMinutes: null,
  extensionMinutes: null,
  extensionNote: null,
  running: false,
}
const type = {
  linkRequirement: 'optional',
  descriptionRequirement: 'optional',
  storyPointsRequirement: 'optional',
} as const
const fields = (input: TimeEntryInput) =>
  validateEntry(input, type).map((i) => `${i.field}:${i.code}`)

describe('overtime validation', () => {
  it('accepts overtime that is part of the entry, up to the whole entry', () => {
    expect(fields(base)).toEqual([])
    expect(fields({ ...base, overtimeMinutes: 150 })).toEqual([])
    expect(
      fields({ ...base, overtimeMinutes: null, overtimeNote: null }),
    ).toEqual([])
  })

  it('needs a description of what was done', () => {
    expect(fields({ ...base, overtimeNote: null })).toEqual([
      'overtimeNote:required',
    ])
    expect(fields({ ...base, overtimeNote: '   ' })).toEqual([
      'overtimeNote:required',
    ])
    expect(fields({ ...base, overtimeNote: 'x'.repeat(1001) })).toEqual([
      'overtimeNote:too_long',
    ])
  })

  it('cannot be longer than the entry, zero or set on a running timer', () => {
    expect(fields({ ...base, overtimeMinutes: 151 })).toEqual([
      'overtime:over_duration',
    ])
    expect(fields({ ...base, overtimeMinutes: 0 })).toEqual([
      'overtime:invalid',
    ])
    expect(fields({ ...base, overtimeMinutes: -1 })).toEqual([
      'overtime:invalid',
    ])
    expect(
      fields({ ...base, running: true, endTime: null, durationMinutes: 0 }),
    ).toEqual(['overtime:running'])
  })

  it('rejects a description without overtime', () => {
    expect(fields({ ...base, overtimeMinutes: null })).toEqual([
      'overtime:required',
    ])
  })
})

let n = 0
const entry = (over: Partial<TimeEntry>): TimeEntry => ({
  id: `e${n++}`,
  ...base,
  overtimeMinutes: null,
  overtimeNote: null,
  estimateMinutes: null,
  extensionMinutes: null,
  extensionNote: null,
  paused: false,
  startedAt: null,
  createdAt: `2026-11-12T10:00:0${n % 10}Z`,
  ...over,
})

describe('overtime in reports and summaries', () => {
  const entries = [
    entry({
      workDate: '2026-11-11',
      startTime: '10:00',
      endTime: '12:00',
      durationMinutes: 120,
    }),
    entry({
      overtimeMinutes: 90,
      overtimeNote: 'Rolled back the cache change.',
    }),
    entry({
      title: 'Other',
      workDate: '2026-11-12',
      overtimeMinutes: 30,
      overtimeNote: 'Answered on-call page.',
    }),
  ]
  const types = [{ id: 't', storyPointsRequirement: 'optional' as const }]

  it('sums overtime per task and in totals, as part of the time', () => {
    const rows = groupTasks(entries, types)
    const hotfix = rows.find((r) => r.title === 'Checkout hotfix')!
    expect(hotfix).toMatchObject({
      minutes: 270,
      overtimeMinutes: 90,
      overtimeNotes: ['Rolled back the cache change.'],
    })
    expect(totalsOf(rows)).toMatchObject({ minutes: 420, overtimeMinutes: 120 })
  })

  it('adds overtime columns to the CSV', () => {
    const rows = groupTasks(entries, types).filter(
      (r) => r.title === 'Checkout hotfix',
    )
    const csv = reportCsv(rows, {
      head: ['Task'],
      typeName: () => 'Extra work',
      projectName: () => '',
    })
    expect(csv.split('\r\n')[1]!).toContain(
      ',90,1.50,Rolled back the cache change.,',
    )
  })

  it('fills {overtime} in the task summary', () => {
    const own = entries.slice(0, 2)
    const values = summaryValues('en', taskStats(own), own[0]!, {
      name: 'Extra work',
    })
    expect(renderSummary('{overtime}', values)).toMatch(
      /^Overtime: 1h 30m\n- .+, 1h 30m: Rolled back the cache change\.$/,
    )
    const none = summaryValues(
      'pl',
      taskStats(own.slice(0, 1)),
      own[0]!,
      undefined,
    )
    expect(none.overtime).toBe('Bez nadgodzin')
  })
})
