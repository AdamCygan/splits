import { describe, expect, it } from 'vitest'
import { addDays, todayIn } from '#/domain/dates'
import { registered } from './helpers'

type Entry = {
  id: string
  title: string
  link: string | null
  projectId: string | null
  storyPoints: number | null
  durationMinutes: number
}
type Problem = { code: string; errors?: Record<string, unknown> }

async function task() {
  const { c } = await registered()
  const types =
    await c.get<Array<{ id: string; storyPointsRequirement: string }>>(
      '/task-types',
    )
  const type = types.body.find((x) => x.storyPointsRequirement !== 'hidden')!
  const project = await c.post<{ id: string }>('/projects', {
    name: 'Payments',
    key: 'PAY',
    color: '#3D3BF3',
  })
  const today = todayIn('Europe/Warsaw')
  const link = 'https://acme.atlassian.net/browse/PAY-9'
  for (const [workDate, minutes] of [
    [addDays(today, -1), 90],
    [today, 30],
  ] as const) {
    const res = await c.post('/time-entries', {
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
    })
    expect(res.status).toBe(201)
  }
  const ref = { taskTypeId: type.id, title: 'PAY-9 Old name', link }
  return { c, ref, projectId: project.body.id }
}

describe('task edit from the report', () => {
  it('changes title, link, project and SP in every session at once', async () => {
    const { c, ref, projectId } = await task()
    const newLink = 'https://acme.atlassian.net/browse/PAY-10'
    const res = await c.put<Array<Entry>>('/time-entries/task', {
      ref,
      title: 'PAY-10 New name',
      link: newLink,
      projectId,
      storyPoints: 3,
    })
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    for (const e of res.body)
      expect(e).toMatchObject({
        title: 'PAY-10 New name',
        link: newLink,
        projectId,
        storyPoints: 3,
      })
    // Czas sesji się nie zmienia, a stary „adres” zadania nie ma już wpisów.
    expect(res.body.map((e) => e.durationMinutes)).toEqual([90, 30])
    const old = await c.get<Array<Entry>>(
      `/time-entries/by-task?${new URLSearchParams(ref).toString()}`,
    )
    expect(old.body).toEqual([])
  })

  it('validates the change and leaves the task untouched on error', async () => {
    const { c, ref } = await task()
    const bad = await c.put<Problem>('/time-entries/task', {
      ref,
      title: '   ',
      link: ref.link,
      projectId: null,
      storyPoints: 2,
    })
    expect(bad.status).toBe(400)
    expect(Object.keys(bad.body.errors ?? {})).toContain('title')
    const still = await c.get<Array<Entry>>(
      `/time-entries/by-task?${new URLSearchParams(ref).toString()}`,
    )
    expect(still.body.map((e) => e.title)).toEqual([ref.title, ref.title])
  })

  it('touches only the caller’s own entries', async () => {
    const { ref } = await task()
    const { c: other } = await registered()
    const res = await other.put('/time-entries/task', {
      ref,
      title: 'Hijacked',
      link: null,
      projectId: null,
      storyPoints: null,
    })
    expect(res.status).toBe(404)
  })
})

describe('task delete', () => {
  it('deletes a task from one day or from every day', async () => {
    const { c, ref } = await task()
    const today = todayIn('Europe/Warsaw')
    const day = await c.post<{ deleted: number }>('/time-entries/task/delete', {
      ref,
      date: today,
    })
    expect(day.body).toEqual({ deleted: 1 })
    const left = await c.get<Array<Entry>>(
      `/time-entries/by-task?${new URLSearchParams(ref).toString()}`,
    )
    expect(left.body).toHaveLength(1)

    const { c: other } = await registered()
    expect(
      (await other.post('/time-entries/task/delete', { ref, date: null }))
        .status,
    ).toBe(404)

    const all = await c.post<{ deleted: number }>('/time-entries/task/delete', {
      ref,
      date: null,
    })
    expect(all.body).toEqual({ deleted: 1 })
    expect(
      (await c.post('/time-entries/task/delete', { ref, date: null })).status,
    ).toBe(404)
  })
})
