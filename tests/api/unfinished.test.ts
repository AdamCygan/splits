import { describe, expect, it } from 'vitest'
import { addDays, todayIn } from '../../src/shared/domain/dates'
import { registered } from './helpers'

interface Entry {
  id: string
  title: string
  finishedAt: string | null
}
interface Unfinished {
  entry: Entry
  workedMinutes: number
  sessions: number
  lastDate: string
}

async function setup() {
  const { apiClient } = await registered()
  const types =
    await apiClient.get<
      Array<{ id: string; kind: string; storyPointsRequirement: string }>
    >('/task-types')
  const task = types.body.find((taskType) => taskType.kind === 'task')!
  const meeting = types.body.find((taskType) => taskType.kind === 'meeting')!
  const today = todayIn('Europe/Warsaw')
  const log = (
    title: string,
    taskTypeId: string,
    daysAgo: number,
    minutes: number,
  ) =>
    apiClient.post<Entry>('/time-entries', {
      taskTypeId,
      projectId: null,
      title,
      link: null,
      storyPoints:
        task.storyPointsRequirement === 'required' && taskTypeId === task.id
          ? 3
          : null,
      workDate: addDays(today, -daysAgo),
      startTime: null,
      endTime: null,
      durationMinutes: minutes,
      note: null,
      running: false,
    })
  return { apiClient, task, meeting, log }
}

describe('unfinished tasks from previous days', () => {
  it('Should list open tasks, and “done” takes them off the list', async () => {
    const { apiClient, task, meeting, log } = await setup()
    expect((await log('Checkout refactor', task.id, 3, 60)).status).toBe(201)
    expect((await log('Checkout refactor', task.id, 1, 30)).status).toBe(201)
    expect((await log('Daily', meeting.id, 1, 15)).status).toBe(201)
    expect((await log('Started today', task.id, 0, 20)).status).toBe(201)

    const list = await apiClient.get<Array<Unfinished>>(
      '/time-entries/unfinished',
    )
    expect(list.status).toBe(200)
    expect(list.body.map((unfinished) => unfinished.entry.title)).toEqual([
      'Checkout refactor',
    ])
    expect(list.body[0]).toMatchObject({ workedMinutes: 90, sessions: 2 })

    const ref = { taskTypeId: task.id, title: 'Checkout refactor', link: null }
    const done = await apiClient.post<{ updated: number }>(
      '/time-entries/task/finish',
      {
        ref,
        finished: true,
      },
    )
    expect(done.status).toBe(200)
    expect(done.body.updated).toBe(2)
    expect(
      (await apiClient.get<Array<Unfinished>>('/time-entries/unfinished')).body,
    ).toEqual([])

    const back = await apiClient.post('/time-entries/task/finish', {
      ref,
      finished: false,
    })
    expect(back.status).toBe(200)
    expect(
      (await apiClient.get<Array<Unfinished>>('/time-entries/unfinished')).body,
    ).toHaveLength(1)
  })

  it('Should start a new session today and reopen a finished task when continuing', async () => {
    const { apiClient, task, log } = await setup()
    const old = await log('Payments API', task.id, 1, 45)
    const ref = { taskTypeId: task.id, title: 'Payments API', link: null }
    await apiClient.post('/time-entries/task/finish', { ref, finished: true })

    const resumed = await apiClient.post<{
      started: Entry & { running: boolean; workDate: string }
    }>(`/time-entries/${old.body.id}/resume`)
    expect(resumed.status).toBe(201)
    expect(resumed.body.started).toMatchObject({
      running: true,
      finishedAt: null,
      workDate: todayIn('Europe/Warsaw'),
    })
    const sessions = await apiClient.get<Array<Entry>>(
      `/time-entries/by-task?${new URLSearchParams({ taskTypeId: ref.taskTypeId, title: ref.title }).toString()}`,
    )
    expect(sessions.body.every((entry) => entry.finishedAt === null)).toBe(true)
    // Praca trwa dziś, więc zadanie nie czeka już na liście „do dokończenia”.
    expect(
      (await apiClient.get<Array<Unfinished>>('/time-entries/unfinished')).body,
    ).toEqual([])
  })

  it('Should mark the whole task finished when a paused task is marked “done”', async () => {
    const { apiClient, task } = await setup()
    const started = await apiClient.post<{ started: Entry }>(
      '/time-entries/timer',
      {
        taskTypeId: task.id,
        projectId: null,
        title: 'Paused one',
        link: null,
        storyPoints: task.storyPointsRequirement === 'required' ? 3 : null,
        workDate: todayIn('Europe/Warsaw'),
        startTime: '00:00',
        note: null,
      },
    )
    expect(started.status).toBe(201)
    await apiClient.post(`/time-entries/${started.body.started.id}/pause`)
    expect(
      (await apiClient.post(`/time-entries/${started.body.started.id}/dismiss`))
        .status,
    ).toBe(204)
    const paused = await apiClient.get<Array<Entry>>('/time-entries/paused')
    expect(paused.body).toEqual([])
    const sessions = await apiClient.get<Array<Entry>>(
      `/time-entries/by-task?${new URLSearchParams({ taskTypeId: task.id, title: 'Paused one' }).toString()}`,
    )
    expect(sessions.body[0]!.finishedAt).not.toBeNull()
  })

  it('Should reject an unknown task', async () => {
    const { apiClient, task } = await setup()
    const response = await apiClient.post('/time-entries/task/finish', {
      ref: { taskTypeId: task.id, title: 'Nope', link: null },
      finished: true,
    })
    expect(response.status).toBe(404)
  })
})
