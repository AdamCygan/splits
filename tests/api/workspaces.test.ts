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
  const { apiClient } = account
  const first = (await apiClient.get<WorkspaceState>('/workspaces')).body
    .items[0]!
  const created = await apiClient.post<Workspace>('/workspaces', {
    name: 'Globex',
    color: '#0F9F86',
    copyFrom: copy.length ? first.id : null,
    copy,
  })
  expect(created.status).toBe(201)
  return { ...account, first, second: created.body }
}

const use = (apiClient: ApiClient, id: string) =>
  apiClient.put<WorkspaceState>('/workspaces/current', { id })

async function startTimer(apiClient: ApiClient, title: string) {
  const types = await apiClient.get<Array<TaskType>>('/task-types')
  const response = await apiClient.post<{
    started: Entry
    stopped: Entry | null
  }>('/time-entries/timer', {
    taskTypeId: types.body.find((taskType) => taskType.kind === 'meeting')!.id,
    projectId: null,
    title,
    link: null,
    storyPoints: null,
    workDate: todayIn('Europe/Warsaw'),
    startTime: '00:00',
    note: null,
  })
  expect(response.status).toBe(201)
  return response.body
}

describe('workspaces', () => {
  it('Should give a new account one workspace named in its language', async () => {
    const english = await registered('en')
    const polish = await registered('pl')
    const state = (await english.apiClient.get<WorkspaceState>('/workspaces'))
      .body
    expect(state.items).toHaveLength(1)
    expect(state.items[0]!.name).toBe('My workspace')
    expect(state.current).toBe(state.items[0]!.id)
    expect(state.prefs).toEqual({ apply: {}, askDaily: true })
    expect(
      (await polish.apiClient.get<WorkspaceState>('/workspaces')).body.items[0]!
        .name,
    ).toBe('Moja przestrzeń')

    const boot = await english.apiClient.get<{ workspaces: WorkspaceState }>(
      '/bootstrap',
    )
    expect(boot.body.workspaces.items).toHaveLength(1)
  })

  it('Should allow one workspace on Free and more on Pro', async () => {
    const { apiClient } = await registered()
    const extra = await apiClient.post<{ code: string }>('/workspaces', {
      name: 'Side gig',
      color: '#3D3BF3',
    })
    expect(extra.status).toBe(403)
    expect(extra.body.code).toBe('plan.limit_workspaces')

    const { apiClient: pro } = await registered('en', { pro: true })
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
    const { apiClient, first, second } = await twoWorkspaces()

    const project = await apiClient.post<Named>('/projects', {
      name: 'Acme portal',
      key: 'ACME',
      color: '#3D3BF3',
    })
    expect(project.status).toBe(201)
    await startTimer(apiClient, 'Acme standup')

    const switched = await use(apiClient, second.id)
    expect(switched.status).toBe(200)
    expect(switched.body.current).toBe(second.id)
    expect((await apiClient.get<Array<Named>>('/projects')).body).toEqual([])
    expect(
      (
        await apiClient.get<Array<Entry>>(
          `/time-entries?date=${todayIn('Europe/Warsaw')}`,
        )
      ).body,
    ).toEqual([])
    // Ta sama nazwa projektu może być w każdej przestrzeni.
    expect(
      (
        await apiClient.post('/projects', {
          name: 'Acme portal',
          key: 'ACME',
          color: '#3D3BF3',
        })
      ).status,
    ).toBe(201)

    const settings = await apiClient.get<Record<string, unknown>>('/settings')
    await apiClient.put('/settings', {
      ...settings.body,
      workdayTargetMinutes: 240,
    })
    expect(
      (await apiClient.get<{ workdayTargetMinutes: number }>('/settings')).body
        .workdayTargetMinutes,
    ).toBe(240)

    await use(apiClient, first.id)
    expect(
      (await apiClient.get<{ workdayTargetMinutes: number }>('/settings')).body
        .workdayTargetMinutes,
    ).toBe(480)
    expect((await apiClient.get<Array<Named>>('/projects')).body).toHaveLength(
      1,
    )
  })

  it('Should ignore a workspace cookie that belongs to someone else', async () => {
    const owner = await twoWorkspaces()
    await use(owner.apiClient, owner.second.id)
    await owner.apiClient.post('/projects', {
      name: 'Secret',
      key: null,
      color: '#3D3BF3',
    })

    const intruder = await registered()
    intruder.apiClient.cookies.set('app_ws', owner.second.id)
    expect(
      (await intruder.apiClient.get<Array<Named>>('/projects')).body,
    ).toEqual([])
    const state = (await intruder.apiClient.get<WorkspaceState>('/workspaces'))
      .body
    expect(state.current).not.toBe(owner.second.id)
    expect((await use(intruder.apiClient, owner.second.id)).status).toBe(404)
  })

  it('Should copy the chosen setup into a new workspace', async () => {
    const account = await registered('en', { pro: true })
    const { apiClient } = account
    expect((await apiClient.post('/task-types', customType)).status).toBe(201)
    await apiClient.post('/tags', { name: 'urgent', color: '#E5603B' })
    const settings = await apiClient.get<Record<string, unknown>>('/settings')
    await apiClient.put('/settings', { ...settings.body, breakMinutes: 45 })
    const first = (await apiClient.get<WorkspaceState>('/workspaces')).body
      .items[0]!

    const created = await apiClient.post<Workspace>('/workspaces', {
      name: 'Initech',
      color: '#8B5CF6',
      copyFrom: first.id,
      copy: ['workTypes', 'workday'],
    })
    await use(apiClient, created.body.id)
    const types = (await apiClient.get<Array<TaskType>>('/task-types')).body
    expect(types.map((taskType) => taskType.name)).toContain('Incident')
    // Wbudowane rodzaje pracy nie dublują się (łączą się po nazwie).
    expect(
      types.filter((taskType) => taskType.kind === 'meeting'),
    ).toHaveLength(1)
    expect(
      (await apiClient.get<{ breakMinutes: number }>('/settings')).body
        .breakMinutes,
    ).toBe(45)
    // Tagów nie wybrano, więc nie przeszły.
    expect((await apiClient.get<Array<Named>>('/tags')).body).toEqual([])
  })

  it('Should apply a change to every workspace with apply=all', async () => {
    const { apiClient, first, second } = await twoWorkspaces([
      'workTypes',
      'tags',
    ])
    const day = todayIn('Europe/Warsaw')

    // Dzień wolny w obu przestrzeniach.
    const off = await apiClient.put(`/days-off?apply=all`, {
      from: day,
      to: day,
      kind: 'vacation',
      note: null,
    })
    expect(off.status).toBe(200)
    // Tylko tutaj.
    const tag = await apiClient.post<Named>('/tags', {
      name: 'ops',
      color: '#2C8FD6',
    })
    // Zmiana nazwy we wszystkich: odpowiednik w drugiej przestrzeni powstaje jako kopia.
    await apiClient.put(`/tags/${tag.body.id}?apply=all`, {
      name: 'operations',
      color: '#2C8FD6',
    })
    const settings = await apiClient.get<Record<string, unknown>>('/settings')
    await apiClient.put('/settings?apply=all', {
      ...settings.body,
      workdayTargetMinutes: 420,
    })

    await use(apiClient, second.id)
    expect(
      (
        await apiClient.get<Array<{ date: string }>>(
          `/days-off?from=${day}&to=${day}`,
        )
      ).body,
    ).toHaveLength(1)
    expect(
      (await apiClient.get<Array<Named>>('/tags')).body.map(
        (named) => named.name,
      ),
    ).toEqual(['operations'])
    expect(
      (await apiClient.get<{ workdayTargetMinutes: number }>('/settings')).body
        .workdayTargetMinutes,
    ).toBe(420)

    // Usunięcie we wszystkich usuwa też odpowiednik.
    await use(apiClient, first.id)
    await apiClient.del(`/tags/${tag.body.id}?apply=all`)
    await use(apiClient, second.id)
    expect((await apiClient.get<Array<Named>>('/tags')).body).toEqual([])

    // Bez apply zmiana zostaje w bieżącej przestrzeni.
    await apiClient.put('/days-off', {
      from: '2031-01-02',
      to: '2031-01-02',
      kind: 'sick',
      note: null,
    })
    await use(apiClient, first.id)
    expect(
      (
        await apiClient.get<Array<unknown>>(
          '/days-off?from=2031-01-02&to=2031-01-02',
        )
      ).body,
    ).toEqual([])
  })

  it('Should mirror sprints and work types with apply=all', async () => {
    const { apiClient, second } = await twoWorkspaces(['workTypes'])
    const types = (await apiClient.get<Array<TaskType>>('/task-types')).body
    const review = types.find((taskType) => taskType.kind === 'code_review')!
    const sprint = await apiClient.post<Named>('/sprints?apply=all', {
      name: 'Hardening',
      goal: null,
      startsOn: '2031-06-02',
      endsOn: '2031-06-13',
      capacityStoryPoints: null,
      timeGoals: [{ taskTypeId: review.id, minutes: 600 }],
    })
    expect(sprint.status).toBe(201)
    const type = (
      await apiClient.get<Array<TaskType & Record<string, unknown>>>(
        '/task-types',
      )
    ).body.find((taskType) => taskType.kind === 'meeting')!
    await apiClient.put(`/task-types/${type.id}?apply=all`, {
      ...customType,
      name: 'Ceremonies',
      countsAsFocusWork: false,
    })

    await use(apiClient, second.id)
    const theirs = (
      await apiClient.get<
        Array<Named & { timeGoals: Array<{ taskTypeId: string }> }>
      >('/sprints')
    ).body.find((listedSprint) => listedSprint.name === 'Hardening')!
    const theirTypes = (await apiClient.get<Array<TaskType>>('/task-types'))
      .body
    // Cel czasowy wskazuje rodzaj pracy z tej przestrzeni.
    expect(theirs.timeGoals[0]!.taskTypeId).toBe(
      theirTypes.find((taskType) => taskType.kind === 'code_review')!.id,
    )
    expect(theirTypes.map((taskType) => taskType.name)).toContain('Ceremonies')
    expect(theirTypes.map((taskType) => taskType.name)).not.toContain('Meeting')
  })

  it('Should keep one timer across workspaces', async () => {
    const { apiClient, first, second } = await twoWorkspaces()
    const acmeTimer = await startTimer(apiClient, 'Acme bugfix')

    await use(apiClient, second.id)
    const boot = await apiClient.get<{
      running: Entry | null
      runningElsewhere: { workspaceId: string; entry: Entry } | null
    }>('/bootstrap')
    expect(boot.body.running).toBeNull()
    expect(boot.body.runningElsewhere).toMatchObject({
      workspaceId: first.id,
      entry: { id: acmeTimer.started.id, running: true },
    })

    // Start w drugiej przestrzeni wstrzymuje zadanie z pierwszej.
    const globexTimer = await startTimer(apiClient, 'Globex review')
    expect(globexTimer.stopped).toMatchObject({
      id: acmeTimer.started.id,
      paused: true,
    })
    await use(apiClient, first.id)
    expect(
      (await apiClient.get<Entry | null>('/time-entries/running')).body,
    ).toBeNull()
    expect(
      (await apiClient.get<Array<Entry>>('/time-entries/paused')).body.map(
        (entry) => entry.id,
      ),
    ).toContain(acmeTimer.started.id)
  })

  it('Should delete a workspace with its data but never the last one', async () => {
    const { apiClient, first, second } = await twoWorkspaces()
    await use(apiClient, second.id)
    await apiClient.post('/projects', {
      name: 'Gone',
      key: null,
      color: '#3D3BF3',
    })

    expect((await apiClient.del(`/workspaces/${second.id}`)).status).toBe(204)
    // Ciasteczko wskazuje usuniętą: serwer wraca do pierwszej.
    const state = (await apiClient.get<WorkspaceState>('/workspaces')).body
    expect(state.current).toBe(first.id)
    expect(state.items).toHaveLength(1)
    expect((await apiClient.get<Array<Named>>('/projects')).body).toEqual([])

    const last = await apiClient.del<{ code: string }>(
      `/workspaces/${first.id}`,
    )
    expect(last.status).toBe(409)
    expect(last.body.code).toBe('workspace.last')
  })

  it('Should rename, reorder and remember preferences', async () => {
    const { apiClient, first, second } = await twoWorkspaces()
    const renamed = await apiClient.put<Workspace>(`/workspaces/${first.id}`, {
      name: 'Acme',
      color: '#DB4A7C',
    })
    expect(renamed.body).toMatchObject({ name: 'Acme', color: '#DB4A7C' })

    await apiClient.put('/workspaces/order', { ids: [second.id, first.id] })
    const prefs = await apiClient.put<WorkspaceState>('/workspaces/prefs', {
      apply: { daysOff: 'all', sprints: 'this' },
      askDaily: false,
    })
    expect(prefs.body.items.map((workspace) => workspace.name)).toEqual([
      'Globex',
      'Acme',
    ])
    expect(prefs.body.prefs).toEqual({
      apply: { daysOff: 'all', sprints: 'this' },
      askDaily: false,
    })
    // Kolejne zmiany łączą się z zapisanymi.
    const again = await apiClient.put<WorkspaceState>('/workspaces/prefs', {
      apply: { daysOff: 'ask' },
    })
    expect(again.body.prefs.apply).toEqual({ daysOff: 'ask', sprints: 'this' })
  })

  it('Should include every workspace in the data export', async () => {
    const { apiClient } = await twoWorkspaces()
    const exported = await apiClient.get<{
      workspaces: Array<Named>
      workspaceSettings: Array<unknown>
    }>('/account/export')
    expect(exported.body.workspaces.map((named) => named.name)).toEqual([
      'My workspace',
      'Globex',
    ])
    expect(exported.body.workspaceSettings).toHaveLength(2)
  })
})
