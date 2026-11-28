import { describe, expect, it } from 'vitest'
import { todayIn } from '../../src/shared/domain/dates'
import { registered } from './helpers'

interface Entry {
  id: string
  note: string | null
  title: string
}

async function setup() {
  const { apiClient } = await registered()
  const types = await apiClient.get<
    Array<{
      id: string
      kind: string
      storyPointsRequirement: string
      descriptionRequirement: string
    }>
  >('/task-types')
  const task = types.body.find((taskType) => taskType.kind === 'task')!
  const add = (note: string | null) =>
    apiClient.post<Entry>('/time-entries', {
      taskTypeId: task.id,
      projectId: null,
      title: 'Notes task',
      link: null,
      storyPoints: task.storyPointsRequirement === 'required' ? 2 : null,
      workDate: todayIn('Europe/Warsaw'),
      startTime: null,
      endTime: null,
      durationMinutes: 30,
      note,
      running: false,
    })
  return { apiClient, task, add }
}

describe('markdown notes', () => {
  it('Should keep long markdown notes exactly as written', async () => {
    const { add } = await setup()
    const note =
      '## Done\n- [x] **tests**\n- [ ] _review_\n\n```ts\nconst a = 1\n```\n' +
      'x'.repeat(15_000)
    const response = await add(note)
    expect(response.status).toBe(201)
    expect(response.body.note).toBe(note)
  })

  it('Should still reject notes over the limit', async () => {
    const { add } = await setup()
    const response = await add('x'.repeat(20_001))
    expect(response.status).toBe(400)
  })

  it('Should update only the note (ticking a checkbox on the list)', async () => {
    const { apiClient, add } = await setup()
    const created = await add('- [ ] tests\n- [ ] review')
    const response = await apiClient.patch<Entry>(
      `/time-entries/${created.body.id}/note`,
      {
        note: '- [x] tests\n- [ ] review',
      },
    )
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      id: created.body.id,
      title: 'Notes task',
      note: '- [x] tests\n- [ ] review',
    })
  })

  it('Should limit note updates to your own entries', async () => {
    const { add } = await setup()
    const created = await add('- [ ] mine')
    const other = await registered()
    const response = await other.apiClient.patch(
      `/time-entries/${created.body.id}/note`,
      {
        note: '- [x] mine',
      },
    )
    expect(response.status).toBe(404)
  })
})
