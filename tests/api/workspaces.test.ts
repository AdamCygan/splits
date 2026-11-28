import { describe, expect, it } from 'vitest'
import { todayIn } from '../../src/shared/domain/dates'
import { registered } from './helpers'
import type { ApiClient } from './helpers'

interface Workspace {
  id: string
  name: string
  color: string
}
interface WorkspaceState {
  current: string
  items: Array<Workspace>
  prefs: { apply: Record<string, string>; askDaily: boolean }
}
interface Named {
  id: string
  name: string
}
interface TaskType extends Named {
  kind: string
}
interface Entry {
  id: string
  title: string
  running: boolean
  paused: boolean
}

const customType = {
  name: 'Incident',
  color: '#E5603B',
  titleLabel: 'What broke',
  linkRequirement: 'optional',
  linkLabel: 'Link',
  descriptionRequirement: 'optional',
  storyPointsRequirement: 'hidden',
  defaultStoryPoints: null,
  defaultTimeInput: 'duration',
  countsAsFocusWork: true,
}

/** Konto Pro z drugą przestrzenią „Globex”; bieżąca zostaje pierwsza. */
async function twoWorkspaces(copy: Array<string> = []) {
  const account = await registered('en', { pro: true })
  const { c } = account
  const first = (await c.get<WorkspaceState>('/workspaces')).body.items[0]!
  const created = await c.post<Workspace>('/workspaces', {
    name: 'Globex',
    color: '#0F9F86',
    copyFrom: copy.length ? first.id : null,
    copy,
  })
  expect(created.status).toBe(201)
  return { ...account, first, second: created.body }
}

const use = (c: ApiClient, id: string) =>
  c.put<WorkspaceState>('/workspaces/current', { id })

async function startTimer(c: ApiClient, title: string) {
  const types = await c.get<Array<TaskType>>('/task-types')
  const res = await c.post<{ started: Entry; stopped: Entry | null }>(
    '/time-entries/timer',
    {
      taskTypeId: types.body.find((x) => x.kind === 'meeting')!.id,
      projectId: null,
      title,
      link: null,
      storyPoints: null,
      workDate: todayIn('Europe/Warsaw'),
      startTime: '00:00',
      note: null,
    },
  )
  expect(res.status).toBe(201)
  return res.body
}

describe('workspaces', () => {
  it('Should give a new account one workspace named in its language', async () => {
    const en = await registered('en')
    const pl = await registered('pl')
    const state = (await en.c.get<WorkspaceState>('/workspaces')).body
    expect(state.items).toHaveLength(1)
    expect(state.items[0]!.name).toBe('My workspace')
    expect(state.current).toBe(state.items[0]!.id)
    expect(state.prefs).toEqual({ apply: {}, askDaily: true })
    expect(
      (await pl.c.get<WorkspaceState>('/workspaces')).body.items[0]!.name,
    ).toBe('Moja przestrzeń')

    const boot = await en.c.get<{ workspaces: WorkspaceState }>('/bootstrap')
    expect(boot.body.workspaces.items).toHaveLength(1)
  })

  it('Should allow one workspace on Free and more on Pro', async () => {
    const { c } = await registered()
    const extra = await c.post<{ code: string }>('/workspaces', {
      name: 'Side gig',
      color: '#3D3BF3',
    })
    expect(extra.status).toBe(403)
    expect(extra.body.code).toBe('plan.limit_workspaces')

    const { c: pro } = await registered('en', { pro: true })
    expect(
      (await pro.post('/workspaces', { name: 'Side gig', color: '#3D3BF3' }))
        .status,
    ).toBe(201)
    const taken = await pro.post<{ code: string }>('/workspaces', {
      name: 'side GIG',
      color: '#3D3BF3',
    })
    expect(taken.status).toBe(409)
  })

  it('Should keep projects, entries and workday settings separate per workspace', async () => {
    const { c, first, second } = await twoWorkspaces()

    const project = await c.post<Named>('/projects', {
      name: 'Acme portal',
      key: 'ACME',
      color: '#3D3BF3',
    })
    expect(project.status).toBe(201)
    await startTimer(c, 'Acme standup')

    const switched = await use(c, second.id)
    expect(switched.status).toBe(200)
    expect(switched.body.current).toBe(second.id)
    expect((await c.get<Array<Named>>('/projects')).body).toEqual([])
    expect(
      (
        await c.get<Array<Entry>>(
          `/time-entries?date=${todayIn('Europe/Warsaw')}`,
        )
      ).body,
    ).toEqual([])
    // Ta sama nazwa projektu może być w każdej przestrzeni.
    expect(
      (
        await c.post('/projects', {
          name: 'Acme portal',
          key: 'ACME',
          color: '#3D3BF3',
        })
      ).status,
    ).toBe(201)

    const settings = await c.get<Record<string, unknown>>('/settings')
    await c.put('/settings', { ...settings.body, workdayTargetMinutes: 240 })
    expect(
      (await c.get<{ workdayTargetMinutes: number }>('/settings')).body
        .workdayTargetMinutes,
    ).toBe(240)

    await use(c, first.id)
    expect(
      (await c.get<{ workdayTargetMinutes: number }>('/settings')).body
        .workdayTargetMinutes,
    ).toBe(480)
    expect((await c.get<Array<Named>>('/projects')).body).toHaveLength(1)
  })

  it('Should ignore a workspace cookie that belongs to someone else', async () => {
    const owner = await twoWorkspaces()
    await use(owner.c, owner.second.id)
    await owner.c.post('/projects', {
      name: 'Secret',
      key: null,
      color: '#3D3BF3',
    })

    const intruder = await registered()
    intruder.c.cookies.set('app_ws', owner.second.id)
    expect((await intruder.c.get<Array<Named>>('/projects')).body).toEqual([])
    const state = (await intruder.c.get<WorkspaceState>('/workspaces')).body
    expect(state.current).not.toBe(owner.second.id)
    expect((await use(intruder.c, owner.second.id)).status).toBe(404)
  })

  it('Should copy the chosen setup into a new workspace', async () => {
    const account = await registered('en', { pro: true })
    const { c } = account
    expect((await c.post('/task-types', customType)).status).toBe(201)
    await c.post('/tags', { name: 'urgent', color: '#E5603B' })
    const settings = await c.get<Record<string, unknown>>('/settings')
    await c.put('/settings', { ...settings.body, breakMinutes: 45 })
    const first = (await c.get<WorkspaceState>('/workspaces')).body.items[0]!

    const created = await c.post<Workspace>('/workspaces', {
      name: 'Initech',
      color: '#8B5CF6',
      copyFrom: first.id,
      copy: ['workTypes', 'workday'],
    })
    await use(c, created.body.id)
    const types = (await c.get<Array<TaskType>>('/task-types')).body
    expect(types.map((x) => x.name)).toContain('Incident')
    // Wbudowane rodzaje pracy nie dublują się (łączą się po nazwie).
    expect(types.filter((x) => x.kind === 'meeting')).toHaveLength(1)
    expect(
      (await c.get<{ breakMinutes: number }>('/settings')).body.breakMinutes,
    ).toBe(45)
    // Tagów nie wybrano, więc nie przeszły.
    expect((await c.get<Array<Named>>('/tags')).body).toEqual([])
  })

  it('Should apply a change to every workspace with apply=all', async () => {
    const { c, first, second } = await twoWorkspaces(['workTypes', 'tags'])
    const day = todayIn('Europe/Warsaw')

    // Dzień wolny w obu przestrzeniach.
    const off = await c.put(`/days-off?apply=all`, {
      from: day,
      to: day,
      kind: 'vacation',
      note: null,
    })
    expect(off.status).toBe(200)
    // Tylko tutaj.
    const tag = await c.post<Named>('/tags', { name: 'ops', color: '#2C8FD6' })
    // Zmiana nazwy we wszystkich: odpowiednik w drugiej przestrzeni powstaje jako kopia.
    await c.put(`/tags/${tag.body.id}?apply=all`, {
      name: 'operations',
      color: '#2C8FD6',
    })
    const settings = await c.get<Record<string, unknown>>('/settings')
    await c.put('/settings?apply=all', {
      ...settings.body,
      workdayTargetMinutes: 420,
    })

    await use(c, second.id)
    expect(
      (await c.get<Array<{ date: string }>>(`/days-off?from=${day}&to=${day}`))
        .body,
    ).toHaveLength(1)
    expect(
      (await c.get<Array<Named>>('/tags')).body.map((x) => x.name),
    ).toEqual(['operations'])
    expect(
      (await c.get<{ workdayTargetMinutes: number }>('/settings')).body
        .workdayTargetMinutes,
    ).toBe(420)

    // Usunięcie we wszystkich usuwa też odpowiednik.
    await use(c, first.id)
    await c.del(`/tags/${tag.body.id}?apply=all`)
    await use(c, second.id)
    expect((await c.get<Array<Named>>('/tags')).body).toEqual([])

    // Bez apply zmiana zostaje w bieżącej przestrzeni.
    await c.put('/days-off', {
      from: '2031-01-02',
      to: '2031-01-02',
      kind: 'sick',
      note: null,
    })
    await use(c, first.id)
    expect(
      (await c.get<Array<unknown>>('/days-off?from=2031-01-02&to=2031-01-02'))
        .body,
    ).toEqual([])
  })

  it('Should mirror sprints and work types with apply=all', async () => {
    const { c, second } = await twoWorkspaces(['workTypes'])
    const types = (await c.get<Array<TaskType>>('/task-types')).body
    const review = types.find((x) => x.kind === 'code_review')!
    const sprint = await c.post<Named>('/sprints?apply=all', {
      name: 'Hardening',
      goal: null,
      startsOn: '2031-06-02',
      endsOn: '2031-06-13',
      capacityStoryPoints: null,
      timeGoals: [{ taskTypeId: review.id, minutes: 600 }],
    })
    expect(sprint.status).toBe(201)
    const type = (
      await c.get<Array<TaskType & Record<string, unknown>>>('/task-types')
    ).body.find((x) => x.kind === 'meeting')!
    await c.put(`/task-types/${type.id}?apply=all`, {
      ...customType,
      name: 'Ceremonies',
      countsAsFocusWork: false,
    })

    await use(c, second.id)
    const theirs = (
      await c.get<Array<Named & { timeGoals: Array<{ taskTypeId: string }> }>>(
        '/sprints',
      )
    ).body.find((x) => x.name === 'Hardening')!
    const theirTypes = (await c.get<Array<TaskType>>('/task-types')).body
    // Cel czasowy wskazuje rodzaj pracy z tej przestrzeni.
    expect(theirs.timeGoals[0]!.taskTypeId).toBe(
      theirTypes.find((x) => x.kind === 'code_review')!.id,
    )
    expect(theirTypes.map((x) => x.name)).toContain('Ceremonies')
    expect(theirTypes.map((x) => x.name)).not.toContain('Meeting')
  })

  it('Should keep one timer across workspaces', async () => {
    const { c, first, second } = await twoWorkspaces()
    const a = await startTimer(c, 'Acme bugfix')

    await use(c, second.id)
    const boot = await c.get<{
      running: Entry | null
      runningElsewhere: { workspaceId: string; entry: Entry } | null
    }>('/bootstrap')
    expect(boot.body.running).toBeNull()
    expect(boot.body.runningElsewhere).toMatchObject({
      workspaceId: first.id,
      entry: { id: a.started.id, running: true },
    })

    // Start w drugiej przestrzeni wstrzymuje zadanie z pierwszej.
    const b = await startTimer(c, 'Globex review')
    expect(b.stopped).toMatchObject({ id: a.started.id, paused: true })
    await use(c, first.id)
    expect((await c.get<Entry | null>('/time-entries/running')).body).toBeNull()
    expect(
      (await c.get<Array<Entry>>('/time-entries/paused')).body.map((x) => x.id),
    ).toContain(a.started.id)
  })

  it('Should delete a workspace with its data but never the last one', async () => {
    const { c, first, second } = await twoWorkspaces()
    await use(c, second.id)
    await c.post('/projects', { name: 'Gone', key: null, color: '#3D3BF3' })

    expect((await c.del(`/workspaces/${second.id}`)).status).toBe(204)
    // Ciasteczko wskazuje usuniętą: serwer wraca do pierwszej.
    const state = (await c.get<WorkspaceState>('/workspaces')).body
    expect(state.current).toBe(first.id)
    expect(state.items).toHaveLength(1)
    expect((await c.get<Array<Named>>('/projects')).body).toEqual([])

    const last = await c.del<{ code: string }>(`/workspaces/${first.id}`)
    expect(last.status).toBe(409)
    expect(last.body.code).toBe('workspace.last')
  })

  it('Should rename, reorder and remember preferences', async () => {
    const { c, first, second } = await twoWorkspaces()
    const renamed = await c.put<Workspace>(`/workspaces/${first.id}`, {
      name: 'Acme',
      color: '#DB4A7C',
    })
    expect(renamed.body).toMatchObject({ name: 'Acme', color: '#DB4A7C' })

    await c.put('/workspaces/order', { ids: [second.id, first.id] })
    const prefs = await c.put<WorkspaceState>('/workspaces/prefs', {
      apply: { daysOff: 'all', sprints: 'this' },
      askDaily: false,
    })
    expect(prefs.body.items.map((x) => x.name)).toEqual(['Globex', 'Acme'])
    expect(prefs.body.prefs).toEqual({
      apply: { daysOff: 'all', sprints: 'this' },
      askDaily: false,
    })
    // Kolejne zmiany łączą się z zapisanymi.
    const again = await c.put<WorkspaceState>('/workspaces/prefs', {
      apply: { daysOff: 'ask' },
    })
    expect(again.body.prefs.apply).toEqual({ daysOff: 'ask', sprints: 'this' })
  })

  it('Should include every workspace in the data export', async () => {
    const { c } = await twoWorkspaces()
    const exported = await c.get<{
      workspaces: Array<Named>
      workspaceSettings: Array<unknown>
    }>('/account/export')
    expect(exported.body.workspaces.map((x) => x.name)).toEqual([
      'My workspace',
      'Globex',
    ])
    expect(exported.body.workspaceSettings).toHaveLength(2)
  })
})
