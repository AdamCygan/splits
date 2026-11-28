import { describe, expect, it } from 'vitest'
import { addDays, todayIn } from '../../src/shared/domain/dates'
import { inSequence, registered } from './helpers'

interface Entry {
  id: string
  title: string
  link: string | null
  projectId: string | null
  storyPoints: number | null
  durationMinutes: number
}
interface Problem {
  code: string
  errors?: Record<string, unknown>
}

async function task() {
  const { apiClient } = await registered()
  const types =
    await apiClient.get<Array<{ id: string; storyPointsRequirement: string }>>(
      '/task-types',
    )
  const type = types.body.find(
    (taskType) => taskType.storyPointsRequirement !== 'hidden',
  )!
  const project = await apiClient.post<{ id: string }>('/projects', {
    name: 'Payments',
    key: 'PAY',
    color: '#3D3BF3',
  })
  const today = todayIn('Europe/Warsaw')
  const link = 'https://acme.atlassian.net/browse/PAY-9'
  const sessions = [
    [addDays(today, -1), 90],
    [today, 30],
  ] as const
  const created = await inSequence(sessions, ([workDate, minutes]) =>
    apiClient.post('/time-entries', {
      taskTypeId: type.id,
      projectId: null,
      title: 'PAY-9 Old name',
      link,
      storyPoints: 2,
      workDate,
      startTime: null,
      endTime: null,
      durationMinutes: minutes,
      note: null,
      running: false,
    }),
  )
  expect(created.map((response) => response.status)).toEqual([201, 201])
  const ref = { taskTypeId: type.id, title: 'PAY-9 Old name', link }
  return { apiClient, ref, projectId: project.body.id }
}

describe('task edit from the report', () => {
  it('Should change title, link, project and SP in every session at once', async () => {
    const { apiClient, ref, projectId } = await task()
    const newLink = 'https://acme.atlassian.net/browse/PAY-10'
    const response = await apiClient.put<Array<Entry>>('/time-entries/task', {
      ref,
      title: 'PAY-10 New name',
      link: newLink,
      projectId,
      storyPoints: 3,
    })
    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(2)
    const renamed = expect.objectContaining({
      title: 'PAY-10 New name',
      link: newLink,
      projectId,
      storyPoints: 3,
    })
    expect(response.body).toEqual([renamed, renamed])
    // Czas sesji się nie zmienia, a stary „adres” zadania nie ma już wpisów.
    expect(response.body.map((entry) => entry.durationMinutes)).toEqual([
      90, 30,
    ])
    const old = await apiClient.get<Array<Entry>>(
      `/time-entries/by-task?${new URLSearchParams(ref).toString()}`,
    )
    expect(old.body).toEqual([])
  })

  it('Should validate the change and leave the task untouched on error', async () => {
    const { apiClient, ref } = await task()
    const bad = await apiClient.put<Problem>('/time-entries/task', {
      ref,
      title: '   ',
      link: ref.link,
      projectId: null,
      storyPoints: 2,
    })
    expect(bad.status).toBe(400)
    expect(Object.keys(bad.body.errors ?? {})).toContain('title')
    const still = await apiClient.get<Array<Entry>>(
      `/time-entries/by-task?${new URLSearchParams(ref).toString()}`,
    )
    expect(still.body.map((entry) => entry.title)).toEqual([
      ref.title,
      ref.title,
    ])
  })

  it('Should touch only the caller’s own entries', async () => {
    const { ref } = await task()
    const { apiClient: other } = await registered()
    const response = await other.put('/time-entries/task', {
      ref,
      title: 'Hijacked',
      link: null,
      projectId: null,
      storyPoints: null,
    })
    expect(response.status).toBe(404)
  })
})

describe('task delete', () => {
  it('Should delete a task from one day or from every day', async () => {
    const { apiClient, ref } = await task()
    const today = todayIn('Europe/Warsaw')
    const day = await apiClient.post<{ deleted: number }>(
      '/time-entries/task/delete',
      {
        ref,
        date: today,
      },
    )
    expect(day.body).toEqual({ deleted: 1 })
    const left = await apiClient.get<Array<Entry>>(
      `/time-entries/by-task?${new URLSearchParams(ref).toString()}`,
    )
    expect(left.body).toHaveLength(1)

    const { apiClient: other } = await registered()
    expect(
      (await other.post('/time-entries/task/delete', { ref, date: null }))
        .status,
    ).toBe(404)

    const all = await apiClient.post<{ deleted: number }>(
      '/time-entries/task/delete',
      {
        ref,
        date: null,
      },
    )
    expect(all.body).toEqual({ deleted: 1 })
    expect(
      (await apiClient.post('/time-entries/task/delete', { ref, date: null }))
        .status,
    ).toBe(404)
  })
})
