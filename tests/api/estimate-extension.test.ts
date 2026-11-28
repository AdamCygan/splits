import { describe, expect, it } from 'vitest'
import { todayIn } from '../../src/shared/domain/dates'
import { registered } from './helpers'

interface Entry {
  id: string
  title: string
  durationMinutes: number
  endTime: string | null
  estimateMinutes: number | null
  extensionMinutes: number | null
  extensionNote: string | null
}
interface Problem {
  errors?: Record<string, unknown>
}

async function setup() {
  const { apiClient } = await registered()
  const types =
    await apiClient.get<Array<{ id: string; kind: string }>>('/task-types')
  const today = todayIn('Europe/Warsaw')
  const base = {
    projectId: null,
    link: null,
    storyPoints: null,
    workDate: today,
    note: null,
    running: false,
  }
  return {
    apiClient,
    task: types.body.find((taskType) => taskType.kind === 'task')!.id,
    meeting: types.body.find((taskType) => taskType.kind === 'meeting')!.id,
    base,
  }
}

describe('meeting that ran over', () => {
  it('Should store the extra time with a reason and validate it', async () => {
    const { apiClient, meeting, base } = await setup()
    const planned = {
      ...base,
      taskTypeId: meeting,
      title: 'Sprint planning',
      startTime: '10:00',
      endTime: '11:00',
      durationMinutes: 60,
    }
    const created = await apiClient.post<Entry>('/time-entries', planned)
    expect(created.body).toMatchObject({
      extensionMinutes: null,
      extensionNote: null,
    })

    const extended = await apiClient.put<Entry>(
      `/time-entries/${created.body.id}`,
      {
        ...planned,
        endTime: '11:20',
        durationMinutes: 80,
        extensionMinutes: 20,
        extensionNote: '  Scope of the refund epic was unclear.  ',
      },
    )
    expect(extended.status).toBe(200)
    expect(extended.body).toMatchObject({
      durationMinutes: 80,
      extensionMinutes: 20,
      extensionNote: 'Scope of the refund epic was unclear.',
    })

    const noReason = await apiClient.put<Problem>(
      `/time-entries/${created.body.id}`,
      {
        ...planned,
        endTime: '11:20',
        durationMinutes: 80,
        extensionMinutes: 20,
        extensionNote: ' ',
      },
    )
    expect(noReason.status).toBe(400)
    expect(Object.keys(noReason.body.errors ?? {})).toContain('extensionNote')

    const tooLong = await apiClient.put<Problem>(
      `/time-entries/${created.body.id}`,
      {
        ...planned,
        extensionMinutes: 90,
        extensionNote: 'x',
      },
    )
    expect(tooLong.status).toBe(400)
    expect(Object.keys(tooLong.body.errors ?? {})).toContain('extension')
  })
})

describe('task estimate', () => {
  it('Should be saved with the entry, set for the whole task and kept on resume', async () => {
    const { apiClient, task, base } = await setup()
    const entry = {
      ...base,
      taskTypeId: task,
      title: 'PAY-77 Export',
      link: 'https://acme.atlassian.net/browse/PAY-77',
      storyPoints: 3,
      startTime: null,
      endTime: null,
      durationMinutes: 90,
    }
    // Starszy klient bez pola: brak estymaty.
    const legacy = await apiClient.post<Entry>('/time-entries', entry)
    expect(legacy.body.estimateMinutes).toBeNull()
    const second = await apiClient.post<Entry>('/time-entries', {
      ...entry,
      durationMinutes: 30,
      estimateMinutes: 240,
    })
    expect(second.body.estimateMinutes).toBe(240)

    const updated = await apiClient.put<Array<Entry>>('/time-entries/task', {
      ref: { taskTypeId: task, title: entry.title, link: entry.link },
      title: entry.title,
      link: entry.link,
      projectId: null,
      storyPoints: 3,
      estimateMinutes: 180,
    })
    expect(
      updated.body.map((listedEntry) => listedEntry.estimateMinutes),
    ).toEqual([180, 180])

    // Bez pola estymaty edycja zadania jej nie rusza (starsze klienty).
    const kept = await apiClient.put<Array<Entry>>('/time-entries/task', {
      ref: { taskTypeId: task, title: entry.title, link: entry.link },
      title: entry.title,
      link: entry.link,
      projectId: null,
      storyPoints: 3,
    })
    expect(kept.body.map((listedEntry) => listedEntry.estimateMinutes)).toEqual(
      [180, 180],
    )

    const resumed = await apiClient.post<{ started: Entry }>(
      `/time-entries/${second.body.id}/resume`,
    )
    expect(resumed.body.started.estimateMinutes).toBe(180)

    const bad = await apiClient.post<Problem>('/time-entries', {
      ...entry,
      estimateMinutes: 0,
    })
    expect(bad.status).toBe(400)
  })
})
