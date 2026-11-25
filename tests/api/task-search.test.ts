import { describe, expect, it } from 'vitest'
import { addDays, todayIn } from '#/domain/dates'
import { registered } from './helpers'

type Result = {
  entry: { id: string; title: string }
  workedMinutes: number
  sessions: number
  finished: boolean
  running: boolean
}

describe('task search', () => {
  it('finds tasks by title or link, finished ones too, and only your own', async () => {
    const { c } = await registered()
    const types =
      await c.get<
        Array<{ id: string; kind: string; storyPointsRequirement: string }>
      >('/task-types')
    const task = types.body.find((x) => x.kind === 'task')!
    const today = todayIn('Europe/Warsaw')
    const log = (title: string, link: string | null, daysAgo: number) =>
      c.post<{ id: string }>('/time-entries', {
        taskTypeId: task.id,
        projectId: null,
        title,
        link,
        storyPoints: task.storyPointsRequirement === 'required' ? 3 : null,
        workDate: addDays(today, -daysAgo),
        startTime: null,
        endTime: null,
        durationMinutes: 45,
        note: null,
        running: false,
      })
    await log('Refund ledger', null, 20)
    await log('Refund ledger', null, 18)
    await log('Checkout copy', 'https://acme.atlassian.net/browse/PAY-777', 3)
    await c.post('/time-entries/task/finish', {
      ref: { taskTypeId: task.id, title: 'Refund ledger', link: null },
      finished: true,
    })

    const byTitle = await c.get<Array<Result>>('/time-entries/search?q=refund')
    expect(byTitle.status).toBe(200)
    expect(byTitle.body).toHaveLength(1)
    expect(byTitle.body[0]).toMatchObject({
      entry: { title: 'Refund ledger' },
      workedMinutes: 90,
      sessions: 2,
      finished: true,
      running: false,
    })
    const byLink = await c.get<Array<Result>>('/time-entries/search?q=PAY-777')
    expect(byLink.body.map((r) => r.entry.title)).toEqual(['Checkout copy'])
    expect(
      (await c.get<Array<Result>>('/time-entries/search?q=r')).body,
    ).toEqual([])

    const other = await registered()
    expect(
      (await other.c.get<Array<Result>>('/time-entries/search?q=refund')).body,
    ).toEqual([])
  })
})
