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
  const { c } = await registered()
  const types =
    await c.get<
      Array<{ id: string; kind: string; storyPointsRequirement: string }>
    >('/task-types')
  const task = types.body.find((x) => x.kind === 'task')!
  const meeting = types.body.find((x) => x.kind === 'meeting')!
  const today = todayIn('Europe/Warsaw')
  const log = (
    title: string,
    taskTypeId: string,
    daysAgo: number,
    minutes: number,
  ) =>
    c.post<Entry>('/time-entries', {
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
  return { c, task, meeting, log }
}

describe('unfinished tasks from previous days', () => {
  it('Should list open tasks, and “done” takes them off the list', async () => {
    const { c, task, meeting, log } = await setup()
    expect((await log('Checkout refactor', task.id, 3, 60)).status).toBe(201)
    expect((await log('Checkout refactor', task.id, 1, 30)).status).toBe(201)
    expect((await log('Daily', meeting.id, 1, 15)).status).toBe(201)
    expect((await log('Started today', task.id, 0, 20)).status).toBe(201)

    const list = await c.get<Array<Unfinished>>('/time-entries/unfinished')
    expect(list.status).toBe(200)
    expect(list.body.map((u) => u.entry.title)).toEqual(['Checkout refactor'])
    expect(list.body[0]).toMatchObject({ workedMinutes: 90, sessions: 2 })

    const ref = { taskTypeId: task.id, title: 'Checkout refactor', link: null }
    const done = await c.post<{ updated: number }>(
      '/time-entries/task/finish',
      {
        ref,
        finished: true,
      },
    )
    expect(done.status).toBe(200)
    expect(done.body.updated).toBe(2)
    expect(
      (await c.get<Array<Unfinished>>('/time-entries/unfinished')).body,
    ).toEqual([])

    const back = await c.post('/time-entries/task/finish', {
      ref,
      finished: false,
    })
    expect(back.status).toBe(200)
    expect(
      (await c.get<Array<Unfinished>>('/time-entries/unfinished')).body,
    ).toHaveLength(1)
  })

  it('Should start a new session today and reopen a finished task when continuing', async () => {
    const { c, task, log } = await setup()
    const old = await log('Payments API', task.id, 1, 45)
    const ref = { taskTypeId: task.id, title: 'Payments API', link: null }
    await c.post('/time-entries/task/finish', { ref, finished: true })

    const resumed = await c.post<{
      started: Entry & { running: boolean; workDate: string }
    }>(`/time-entries/${old.body.id}/resume`)
    expect(resumed.status).toBe(201)
    expect(resumed.body.started).toMatchObject({
      running: true,
      finishedAt: null,
      workDate: todayIn('Europe/Warsaw'),
    })
    const sessions = await c.get<Array<Entry>>(
      `/time-entries/by-task?${new URLSearchParams({ taskTypeId: ref.taskTypeId, title: ref.title }).toString()}`,
    )
    expect(sessions.body.every((e) => e.finishedAt === null)).toBe(true)
    // Praca trwa dziś, więc zadanie nie czeka już na liście „do dokończenia”.
    expect(
      (await c.get<Array<Unfinished>>('/time-entries/unfinished')).body,
    ).toEqual([])
  })

  it('Should mark the whole task finished when a paused task is marked “done”', async () => {
    const { c, task } = await setup()
    const started = await c.post<{ started: Entry }>('/time-entries/timer', {
      taskTypeId: task.id,
      projectId: null,
      title: 'Paused one',
      link: null,
      storyPoints: task.storyPointsRequirement === 'required' ? 3 : null,
      workDate: todayIn('Europe/Warsaw'),
      startTime: '00:00',
      note: null,
    })
    expect(started.status).toBe(201)
    await c.post(`/time-entries/${started.body.started.id}/pause`)
    expect(
      (await c.post(`/time-entries/${started.body.started.id}/dismiss`)).status,
    ).toBe(204)
    const paused = await c.get<Array<Entry>>('/time-entries/paused')
    expect(paused.body).toEqual([])
    const sessions = await c.get<Array<Entry>>(
      `/time-entries/by-task?${new URLSearchParams({ taskTypeId: task.id, title: 'Paused one' }).toString()}`,
    )
    expect(sessions.body[0]!.finishedAt).not.toBeNull()
  })

  it('Should reject an unknown task', async () => {
    const { c, task } = await setup()
    const res = await c.post('/time-entries/task/finish', {
      ref: { taskTypeId: task.id, title: 'Nope', link: null },
      finished: true,
    })
    expect(res.status).toBe(404)
  })
})
