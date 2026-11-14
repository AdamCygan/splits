import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { addDays, todayIn } from '#/domain/dates'
import { db } from '#/server/db/client'
import { users } from '#/server/db/schema'
import { registered } from './helpers'

type Problem = { code: string; errors?: Record<string, unknown> }

async function account() {
  const a = await registered()
  const types = await a.c.get<Array<{ id: string }>>('/task-types')
  const today = todayIn('Europe/Warsaw')
  const entry = (workDate: string, extra: Record<string, unknown> = {}) => ({
    taskTypeId: types.body[0]!.id,
    projectId: null,
    title: `Task ${workDate}`,
    link: null,
    storyPoints: 1,
    workDate,
    startTime: null,
    endTime: null,
    durationMinutes: 45,
    note: null,
    running: false,
    ...extra,
  })
  return { ...a, today, entry }
}

describe('entry dates', () => {
  it('adds a forgotten entry to a past day and lists it on that day', async () => {
    const { c, today, entry } = await account()
    const day = addDays(today, -3)
    const created = await c.post<{ workDate: string }>(
      '/time-entries',
      entry(day),
    )
    expect(created.status).toBe(201)
    expect(created.body.workDate).toBe(day)
    const list = await c.get<Array<{ title: string }>>(
      `/time-entries?date=${day}`,
    )
    expect(list.body.map((e) => e.title)).toEqual([`Task ${day}`])
    expect(
      (await c.get<Array<unknown>>(`/time-entries?date=${today}`)).body,
    ).toEqual([])
  })

  it('rejects entries in the future', async () => {
    const { c, today, entry } = await account()
    const res = await c.post<Problem>('/time-entries', entry(addDays(today, 1)))
    expect(res.status).toBe(400)
    expect(Object.keys(res.body.errors ?? {})).toContain('workDate')
  })

  it('starts a timer only for today', async () => {
    const { c, today, entry } = await account()
    const past = await c.post<Problem>('/time-entries/timer', {
      ...entry(addDays(today, -1)),
      startTime: '09:00',
    })
    expect(past.status).toBe(400)
    expect(Object.keys(past.body.errors ?? {})).toContain('workDate')
  })

  it('limits new entries to the last 30 days on Free, not on Pro', async () => {
    const { c, email, today, entry } = await account()
    const edge = addDays(today, -29)
    const older = addDays(today, -30)
    expect((await c.post('/time-entries', entry(edge))).status).toBe(201)
    const blocked = await c.post<Problem>('/time-entries', entry(older))
    expect(blocked.status).toBe(403)
    expect(blocked.body.code).toBe('plan.limit_history')

    await db
      .update(users)
      .set({ plan: 'pro' })
      .where(sql`lower(${users.email}) = ${email}`)
    expect((await c.post('/time-entries', entry(older))).status).toBe(201)
  })
})
