import { describe, expect, it } from 'vitest'
import type {
  TimeEntry,
  TimeEntryInput,
} from '../../src/features/time-entries/data/dto'
import {
  validateEntry,
  withExtension,
} from '../../src/features/time-entries/domain/entries'
import {
  groupTasks,
  reportCsv,
  totalsOf,
} from '../../src/features/reports/domain/report'
import { estimateOf } from '../../src/features/sprints/domain/sprint-stats'

const meeting: TimeEntryInput = {
  taskTypeId: 'm',
  projectId: null,
  title: 'Sprint planning',
  link: null,
  storyPoints: null,
  workDate: '2026-11-12',
  startTime: '10:00',
  endTime: '11:00',
  durationMinutes: 60,
  note: null,
  overtimeMinutes: null,
  overtimeNote: null,
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
  validateEntry(input, type).map(
    (entryIssue) => `${entryIssue.field}:${entryIssue.code}`,
  )

const entry = (over: Partial<TimeEntry>): TimeEntry => ({
  ...meeting,
  id: crypto.randomUUID(),
  finishedAt: null,
  paused: false,
  startedAt: null,
  createdAt: '2026-11-12T10:00:00Z',
  ...over,
})

describe('extension (a meeting that ran over)', () => {
  it('Should be part of the entry time and always come with a reason', () => {
    const ok = { ...meeting, durationMinutes: 80, endTime: '11:20' }
    expect(
      fields({ ...ok, extensionMinutes: 20, extensionNote: 'Scope talk' }),
    ).toEqual([])
    expect(fields({ ...ok, extensionMinutes: 20 })).toEqual([
      'extensionNote:required',
    ])
    expect(fields({ ...ok, extensionNote: 'Orphan reason' })).toEqual([
      'extension:required',
    ])
    expect(fields({ ...ok, extensionMinutes: 90, extensionNote: 'x' })).toEqual(
      ['extension:over_duration'],
    )
    expect(
      fields({
        ...ok,
        extensionMinutes: 20,
        extensionNote: 'x'.repeat(1001),
      }),
    ).toEqual(['extensionNote:too_long'])
  })

  it('Should move the end time by the extra time and keep the plan', () => {
    const planned = entry({})
    const extended = withExtension(planned, 20, 'Scope talk')
    expect(extended).toMatchObject({
      startTime: '10:00',
      endTime: '11:20',
      durationMinutes: 80,
      extensionMinutes: 20,
      extensionNote: 'Scope talk',
    })
    // Zmiana przedłużenia liczy od planu (60 min), a usunięcie wraca do planu.
    const again = withExtension(
      entry({ ...extended, endTime: '11:20' }),
      45,
      'Longer',
    )
    expect(again).toMatchObject({ endTime: '11:45', durationMinutes: 105 })
    expect(
      withExtension(entry({ ...extended, endTime: '11:20' }), null, null),
    ).toMatchObject({
      endTime: '11:00',
      durationMinutes: 60,
      extensionMinutes: null,
      extensionNote: null,
    })
  })

  it('Should fall back to a duration when the end would pass midnight', () => {
    const late = entry({
      startTime: '23:30',
      endTime: '23:50',
      durationMinutes: 20,
    })
    expect(withExtension(late, 30, 'Late incident')).toMatchObject({
      startTime: null,
      endTime: null,
      durationMinutes: 50,
    })
  })
})

describe('task estimate', () => {
  it('Should reject estimates outside 1 minute to 1000 hours', () => {
    expect(fields({ ...meeting, estimateMinutes: 240 })).toEqual([])
    expect(fields({ ...meeting, estimateMinutes: 0 })).toEqual([
      'estimate:invalid',
    ])
    expect(fields({ ...meeting, estimateMinutes: 60_001 })).toEqual([
      'estimate:invalid',
    ])
  })

  it('Should belong to the task and be compared with the real time of all sessions', () => {
    const task = { taskTypeId: 'm', title: 'PAY-1', link: null }
    const rows = groupTasks(
      [
        entry({ ...task, durationMinutes: 120, estimateMinutes: 240 }),
        entry({
          ...task,
          workDate: '2026-11-13',
          durationMinutes: 170,
          estimateMinutes: null,
        }),
        entry({
          title: 'Planning',
          durationMinutes: 80,
          extensionMinutes: 20,
          extensionNote: 'Scope talk',
        }),
      ],
      [{ id: 'm', storyPointsRequirement: 'optional' }],
    )
    const pay = rows.find((taskRow) => taskRow.title === 'PAY-1')!
    expect(pay).toMatchObject({ minutes: 290, estimateMinutes: 240 })
    expect(estimateOf(pay, [])).toMatchObject({
      status: 'over',
      overBy: 50,
      source: 'estimate',
    })
    expect(estimateOf({ ...pay, minutes: 200 }, [])!.status).toBe('within')
    expect(estimateOf({ ...pay, minutes: 100 }, [])!.status).toBe('under')

    expect(totalsOf(rows)).toMatchObject({
      extensionMinutes: 20,
      estimated: { tasks: 1, estimateMinutes: 240, actualMinutes: 290 },
    })
    const csv = reportCsv(rows, {
      head: ['Task'],
      typeName: () => '',
      projectName: () => '',
    }).split('\r\n')
    expect(csv.find((line) => line.startsWith('PAY-1'))).toMatch(/,240,50,0,$/)
    expect(csv.find((line) => line.startsWith('Planning'))).toMatch(
      /,,,20,Scope talk$/,
    )
  })
})
