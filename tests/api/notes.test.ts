import { describe, expect, it } from 'vitest'
import { todayIn } from '#/domain/dates'
import { registered } from './helpers'

type Entry = { id: string; note: string | null; title: string }

async function setup() {
  const { c } = await registered()
  const types = await c.get<
    Array<{
      id: string
      kind: string
      storyPointsRequirement: string
      descriptionRequirement: string
    }>
  >('/task-types')
  const task = types.body.find((x) => x.kind === 'task')!
  const add = (note: string | null) =>
    c.post<Entry>('/time-entries', {
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
  return { c, task, add }
}

describe('markdown notes', () => {
  it('keeps long markdown notes exactly as written', async () => {
    const { add } = await setup()
    const note =
      '## Done\n- [x] **tests**\n- [ ] _review_\n\n```ts\nconst a = 1\n```\n' +
      'x'.repeat(15_000)
    const res = await add(note)
    expect(res.status).toBe(201)
    expect(res.body.note).toBe(note)
  })

  it('still rejects notes over the limit', async () => {
    const { add } = await setup()
    const res = await add('x'.repeat(20_001))
    expect(res.status).toBe(400)
  })

  it('updates only the note (ticking a checkbox on the list)', async () => {
    const { c, add } = await setup()
    const created = await add('- [ ] tests\n- [ ] review')
    const res = await c.patch<Entry>(`/time-entries/${created.body.id}/note`, {
      note: '- [x] tests\n- [ ] review',
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: created.body.id,
      title: 'Notes task',
      note: '- [x] tests\n- [ ] review',
    })
  })

  it('note updates are limited to your own entries', async () => {
    const { add } = await setup()
    const created = await add('- [ ] mine')
    const other = await registered()
    const res = await other.c.patch(`/time-entries/${created.body.id}/note`, {
      note: '- [x] mine',
    })
    expect(res.status).toBe(404)
  })
})
