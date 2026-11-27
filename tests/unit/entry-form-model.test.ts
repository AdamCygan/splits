import { describe, expect, it } from 'vitest'
import type { TaskType } from '../../src/features/task-types/data/dto'
import type { TimeEntry } from '../../src/features/time-entries/data/dto'
import {
  afterSave,
  copyDraft,
  draftMinutes,
  initialDraft,
  scaleWithValue,
  timeModesFor,
  toInput,
  toTimerInput,
  withMode,
  withPrefill,
  withQuickLog,
  withType,
} from '../../src/features/time-entries/domain/entry-form'

const type = (patch: Partial<TaskType> = {}): TaskType => ({
  id: 'task',
  kind: 'task',
  name: 'Task',
  color: '#4040ff',
  isSystem: true,
  titleLabel: 'Title',
  linkRequirement: 'optional',
  linkLabel: '',
  descriptionRequirement: 'optional',
  storyPointsRequirement: 'required',
  defaultStoryPoints: 3,
  defaultTimeInput: 'range',
  countsAsFocusWork: true,
  sortOrder: 0,
  archivedAt: null,
  ...patch,
})
const meeting = type({
  id: 'meeting',
  kind: 'meeting',
  storyPointsRequirement: 'hidden',
  defaultStoryPoints: null,
  defaultTimeInput: 'duration',
})

const entry = (patch: Partial<TimeEntry> = {}): TimeEntry => ({
  id: 'e1',
  finishedAt: null,
  taskTypeId: 'task',
  projectId: 'p1',
  title: 'PAY-142 Payment gateway',
  link: 'https://acme.atlassian.net/browse/PAY-142',
  storyPoints: 5,
  workDate: '2026-11-26',
  startTime: '09:00',
  endTime: '10:30',
  durationMinutes: 90,
  note: 'Retry logic',
  overtimeMinutes: 30,
  overtimeNote: 'Release',
  estimateMinutes: 240,
  extensionMinutes: null,
  extensionNote: null,
  running: false,
  paused: false,
  startedAt: null,
  createdAt: '2026-11-26T10:30:00.000Z',
  ...patch,
})

describe('entry form model', () => {
  it('Should start a new draft from the work type and the current time', () => {
    const d = initialDraft(null, type(), 10 * 60 + 5)
    expect(d).toMatchObject({
      taskTypeId: 'task',
      mode: 'range',
      start: '09:35',
      end: '10:05',
      storyPoints: '3',
    })
    expect(initialDraft(null, meeting, 600)).toMatchObject({
      mode: 'duration',
      storyPoints: '',
    })
  })

  it('Should edit an entry as it was saved', () => {
    const d = initialDraft(entry(), undefined)
    expect(d).toMatchObject({
      mode: 'range',
      start: '09:00',
      end: '10:30',
      storyPoints: '5',
      overtime: true,
      overtimeDuration: '30',
      estimate: '240',
    })
    expect(draftMinutes(d)).toBe(90)
  })

  it('Should copy an entry into the next slot without overtime', () => {
    const d = copyDraft(entry())
    expect(d).toMatchObject({
      mode: 'range',
      start: '10:30',
      end: '12:00',
      overtime: false,
      note: 'Retry logic',
    })
    expect(copyDraft(entry({ startTime: null, endTime: null })).mode).toBe(
      'duration',
    )
  })

  it('Should turn a draft into API input and a timer start', () => {
    const d = {
      ...initialDraft(null, type(), 600),
      title: '  Fix  ',
      duration: '1h 15m',
      mode: 'duration' as const,
    }
    const input = toInput(d, '2026-11-26', 'required')
    expect(input).toMatchObject({
      title: 'Fix',
      startTime: null,
      endTime: null,
      durationMinutes: 75,
      storyPoints: 3,
      running: false,
    })
    expect(toInput(d, '2026-11-26', 'hidden').storyPoints).toBeNull()
    const timer = toTimerInput(
      toInput(
        { ...d, mode: 'timer', start: '08:00' },
        '2026-11-26',
        'required',
      ),
    )
    expect(timer).toMatchObject({ startTime: '08:00', title: 'Fix' })
    expect(timer).not.toHaveProperty('durationMinutes')
  })

  it('Should switch type, mode and quick logs', () => {
    const d = initialDraft(null, type(), 600)
    expect(withType(d, meeting, false)).toMatchObject({
      taskTypeId: 'meeting',
      mode: 'duration',
      storyPoints: '',
    })
    // Edycja zostawia SP wpisu.
    expect(withType(d, meeting, true).storyPoints).toBe('3')
    // Z godzin na czas trwania: policzone minuty przechodzą do pola.
    expect(withMode(d, 'duration', { now: '10:00' }).duration).toBe('30')
    expect(withMode(d, 'timer', { now: '10:02' }).start).toBe('10:02')
    expect(
      withQuickLog(d, meeting, 45, { now: '10:00', editing: false }),
    ).toMatchObject({ taskTypeId: 'meeting', mode: 'duration', duration: '45' })
    expect(
      withQuickLog(d, type(), 'timer', { now: '10:07', editing: false }),
    ).toMatchObject({ mode: 'timer', start: '10:07' })
  })

  it('Should take a task from search, or a title and mode from the palette', () => {
    const d = initialDraft(null, type(), 600)
    expect(
      withPrefill(
        d,
        { key: 1, entry: entry() },
        { timerAllowed: true, now: '10:00' },
      ),
    ).toMatchObject({
      title: 'PAY-142 Payment gateway',
      link: 'https://acme.atlassian.net/browse/PAY-142',
      projectId: 'p1',
      estimate: '240',
      // czas zostaje z formularza
      start: d.start,
    })
    expect(
      withPrefill(
        d,
        { key: 2, title: 'Docs', mode: 'timer' },
        { timerAllowed: false, now: '10:00' },
      ),
    ).toMatchObject({ title: 'Docs', mode: 'duration' })
  })

  it('Should continue where the saved entry ended', () => {
    const d = {
      ...initialDraft(null, type(), 600),
      start: '09:00',
      end: '10:00',
    }
    expect(afterSave(d, type())).toMatchObject({
      start: '10:00',
      end: '10:30',
      title: '',
    })
  })

  it('Should offer time modes and keep an outdated SP value selectable', () => {
    expect(timeModesFor(null, true)).toEqual(['range', 'duration', 'timer'])
    expect(timeModesFor(null, false)).toEqual(['range', 'duration'])
    expect(timeModesFor(entry({ running: true }), false)).toEqual([
      'timer',
      'range',
    ])
    const scale = [
      { id: 'a', points: 1, maxMinutes: 60 },
      { id: 'b', points: 3, maxMinutes: 240 },
    ]
    expect(scaleWithValue(scale, 2).map((s) => s.points)).toEqual([1, 2, 3])
    expect(scaleWithValue(scale, 3)).toHaveLength(2)
  })
})
