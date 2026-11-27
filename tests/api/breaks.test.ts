import { describe, expect, it } from 'vitest'
import { addDays, todayIn } from '#/domain/dates'
import { registered } from './helpers'

interface Break {
  id: string
  workDate: string
  startTime: string | null
  endTime: string | null
  durationMinutes: number
  running: boolean
  resumeEntryId: string | null
}
interface Entry {
  id: string
  title: string
  running: boolean
  paused: boolean
}

async function withTimer() {
  const a = await registered()
  const types =
    await a.c.get<Array<{ id: string; kind: string }>>('/task-types')
  const timer = await a.c.post<{ started: Entry }>('/time-entries/timer', {
    taskTypeId: types.body.find((x) => x.kind === 'meeting')!.id,
    projectId: null,
    title: 'Focus block',
    link: null,
    storyPoints: null,
    workDate: todayIn('Europe/Warsaw'),
    startTime: '00:00',
    endTime: null,
    durationMinutes: 0,
    note: null,
    running: true,
  })
  expect(timer.status).toBe(201)
  return { ...a, entry: timer.body.started }
}

describe('breaks', () => {
  it('Should pause the running task and resume it when the break ends', async () => {
    const { c, entry } = await withTimer()
    const started = await c.post<{ break: Break; paused: Entry | null }>(
      '/breaks/start',
    )
    expect(started.status).toBe(201)
    expect(started.body.break).toMatchObject({
      running: true,
      resumeEntryId: entry.id,
    })
    expect(started.body.paused).toMatchObject({ id: entry.id, running: false })
    expect((await c.get<Entry | null>('/time-entries/running')).body).toBeNull()
    expect((await c.get<Break | null>('/breaks/running')).body?.id).toBe(
      started.body.break.id,
    )

    // Druga przerwa naraz nie ruszy.
    const twice = await c.post<{ code: string }>('/breaks/start')
    expect(twice.status).toBe(409)
    expect(twice.body.code).toBe('break.running')

    const ended = await c.post<{ break: Break; resumed: Entry | null }>(
      `/breaks/${started.body.break.id}/end`,
      { resume: true },
    )
    expect(ended.status).toBe(200)
    expect(ended.body.break).toMatchObject({
      running: false,
      durationMinutes: 1,
    })
    expect(ended.body.break.endTime).not.toBeNull()
    expect(ended.body.resumed).toMatchObject({
      title: 'Focus block',
      running: true,
    })
    expect((await c.get<Break | null>('/breaks/running')).body).toBeNull()
  })

  it('Should end a break without resuming the task', async () => {
    const { c } = await withTimer()
    const started = await c.post<{ break: Break }>('/breaks/start')
    const ended = await c.post<{ resumed: Entry | null }>(
      `/breaks/${started.body.break.id}/end`,
      { resume: false },
    )
    expect(ended.body.resumed).toBeNull()
    expect((await c.get<Entry | null>('/time-entries/running')).body).toBeNull()
  })

  it('Should add a forgotten break, list the day and delete it', async () => {
    const { c } = await registered()
    const today = todayIn('Europe/Warsaw')
    const byTimes = await c.post<Break>('/breaks', {
      workDate: today,
      startTime: '12:00',
      endTime: '12:25',
      durationMinutes: 1,
    })
    expect(byTimes.status).toBe(201)
    expect(byTimes.body.durationMinutes).toBe(25)
    const byDuration = await c.post<Break>('/breaks', {
      workDate: today,
      startTime: null,
      endTime: null,
      durationMinutes: 10,
    })
    expect(byDuration.body.durationMinutes).toBe(10)

    const day = await c.get<Array<Break>>(`/breaks?date=${today}`)
    expect(day.body.map((b) => b.durationMinutes)).toEqual([25, 10])

    const backwards = await c.post('/breaks', {
      workDate: today,
      startTime: '13:00',
      endTime: '12:00',
      durationMinutes: 1,
    })
    expect(backwards.status).toBe(400)
    const future = await c.post('/breaks', {
      workDate: addDays(today, 1),
      startTime: null,
      endTime: null,
      durationMinutes: 10,
    })
    expect(future.status).toBe(400)

    const { c: other } = await registered()
    expect((await other.del(`/breaks/${byDuration.body.id}`)).status).toBe(404)
    expect((await c.del(`/breaks/${byDuration.body.id}`)).status).toBe(204)
    expect(
      (await c.get<Array<Break>>(`/breaks?date=${today}`)).body,
    ).toHaveLength(1)
  })

  it('Should keep the daily break limit in the settings', async () => {
    const { c } = await registered()
    const settings = await c.get<Record<string, unknown>>('/settings')
    expect(settings.body.breakMinutes).toBe(30)
    const saved = await c.put<Record<string, unknown>>('/settings', {
      ...settings.body,
      breakMinutes: 45,
    })
    expect(saved.body.breakMinutes).toBe(45)
    // Starszy klient bez pola: wraca domyślne 30, zamiast błędu.
    const { breakMinutes: _ignored, ...legacy } = saved.body
    const old = await c.put<Record<string, unknown>>('/settings', legacy)
    expect(old.status).toBe(200)
    const tooMuch = await c.put('/settings', {
      ...settings.body,
      breakMinutes: 600,
    })
    expect(tooMuch.status).toBe(400)
  })
})
