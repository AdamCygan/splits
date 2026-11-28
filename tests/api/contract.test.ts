import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TimeEntryInput } from '../../src/features/time-entries/data/dto'
import type { SprintTimeGoal } from '../../src/features/sprints/data/dto'
import type { QuickTemplateInput } from '../../src/features/templates/data/dto'
import { eq } from 'drizzle-orm'
import { api } from '#/server/app'
import { database } from '#/server/db/client'
import { users } from '#/server/db/schema'
import { inSequence, lastDeleteCode, numbered, otherCode } from './helpers'

/**
 * Prawdziwy adapter frontendu (httpSource + api-client + schematy Zod) na prawdziwym API i bazie.
 * fetch przeglądarki zastępujemy wywołaniem aplikacji Hono, z ciasteczkami jak w przeglądarce.
 */
const jar = new Map<string, string>()
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input), 'http://localhost:3000')
  const headers = new Headers(init?.headers)
  headers.set('Origin', 'http://localhost:3000')
  if (jar.size)
    headers.set(
      'Cookie',
      [...jar].map(([key, entryValue]) => `${key}=${entryValue}`).join('; '),
    )
  const response = await api.request(url.toString(), { ...init, headers })
  for (const line of response.headers.getSetCookie()) {
    const [name, cookie = ''] = line.split(';')[0]!.split('=')
    if (/Max-Age=0/i.test(line) || !cookie) jar.delete(name!)
    else jar.set(name!, cookie)
  }
  return response
}

const { frontendApi: data } = await import('../support/frontend-api')
const { setAccessToken } = await import('#/lib/auth-token')

async function value<T>(
  promise: Promise<{ ok: true; value: T } | { ok: false; error: unknown }>,
): Promise<T> {
  const result = await promise
  if (!result.ok)
    throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
  return result.value
}

async function errorCode(
  promise: Promise<{ ok: boolean; error?: { code: string } }>,
) {
  const result = await promise
  expect(result.ok).toBe(false)
  return result.error?.code
}

/** Sprint z celami czasu (daty daleko w przyszłości, żeby nie wejść na kadencję). */
const goalsSprint = (timeGoals: Array<SprintTimeGoal>) => ({
  name: 'Goals',
  goal: null,
  startsOn: '2031-03-01',
  endsOn: '2031-03-14',
  capacityStoryPoints: null,
  timeGoals,
})

/** Codzienne spotkanie z różną godziną w poniedziałek i wtorek. */
const dailyTemplate = (taskTypeId: string): QuickTemplateInput => ({
  label: 'Daily',
  taskTypeId,
  title: 'Daily stand-up',
  defaultDurationMinutes: 15,
  storyPoints: null,
  projectId: null,
  askProject: false,
  hotkey: null,
  schedule: [
    { day: 2, time: '09:30' },
    { day: 1, time: '10:00' },
  ],
})

/** Wpis z 90 minutami nadgodzin w 2,5-godzinnej pracy dodatkowej. */
const overtimeEntry = (taskTypeId: string): TimeEntryInput => ({
  taskTypeId,
  projectId: null,
  title: 'Checkout hotfix',
  link: null,
  storyPoints: null,
  workDate: '2026-11-12',
  startTime: '17:00',
  endTime: '19:30',
  durationMinutes: 150,
  note: null,
  overtimeMinutes: 90,
  overtimeNote: '  Rolled back the cache change.  ',
  estimateMinutes: null,
  extensionMinutes: null,
  extensionNote: null,
  running: false,
})

const extraWorkTypeId = async () =>
  (await value(data.taskTypes.list())).find(
    (taskType) => taskType.kind === 'additional_work',
  )!.id

let count = 0
const stamp = Date.now().toString(36)
beforeAll(() => {
  jar.clear()
})
beforeEach(async () => {
  count++
  jar.clear()
  const session = await value(
    data.auth.register({
      username: `tester${stamp}${count}`,
      email: `tester${stamp}${count}@example.com`,
      password: 'correct horse 1',
      locale: 'en',
    }),
  )
  setAccessToken(session.accessToken)
  // Kontrakt sprawdzamy na koncie Pro; limity planu Free mają osobny test.
  await setPlan('pro')
})

const setPlan = (plan: 'free' | 'pro') =>
  database
    .update(users)
    .set({ plan })
    .where(eq(users.email, `tester${stamp}${count}@example.com`))

describe('API contract (frontend adapter against the real server)', () => {
  it('Should reject a duplicate username and a wrong password', async () => {
    expect(
      await errorCode(
        data.auth.register({
          username: `TESTER${stamp}${count}`,
          email: 'x@example.com',
          password: 'abcdefghij1',
          locale: 'en',
        }),
      ),
    ).toBe('auth.username_taken')
    expect(
      await errorCode(
        data.auth.login({ login: `tester${stamp}${count}`, password: 'nope' }),
      ),
    ).toBe('auth.invalid_credentials')
    const session = await value(
      data.auth.login({
        login: `Tester${stamp}${count}@example.com`,
        password: 'correct horse 1',
      }),
    )
    expect(session).toMatchObject({ user: { hasPassword: true } })
  })

  it('Should create the default workspace on sign-up', async () => {
    const types = await value(data.taskTypes.list())
    expect(
      types.map((taskType) => [taskType.kind, taskType.storyPointsRequirement]),
    ).toEqual([
      ['task', 'required'],
      ['code_review', 'optional'],
      ['pair_programming', 'optional'],
      ['additional_work', 'optional'],
      ['meeting', 'hidden'],
    ])
    expect(
      (await value(data.statuses.list())).filter(
        (taskStatus) => taskStatus.isDefault,
      ),
    ).toHaveLength(1)
    expect(
      (await value(data.spScale.get())).map(
        (spScaleStep) => spScaleStep.points,
      ),
    ).toEqual([0.5, 1, 2, 3, 5, 8, 13])
    expect((await value(data.settings.get())).timezone).toBe('UTC')
    expect((await value(data.sprints.list())).length).toBeGreaterThanOrEqual(2)
  })

  it('Should keep custom work types unique and valid', async () => {
    const base = (await value(data.taskTypes.list()))[1]!
    await inSequence(numbered(3), (index) =>
      value(data.taskTypes.create({ ...base, name: `Custom ${index}` })),
    )
    expect(
      await errorCode(data.taskTypes.create({ ...base, name: 'custom 1' })),
    ).toBe('name_taken')
    expect(
      await errorCode(
        data.taskTypes.update(base.id, {
          ...base,
          storyPointsRequirement: 'required',
          defaultStoryPoints: null,
        }),
      ),
    ).toBe('validation.invalid')
  })

  it('Should hold a Free account to its limits', async () => {
    await setPlan('free')
    const base = (await value(data.taskTypes.list()))[1]!
    expect(
      await errorCode(data.taskTypes.create({ ...base, name: 'Custom' })),
    ).toBe('plan.limit_custom_types')

    await value(
      data.projects.create({ name: 'Payments', key: 'PAY', color: '#3D3BF3' }),
    )
    expect(
      await errorCode(
        data.projects.create({ name: 'Search', key: 'SRCH', color: '#3D3BF3' }),
      ),
    ).toBe('plan.limit_projects')

    const type = (await value(data.taskTypes.list()))[0]!
    const existing = (await value(data.templates.list())).length
    await inSequence(numbered(Math.max(0, 2 - existing)), (index) =>
      value(
        data.templates.create({
          ...dailyTemplate(type.id),
          label: `T${index}`,
        }),
      ),
    )
    expect(
      await errorCode(
        data.templates.create({ ...dailyTemplate(type.id), label: 'Third' }),
      ),
    ).toBe('plan.limit_templates')

    expect(
      await errorCode(
        data.statuses.create({
          name: 'Blocked',
          category: 'in_progress',
          color: '#E5603B',
        }),
      ),
    ).toBe('plan.limit_statuses')

    const settings = await value(data.settings.get())
    expect(
      await errorCode(
        data.settings.update({ ...settings, dailyReminderAt: '17:00' }),
      ),
    ).toBe('plan.pro_feature')
  })

  it('Should protect default and system statuses', async () => {
    const statuses = await value(data.statuses.list())
    const definition = statuses.find((taskStatus) => taskStatus.isDefault)!
    expect(
      await errorCode(data.statuses.setArchived(definition.id, true)),
    ).toMatch(/^status\./)
    const created = await value(
      data.statuses.create({
        name: 'Blocked',
        category: 'in_progress',
        color: '#E5603B',
      }),
    )
    await value(data.statuses.setDefault(created.id))
    const after = await value(data.statuses.list())
    expect(
      after
        .filter((taskStatus) => taskStatus.isDefault)
        .map((taskStatus) => taskStatus.id),
    ).toEqual([created.id])
    const reordered = await value(
      data.statuses.reorder(
        [...after].reverse().map((taskStatus) => taskStatus.id),
      ),
    )
    expect(reordered[0]!.id).toBe(after.at(-1)!.id)
  })

  it('Should reject overlapping and inverted sprints', async () => {
    await value(data.sprints.setCadence(null))
    const input = {
      name: 'Manual',
      goal: null,
      startsOn: '2030-01-01',
      endsOn: '2030-01-14',
      capacityStoryPoints: null,
      timeGoals: [],
    }
    await value(data.sprints.create(input))
    expect(
      await errorCode(
        data.sprints.create({
          ...input,
          startsOn: '2030-01-14',
          endsOn: '2030-01-20',
        }),
      ),
    ).toBe('sprint.overlap')
    expect(
      await errorCode(
        data.sprints.create({
          ...input,
          startsOn: '2030-02-10',
          endsOn: '2030-02-01',
        }),
      ),
    ).toBe('sprint.dates')
  })

  it('Should store time goals per kind of work on a sprint', async () => {
    await value(data.sprints.setCadence(null))
    const [type] = await value(data.taskTypes.list())
    const input = goalsSprint([{ taskTypeId: type!.id, minutes: 360 }])
    const created = await value(data.sprints.create(input))
    expect(created.timeGoals).toEqual([{ taskTypeId: type!.id, minutes: 360 }])
    const updated = await value(
      data.sprints.update(created.id, { ...input, timeGoals: [] }),
    )
    expect(updated.timeGoals).toEqual([])
  })

  it.each<[string, (typeId: string) => Array<SprintTimeGoal>]>([
    [
      'an unknown kind of work',
      () => [{ taskTypeId: crypto.randomUUID(), minutes: 60 }],
    ],
    [
      'the same kind of work twice',
      (typeId) => [
        { taskTypeId: typeId, minutes: 60 },
        { taskTypeId: typeId, minutes: 90 },
      ],
    ],
    ['zero minutes', (typeId) => [{ taskTypeId: typeId, minutes: 0 }]],
  ])('Should reject a sprint time goal with %s', async (_case, goals) => {
    await value(data.sprints.setCadence(null))
    const [type] = await value(data.taskTypes.list())
    const input = goalsSprint([])
    const created = await value(data.sprints.create(input))
    expect(
      await errorCode(
        data.sprints.update(created.id, {
          ...input,
          timeGoals: goals(type!.id),
        }),
      ),
    ).toBe('validation.invalid')
  })

  it('Should not delete sprints that the cadence recreates', async () => {
    await value(
      data.sprints.setCadence({
        lengthDays: 14,
        anchorDate: '2026-01-05',
        namePattern: 'Sprint {n}',
        autoCreate: true,
      }),
    )
    const sprints = await value(data.sprints.list())
    const fromCadence = sprints.find((sprint) => sprint.fromCadence)!
    expect(fromCadence.name).toBe('Sprint 1')
    expect(await errorCode(data.sprints.remove(fromCadence.id))).toBe(
      'sprint.cadence_delete',
    )
  })

  it('Should keep hotkeys unique and projects keyed', async () => {
    const type = (await value(data.taskTypes.list()))[0]!
    const input = {
      label: 'Standup',
      taskTypeId: type.id,
      title: 'Daily',
      defaultDurationMinutes: 15,
      storyPoints: null,
      projectId: null,
      askProject: false,
      hotkey: 1,
      schedule: [],
    }
    await value(data.templates.create(input))
    expect(
      await errorCode(data.templates.create({ ...input, label: 'Other' })),
    ).toBe('hotkey_taken')
    await value(
      data.projects.create({ name: 'Payments', key: 'PAY', color: '#3D3BF3' }),
    )
    expect(
      await errorCode(
        data.projects.create({ name: 'Other', key: 'PAY', color: '#3D3BF3' }),
      ),
    ).toBe('key_taken')
  })

  it('Should store a recurring template with its own time per day', async () => {
    const type = (await value(data.taskTypes.list()))[0]!
    const created = await value(data.templates.create(dailyTemplate(type.id)))
    // Zapisane w kolejności dni tygodnia.
    expect(created.schedule).toEqual([
      { day: 1, time: '10:00' },
      { day: 2, time: '09:30' },
    ])
    const listed = await value(data.templates.list())
    expect(
      listed.find((quickTemplate) => quickTemplate.id === created.id)!.schedule,
    ).toHaveLength(2)
  })

  it.each<[string, Partial<QuickTemplateInput>]>([
    ['without a duration', { defaultDurationMinutes: null }],
    [
      'with the same day twice',
      {
        schedule: [
          { day: 1, time: '10:00' },
          { day: 1, time: '11:00' },
        ],
      },
    ],
    ['with a day out of range', { schedule: [{ day: 7, time: '10:00' }] }],
    ['with a wrong hour', { schedule: [{ day: 1, time: '25:00' }] }],
  ])('Should reject a recurring template %s', async (_case, bad) => {
    const type = (await value(data.taskTypes.list()))[0]!
    expect(
      await errorCode(
        data.templates.create({ ...dailyTemplate(type.id), ...bad }),
      ),
    ).toBe('validation.invalid')
  })

  it('Should store an any-project template without a fixed project', async () => {
    const type = (await value(data.taskTypes.list()))[1]!
    const project = await value(
      data.projects.create({ name: 'Repo A', key: null, color: '#3D3BF3' }),
    )
    const created = await value(
      data.templates.create({
        label: 'Review',
        taskTypeId: type.id,
        title: 'Code review',
        defaultDurationMinutes: 20,
        storyPoints: null,
        projectId: project.id,
        askProject: true,
        hotkey: null,
        schedule: [],
      }),
    )
    expect(created.askProject).toBe(true)
    expect(created.projectId).toBeNull()
    const fixed = await value(
      data.templates.update(created.id, {
        ...created,
        projectId: project.id,
        askProject: false,
      }),
    )
    expect(fixed).toMatchObject({ askProject: false, projectId: project.id })
  })

  it('Should validate the story point scale', async () => {
    expect(
      await errorCode(
        data.spScale.replace([
          { points: 3, maxMinutes: 60 },
          { points: 5, maxMinutes: 30 },
        ]),
      ),
    ).toBe('scale.invalid')
    const saved = await value(
      data.spScale.replace([
        { points: 2, maxMinutes: 120 },
        { points: 3, maxMinutes: 240 },
      ]),
    )
    expect(saved.map((spScaleStep) => spScaleStep.points)).toEqual([2, 3])
  })

  it('Should store overtime with its description', async () => {
    const input = overtimeEntry(await extraWorkTypeId())
    const created = await value(data.entries.create(input))
    expect(created).toMatchObject({
      durationMinutes: 150,
      overtimeMinutes: 90,
      overtimeNote: 'Rolled back the cache change.',
    })
    // Zdjęcie nadgodzin czyści też opis.
    const cleared = await value(
      data.entries.update(created.id, {
        ...input,
        overtimeMinutes: null,
        overtimeNote: null,
      }),
    )
    expect(cleared).toMatchObject({ overtimeMinutes: null, overtimeNote: null })
  })

  it.each<[string, Partial<TimeEntryInput>]>([
    ['longer than the entry', { overtimeMinutes: 151 }],
    ['without a description', { overtimeNote: null }],
    ['with a blank description', { overtimeNote: ' ' }],
    ['of zero minutes', { overtimeMinutes: 0 }],
    [
      'given only as a description',
      { overtimeMinutes: null, overtimeNote: 'Orphan note' },
    ],
    // Działający timer nie ma jeszcze czasu, więc nie ma też nadgodzin.
    [
      'on a running timer',
      {
        workDate: '2026-11-01',
        startTime: '06:00',
        endTime: null,
        durationMinutes: 0,
        running: true,
      },
    ],
  ])('Should reject overtime %s', async (_case, bad) => {
    const input = overtimeEntry(await extraWorkTypeId())
    expect(await errorCode(data.entries.create({ ...input, ...bad }))).toBe(
      'validation.invalid',
    )
  })

  it('Should store entries with notes, SP rules per work type and ranges', async () => {
    const types = await value(data.taskTypes.list())
    const review = types.find((taskType) => taskType.kind === 'code_review')!
    const meeting = types.find((taskType) => taskType.kind === 'meeting')!
    const input = {
      taskTypeId: review.id,
      projectId: null,
      title: 'CR !481',
      link: 'https://gitlab.com/acme/shop/-/merge_requests/481',
      storyPoints: null,
      workDate: '2026-11-02',
      startTime: null,
      endTime: null,
      durationMinutes: 25,
      note: '  ',
      overtimeMinutes: null,
      overtimeNote: null,
      estimateMinutes: null,
      extensionMinutes: null,
      extensionNote: null,
      running: false,
    }
    const created = await value(data.entries.create(input))
    expect(created.note).toBeNull()
    expect(created.storyPoints).toBeNull()
    const updated = await value(
      data.entries.update(created.id, {
        ...input,
        storyPoints: 0.5,
        note: 'Asked for a test.',
      }),
    )
    expect(updated).toMatchObject({
      note: 'Asked for a test.',
      storyPoints: 0.5,
    })
    expect(
      (await value(data.entries.list('2026-11-02'))).map(
        (timeEntry) => timeEntry.id,
      ),
    ).toEqual([created.id])
    expect(await errorCode(data.entries.create({ ...input, link: null }))).toBe(
      'validation.invalid',
    )
    expect(
      await errorCode(
        data.entries.create({
          ...input,
          taskTypeId: meeting.id,
          link: null,
          storyPoints: 1,
        }),
      ),
    ).toBe('validation.invalid')
    await value(
      data.entries.create({
        ...input,
        taskTypeId: meeting.id,
        link: null,
        title: 'Planning',
        workDate: '2026-11-04',
      }),
    )
    const range = await value(data.entries.range('2026-11-01', '2026-11-30'))
    expect(range.map((timeEntry) => timeEntry.title)).toEqual([
      'CR !481',
      'Planning',
    ])
    const task = await value(data.entries.forTask(created))
    expect(task.map((timeEntry) => timeEntry.id)).toEqual([created.id])
    await value(data.entries.remove(created.id))
    expect(await errorCode(data.entries.remove(created.id))).toBe('not_found')
  })

  it('Should run one timer at a time and stop it on demand', async () => {
    const type = (await value(data.taskTypes.list()))[0]!
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(
      new Date(),
    )
    const base = {
      taskTypeId: type.id,
      projectId: null,
      link: null,
      storyPoints: 1,
      workDate: today,
      note: null,
      startTime: '00:00',
    }
    const first = await value(data.entries.start({ ...base, title: 'First' }))
    expect(first.started.running).toBe(true)
    expect(first.stopped).toBeNull()
    const second = await value(data.entries.start({ ...base, title: 'Second' }))
    expect(second.stopped?.title).toBe('First')
    expect(second.stopped?.running).toBe(false)
    expect((await value(data.entries.running()))?.title).toBe('Second')
    const stopped = await value(data.entries.stop(second.started.id))
    expect(stopped.running).toBe(false)
    expect(stopped.durationMinutes).toBeGreaterThan(0)
    expect(await value(data.entries.running())).toBeNull()
  })

  it('Should pause a task when you switch, then resume it as a new interval', async () => {
    const type = (await value(data.taskTypes.list()))[0]!
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(
      new Date(),
    )
    const base = {
      taskTypeId: type.id,
      projectId: null,
      storyPoints: 3,
      workDate: today,
      note: null,
      startTime: '00:00',
    }
    const entryValue = await value(
      data.entries.start({
        ...base,
        title: 'PAY-142 Gateway',
        link: 'https://acme.atlassian.net/browse/PAY-142',
      }),
    )
    // Nagłe zadanie: A zostaje wstrzymane, nie zamknięte.
    const started = await value(
      data.entries.start({ ...base, title: 'Hotfix', link: null }),
    )
    expect(started.stopped).toMatchObject({
      id: entryValue.started.id,
      running: false,
      paused: true,
    })
    expect(
      (await value(data.entries.paused())).map((timeEntry) => timeEntry.title),
    ).toEqual(['PAY-142 Gateway'])

    // Koniec B: zwykły stop, B nie trafia do wstrzymanych.
    const doneB = await value(data.entries.stop(started.started.id))
    expect(doneB.paused).toBe(false)
    expect(
      (await value(data.entries.paused())).map((timeEntry) => timeEntry.title),
    ).toEqual(['PAY-142 Gateway'])

    // Powrót do A: nowa sesja (nowy odcinek), A znika z wstrzymanych.
    const resumed = await value(data.entries.resume(entryValue.started.id))
    expect(resumed.stopped).toBeNull()
    expect(resumed.started).toMatchObject({
      title: 'PAY-142 Gateway',
      link: 'https://acme.atlassian.net/browse/PAY-142',
      storyPoints: 3,
      running: true,
    })
    expect(resumed.started.id).not.toBe(entryValue.started.id)
    expect(await value(data.entries.paused())).toEqual([])
    const day = await value(data.entries.list(today))
    expect(
      day.filter((timeEntry) => timeEntry.title === 'PAY-142 Gateway'),
    ).toHaveLength(2)

    // Ręczna przerwa i „Gotowe”.
    const pausedA = await value(data.entries.pause(resumed.started.id))
    expect(pausedA).toMatchObject({ running: false, paused: true })
    expect(await value(data.entries.running())).toBeNull()
    await value(data.entries.dismiss(pausedA.id))
    expect(await value(data.entries.paused())).toEqual([])
  })

  it('Should keep every account’s data private', async () => {
    const mine = (await value(data.taskTypes.list()))[0]!
    // Drugie konto nie widzi ani nie zmienia cudzych danych.
    jar.clear()
    const other = await value(
      data.auth.register({
        username: `other${stamp}${count}`,
        email: `other${stamp}${count}@example.com`,
        password: 'correct horse 1',
        locale: 'pl',
      }),
    )
    setAccessToken(other.accessToken)
    expect(
      (await value(data.taskTypes.list())).some(
        (taskType) => taskType.id === mine.id,
      ),
    ).toBe(false)
    expect(
      await errorCode(
        data.taskTypes.update(mine.id, { ...mine, name: 'Hijack' }),
      ),
    ).toBe('not_found')
    expect(
      await errorCode(
        data.entries.create({
          taskTypeId: mine.id,
          projectId: null,
          title: 'x',
          link: null,
          storyPoints: 1,
          workDate: '2026-11-02',
          startTime: null,
          endTime: null,
          durationMinutes: 10,
          note: null,
          overtimeMinutes: null,
          overtimeNote: null,
          estimateMinutes: null,
          extensionMinutes: null,
          extensionNote: null,
          running: false,
        }),
      ),
    ).toBe('type.unknown')
    expect((await value(data.taskTypes.list()))[0]!.name).toBe('Zadanie')
  })

  it('Should update profile, change the password and delete the account', async () => {
    const me = await value(data.account.me())
    const user = await value(data.account.updateProfile({ displayName: 'Ada' }))
    expect(user.displayName).toBe('Ada')
    expect(
      await errorCode(
        data.account.changePassword({
          currentPassword: 'wrong',
          newPassword: 'another horse 2',
        }),
      ),
    ).toBe('auth.wrong_password')
    await value(
      data.account.changePassword({
        currentPassword: 'correct horse 1',
        newPassword: 'another horse 2',
      }),
    )
    await value(data.account.sendDeleteCode())
    const code = lastDeleteCode(me.email)
    expect(await errorCode(data.account.deleteAccount(otherCode(code)))).toBe(
      'auth.invalid_delete_code',
    )
    await value(data.account.deleteAccount(code))
    expect(await errorCode(data.account.me())).toBe('auth.no_session')
  })
})
