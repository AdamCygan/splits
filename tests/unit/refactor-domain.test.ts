import { describe, expect, it } from 'vitest'
import type { QuickTemplate } from '../../src/features/templates/data/dto'
import type { TaskType } from '../../src/features/task-types/data/dto'
import type { TimeEntry } from '../../src/features/time-entries/data/dto'
import {
  aggregateTasks,
  dayTaskGroups,
} from '../../src/features/tasks/domain/task-groups'
import {
  defaultChoice,
  templateNeeds,
  templateNeedsDialog,
  templatePlan,
} from '../../src/features/templates/domain/templates'
import {
  blockIndexAt,
  timelineAxis,
} from '../../src/features/day/domain/day-summary'
import { maxOf, percentOf } from '../../src/shared/domain/numbers'
import { nextSort, reportRange } from '../../src/features/reports/domain/report'
import {
  taskDayTimeline,
  taskNotes,
} from '../../src/features/tasks/domain/task-insights'
import {
  currentSprint,
  startedSprints,
  upcomingSprint,
} from '../../src/features/sprints/domain/sprints'
import { foldText } from '../../src/shared/domain/text'
import {
  clampWorkDate,
  dayTotals,
  historyStart,
} from '../../src/features/settings/domain/workday'

let n = 0
const entry = (patch: Partial<TimeEntry>): TimeEntry => ({
  id: String(++n),
  finishedAt: null,
  taskTypeId: 'task',
  projectId: null,
  title: 'PAY-142 Payment gateway',
  link: null,
  storyPoints: 3,
  workDate: '2026-11-26',
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
  createdAt: `2026-11-26T10:00:${String(n).padStart(2, '0')}.000Z`,
  ...patch,
})

const type = (patch: Partial<TaskType> = {}): TaskType => ({
  id: 'task',
  kind: 'task',
  name: 'Task',
  color: '#00f',
  isSystem: true,
  titleLabel: 'Title',
  linkRequirement: 'optional',
  linkLabel: '',
  descriptionRequirement: 'optional',
  storyPointsRequirement: 'required',
  defaultStoryPoints: 1,
  defaultTimeInput: 'duration',
  countsAsFocusWork: true,
  sortOrder: 0,
  archivedAt: null,
  ...patch,
})

const template = (patch: Partial<QuickTemplate> = {}): QuickTemplate => ({
  id: 'tpl',
  label: 'Stand-up',
  title: 'Daily stand-up',
  taskTypeId: 'meeting',
  projectId: null,
  askProject: false,
  storyPoints: null,
  defaultDurationMinutes: 15,
  hotkey: 1,
  schedule: [],
  sortOrder: 0,
  ...patch,
})

describe('task groups', () => {
  it('Should aggregate sessions into tasks, latest first', () => {
    const tasks = aggregateTasks([
      entry({ title: 'A', workDate: '2026-11-24' }),
      entry({
        title: 'B',
        workDate: '2026-11-25',
        finishedAt: '2026-11-25T12:00:00Z',
      }),
      entry({ title: 'A', workDate: '2026-11-26', startTime: '09:00' }),
    ])
    expect(
      tasks.map((x) => [
        x.latest.title,
        x.sessions.length,
        x.workedMinutes,
        x.finished,
      ]),
    ).toEqual([
      ['A', 2, 120, false],
      ['B', 1, 60, true],
    ])
  })

  it('Should order a day: running task on top, sessions chronologically', () => {
    const groups = dayTaskGroups([
      entry({
        title: 'A',
        startTime: '10:00',
        storyPoints: 2,
        estimateMinutes: 90,
      }),
      entry({ title: 'A', startTime: '08:00', storyPoints: 5 }),
      entry({ title: 'B', running: true, startTime: '11:00' }),
    ])
    expect(groups.map((g) => g.latest.title)).toEqual(['B', 'A'])
    const a = groups[1]!
    expect(a.sessions.map((e) => e.startTime)).toEqual(['08:00', '10:00'])
    expect(a).toMatchObject({
      doneMinutes: 120,
      storyPoints: 5,
      estimateMinutes: 90,
    })
  })
})

describe('workday', () => {
  it('Should keep the shown day within today and the plan history', () => {
    const min = historyStart('2026-11-26', 30)
    expect(min).toBe('2026-10-28')
    expect(clampWorkDate(undefined, '2026-11-26', min)).toBe('2026-11-26')
    expect(clampWorkDate('2026-12-01', '2026-11-26', min)).toBe('2026-11-26')
    expect(clampWorkDate('2026-01-01', '2026-11-26', min)).toBe('2026-10-28')
    expect(clampWorkDate('2026-01-01', '2026-11-26', null)).toBe('2026-01-01')
  })

  it('Should total the day and count a task’s points once', () => {
    const totals = dayTotals(
      [
        entry({ title: 'A' }),
        entry({ title: 'A' }),
        entry({ title: 'B', storyPoints: 2 }),
      ],
      [type()],
      240,
    )
    expect(totals).toMatchObject({
      minutes: 180,
      storyPoints: 5,
      entries: 3,
      progress: 75,
    })
  })
})

describe('templates', () => {
  const meeting = type({
    id: 'meeting',
    kind: 'meeting',
    storyPointsRequirement: 'hidden',
  })

  it('Should ask only for what is missing', () => {
    const needs = templateNeeds(
      template({ defaultDurationMinutes: null }),
      meeting,
      [],
      false,
    )
    expect(needs.duration).toBe(true)
    expect(templateNeedsDialog(needs, false)).toBe(true)
    // Spotkanie z harmonogramu ma godziny, więc czasu nie trzeba podawać.
    expect(templateNeedsDialog(needs, true)).toBe(false)
  })

  it('Should plan an entry, a scheduled meeting and a timer', () => {
    const opts = { workDate: '2026-11-26', now: '09:31' }
    expect(
      templatePlan(template(), meeting, defaultChoice(template()), opts),
    ).toMatchObject({
      kind: 'entry',
      input: { durationMinutes: 15, startTime: null, storyPoints: null },
    })
    expect(
      templatePlan(template(), meeting, defaultChoice(template()), {
        ...opts,
        at: { template: template(), start: '09:30', end: '09:45' },
      }),
    ).toMatchObject({
      kind: 'entry',
      input: { startTime: '09:30', endTime: '09:45', durationMinutes: 15 },
    })
    const timer = template({ defaultDurationMinutes: null })
    expect(
      templatePlan(timer, meeting, defaultChoice(timer), opts),
    ).toMatchObject({
      kind: 'timer',
      input: { startTime: '09:31' },
    })
  })
})

it('Should fold text for comparisons', () => {
  expect(foldText('Źródło ŁÓDŹ')).toBe('zrodlo lodz')
})

describe('sprint lists', () => {
  const sprints = [
    { id: 'a', startsOn: '2026-10-01', endsOn: '2026-10-14' },
    { id: 'b', startsOn: '2026-11-19', endsOn: '2026-12-02' },
    { id: 'c', startsOn: '2026-12-03', endsOn: '2026-12-16' },
    { id: 'd', startsOn: '2026-12-17', endsOn: '2026-12-30' },
  ]
  const today = '2026-11-27'

  it('Should list started sprints newest first, optionally within the plan history', () => {
    expect(startedSprints(sprints, today).map((s) => s.id)).toEqual(['b', 'a'])
    expect(
      startedSprints(sprints, today, '2026-10-29').map((s) => s.id),
    ).toEqual(['b'])
  })

  it('Should find the current and the next sprint', () => {
    expect(currentSprint(sprints, today)?.id).toBe('b')
    expect(upcomingSprint(sprints, today)?.id).toBe('c')
    expect(currentSprint(sprints, '2026-11-01')).toBeUndefined()
  })
})

describe('report period', () => {
  const base = {
    sprint: undefined,
    custom: { from: '2026-11-01', to: '2026-11-10' },
    today: '2026-11-27',
    weekStartsOn: 1,
    oldest: null,
  }

  it('Should use a sprint, a preset or custom dates', () => {
    expect(
      reportRange({
        ...base,
        period: 'sprint:x',
        sprint: { startsOn: '2026-11-19', endsOn: '2026-12-02' },
      }).range,
    ).toEqual({ from: '2026-11-19', to: '2026-12-02' })
    expect(reportRange({ ...base, period: 'this_week' }).range).toEqual({
      from: '2026-11-23',
      to: '2026-11-29',
    })
    expect(reportRange({ ...base, period: 'custom' }).range).toEqual(
      base.custom,
    )
  })

  it('Should clamp to the plan history and say so', () => {
    const result = reportRange({
      ...base,
      period: 'custom',
      oldest: '2026-11-05',
    })
    expect(result).toEqual({
      range: { from: '2026-11-05', to: '2026-11-10' },
      clamped: true,
    })
  })

  it('Should toggle the sort direction or start from the natural one', () => {
    expect(nextSort({ by: 'minutes', dir: 'desc' }, 'minutes')).toEqual({
      by: 'minutes',
      dir: 'asc',
    })
    expect(nextSort({ by: 'minutes', dir: 'desc' }, 'title')).toEqual({
      by: 'title',
      dir: 'asc',
    })
    expect(nextSort({ by: 'title', dir: 'asc' }, 'last')).toEqual({
      by: 'last',
      dir: 'desc',
    })
  })
})

describe('numbers', () => {
  it('Should compute a share and the largest known value', () => {
    expect(percentOf(30, 120)).toBe(25)
    expect(percentOf(5, 0)).toBe(0)
    expect(percentOf(200, 100, true)).toBe(100)
    expect(maxOf([null, 3, undefined, 8])).toBe(8)
    expect(maxOf([null])).toBeNull()
  })
})

describe('day and task timelines', () => {
  const session = (
    id: string,
    start: string | null,
    end: string | null,
    minutes: number,
    extra: Partial<TimeEntry> = {},
  ) =>
    ({
      id,
      workDate: '2026-11-20',
      startTime: start,
      endTime: end,
      durationMinutes: minutes,
      note: null,
      overtimeNote: null,
      extensionNote: null,
      ...extra,
    }) as TimeEntry

  it('Should build an hour-aligned day axis with ticks', () => {
    const axis = timelineAxis({ start: 9 * 60 + 20, end: 17 * 60 + 10 })
    expect(axis.from).toBe(540)
    expect(axis.to).toBe(1080)
    expect(axis.ticks).toEqual([540, 660, 780, 900, 1020])
    expect(axis.x(810)).toBe(50)
    expect(axis.at(0.5)).toBe(810)
    const blocks = [
      { start: 540, end: 600 },
      { start: 660, end: 720 },
    ]
    expect(blockIndexAt(blocks, 690)).toBe(1)
    expect(blockIndexAt(blocks, 630)).toBe(-1)
  })

  it('Should place task sessions and other work on the day line', () => {
    const own = [
      session('a', '09:00', '10:00', 60),
      session('b', null, null, 15),
    ]
    const all = [...own, session('c', '10:00', '10:30', 30)]
    const line = taskDayTimeline('2026-11-20', own, all)
    expect(line.segments.map((s) => [s.entry.id, s.own])).toEqual([
      ['a', true],
      ['c', false],
    ])
    expect(line.untimedMinutes).toBe(15)
    expect(line.place({ start: 540, end: 585 })).toEqual({ left: 0, width: 50 })
  })

  it('Should list notes, overtime and extension reasons in order', () => {
    const notes = taskNotes([
      session('a', '09:00', '10:00', 60, {
        note: 'Done',
        overtimeNote: 'Release',
      }),
      session('b', null, null, 15, { extensionNote: 'Tests' }),
    ])
    expect(notes.map((x) => [x.entryId, x.kind])).toEqual([
      ['a', 'note'],
      ['a', 'overtime'],
      ['b', 'extension'],
    ])
  })
})
