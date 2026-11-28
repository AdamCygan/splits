import { describe, expect, it } from 'vitest'
import { addDays, todayIn } from '../../src/shared/domain/dates'
import { registered } from './helpers'

interface Result {
  entry: { id: string; title: string }
  workedMinutes: number
  sessions: number
  finished: boolean
  running: boolean
}

describe('task search', () => {
  it('Should find tasks by title or link, finished ones too, and only your own', async () => {
    const { apiClient } = await registered('en', { pro: true })
    const types =
      await apiClient.get<
        Array<{ id: string; kind: string; storyPointsRequirement: string }>
      >('/task-types')
    const task = types.body.find((taskType) => taskType.kind === 'task')!
    const today = todayIn('Europe/Warsaw')
    const log = (title: string, link: string | null, daysAgo: number) =>
      apiClient.post<{ id: string }>('/time-entries', {
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
    await apiClient.post('/time-entries/task/finish', {
      ref: { taskTypeId: task.id, title: 'Refund ledger', link: null },
      finished: true,
    })

    const byTitle = await apiClient.get<Array<Result>>(
      '/time-entries/search?q=refund',
    )
    expect(byTitle.status).toBe(200)
    expect(byTitle.body).toHaveLength(1)
    expect(byTitle.body[0]).toMatchObject({
      entry: { title: 'Refund ledger' },
      workedMinutes: 90,
      sessions: 2,
      finished: true,
      running: false,
    })
    const byLink = await apiClient.get<Array<Result>>(
      '/time-entries/search?q=PAY-777',
    )
    expect(byLink.body.map((result) => result.entry.title)).toEqual([
      'Checkout copy',
    ])
    expect(
      (await apiClient.get<Array<Result>>('/time-entries/search?q=r')).body,
    ).toEqual([])

    const other = await registered()
    expect(
      (
        await other.apiClient.get<Array<Result>>(
          '/time-entries/search?q=refund',
        )
      ).body,
    ).toEqual([])
  })

  it('Should search notes and every word, ranking title matches first', async () => {
    const { apiClient } = await registered('en', { pro: true })
    const types =
      await apiClient.get<
        Array<{ id: string; kind: string; storyPointsRequirement: string }>
      >('/task-types')
    const task = types.body.find((taskType) => taskType.kind === 'task')!
    const today = todayIn('Europe/Warsaw')
    const log = (title: string, note: string | null, daysAgo: number) =>
      apiClient.post<{ id: string }>('/time-entries', {
        taskTypeId: task.id,
        projectId: null,
        title,
        link: null,
        storyPoints: task.storyPointsRequirement === 'required' ? 3 : null,
        workDate: addDays(today, -daysAgo),
        startTime: null,
        endTime: null,
        durationMinutes: 30,
        note,
        running: false,
      })
    await log('Webhook retry queue', null, 20)
    await log(
      'Payment gateway',
      '- [ ] **Retry** policy for webhook 5xx responses',
      2,
    )
    await log('Payment gateway', null, 1)
    await log('Ledger export', 'Nothing about it', 1)

    type Ranked = Result & { snippet: string | null }
    const response = await apiClient.get<Array<Ranked>>(
      '/time-entries/search/all?q=webhook retry',
    )
    expect(response.status).toBe(200)
    // Tytuł zawierający oba słowa? „Webhook retry queue” ma oba, więc jest pierwszy,
    // mimo że to stara historia; „Payment gateway” trafia przez notatkę z fragmentem.
    expect(response.body.map((result) => result.entry.title)).toEqual([
      'Webhook retry queue',
      'Payment gateway',
    ])
    expect(response.body[1]).toMatchObject({ sessions: 2, workedMinutes: 60 })
    expect(response.body[1]?.snippet).toBe(
      'Retry policy for webhook 5xx responses',
    )
    expect(response.body[0]?.snippet).toBeNull()

    expect(
      (await apiClient.get<Array<Ranked>>('/time-entries/search/all?q=x')).body,
    ).toEqual([])
    const other = await registered()
    expect(
      (
        await other.apiClient.get<Array<Ranked>>(
          '/time-entries/search/all?q=webhook',
        )
      ).body,
    ).toEqual([])
  })
})
