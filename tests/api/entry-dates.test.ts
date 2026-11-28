import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { addDays, todayIn } from '../../src/shared/domain/dates'
import { FREE_LIMITS } from '../../src/features/billing/domain/plans'
import { database } from '#/server/db/client'
import { users } from '#/server/db/schema'
import { registered } from './helpers'

interface Problem {
  code: string
  errors?: Record<string, unknown>
}

async function account() {
  const registeredAccount = await registered()
  const types =
    await registeredAccount.apiClient.get<Array<{ id: string }>>('/task-types')
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
  return { ...registeredAccount, today, entry }
}

describe('entry dates', () => {
  it('Should add a forgotten entry to a past day and list it on that day', async () => {
    const { apiClient, today, entry } = await account()
    const day = addDays(today, -3)
    const created = await apiClient.post<{ workDate: string }>(
      '/time-entries',
      entry(day),
    )
    expect(created.status).toBe(201)
    expect(created.body.workDate).toBe(day)
    const list = await apiClient.get<Array<{ title: string }>>(
      `/time-entries?date=${day}`,
    )
    expect(list.body.map((listedEntry) => listedEntry.title)).toEqual([
      `Task ${day}`,
    ])
    expect(
      (await apiClient.get<Array<unknown>>(`/time-entries?date=${today}`)).body,
    ).toEqual([])
  })

  it('Should reject entries in the future', async () => {
    const { apiClient, today, entry } = await account()
    const response = await apiClient.post<Problem>(
      '/time-entries',
      entry(addDays(today, 1)),
    )
    expect(response.status).toBe(400)
    expect(Object.keys(response.body.errors ?? {})).toContain('workDate')
  })

  it('Should start a timer only for today', async () => {
    const { apiClient, today, entry } = await account()
    const past = await apiClient.post<Problem>('/time-entries/timer', {
      ...entry(addDays(today, -1)),
      // Północ nigdy nie jest „w przyszłości”, więc test nie zależy od pory dnia.
      startTime: '00:00',
    })
    expect(past.status).toBe(400)
    expect(Object.keys(past.body.errors ?? {})).toContain('workDate')
  })

  it('Should limit new entries to the last 7 days on Free, not on Pro', async () => {
    const { apiClient, email, today, entry } = await account()
    const edge = addDays(today, -(FREE_LIMITS.historyDays - 1))
    const older = addDays(today, -FREE_LIMITS.historyDays)
    expect((await apiClient.post('/time-entries', entry(edge))).status).toBe(
      201,
    )
    const blocked = await apiClient.post<Problem>('/time-entries', entry(older))
    expect(blocked.status).toBe(403)
    expect(blocked.body.code).toBe('plan.limit_history')

    await database
      .update(users)
      .set({ plan: 'pro' })
      .where(sql`lower(${users.email}) = ${email}`)
    expect((await apiClient.post('/time-entries', entry(older))).status).toBe(
      201,
    )
  })
})
