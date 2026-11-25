import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { api } from '#/server/app'

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
    headers.set('Cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '))
  const response = await api.request(url.toString(), { ...init, headers })
  for (const line of response.headers.getSetCookie()) {
    const [name, cookie = ''] = line.split(';')[0]!.split('=')
    if (/Max-Age=0/i.test(line) || !cookie) jar.delete(name!)
    else jar.set(name!, cookie)
  }
  return response
}

const { httpSource: data } = await import('#/data/http/http-source')
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

let n = 0
const stamp = Date.now().toString(36)
beforeAll(() => {
  jar.clear()
})
beforeEach(async () => {
  n++
  jar.clear()
  const session = await value(
    data.auth.register({
      username: `tester${stamp}${n}`,
      email: `tester${stamp}${n}@example.com`,
      password: 'correct horse 1',
      locale: 'en',
    }),
  )
  setAccessToken(session.accessToken)
})

describe('API contract (frontend adapter against the real server)', () => {
  it('rejects a duplicate username and a wrong password', async () => {
    expect(
      await errorCode(
        data.auth.register({
          username: `TESTER${stamp}${n}`,
          email: 'x@example.com',
          password: 'abcdefghij1',
          locale: 'en',
        }),
      ),
    ).toBe('auth.username_taken')
    expect(
      await errorCode(
        data.auth.login({ login: `tester${stamp}${n}`, password: 'nope' }),
      ),
    ).toBe('auth.invalid_credentials')
    const session = await value(
      data.auth.login({
        login: `Tester${stamp}${n}@example.com`,
        password: 'correct horse 1',
      }),
    )
    expect(session.user.hasPassword).toBe(true)
  })

  it('creates the default workspace on sign-up', async () => {
    const types = await value(data.taskTypes.list())
    expect(types.map((t) => [t.kind, t.storyPointsRequirement])).toEqual([
      ['task', 'required'],
      ['code_review', 'optional'],
      ['pair_programming', 'optional'],
      ['additional_work', 'optional'],
      ['meeting', 'hidden'],
    ])
    expect(
      (await value(data.statuses.list())).filter((s) => s.isDefault),
    ).toHaveLength(1)
    expect((await value(data.spScale.get())).map((s) => s.points)).toEqual([
      0.5, 1, 2, 3, 5, 8, 13,
    ])
    expect((await value(data.settings.get())).timezone).toBe('UTC')
    expect((await value(data.sprints.list())).length).toBeGreaterThanOrEqual(2)
  })

  it('enforces the Free plan limit on custom work types', async () => {
    const base = (await value(data.taskTypes.list()))[1]!
    for (let i = 1; i <= 3; i++)
      await value(data.taskTypes.create({ ...base, name: `Custom ${i}` }))
    expect(
      await errorCode(data.taskTypes.create({ ...base, name: 'Custom 4' })),
    ).toBe('plan.limit_custom_types')
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

  it('protects default and system statuses', async () => {
    const statuses = await value(data.statuses.list())
    const def = statuses.find((s) => s.isDefault)!
    expect(await errorCode(data.statuses.setArchived(def.id, true))).toMatch(
      /^status\./,
    )
    const created = await value(
      data.statuses.create({
        name: 'Blocked',
        category: 'in_progress',
        color: '#E5603B',
      }),
    )
    await value(data.statuses.setDefault(created.id))
    const after = await value(data.statuses.list())
    expect(after.filter((s) => s.isDefault).map((s) => s.id)).toEqual([
      created.id,
    ])
    const reordered = await value(
      data.statuses.reorder([...after].reverse().map((s) => s.id)),
    )
    expect(reordered[0]!.id).toBe(after.at(-1)!.id)
  })

  it('rejects overlapping and inverted sprints', async () => {
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

  it('stores time goals per kind of work on a sprint', async () => {
    await value(data.sprints.setCadence(null))
    const [type] = await value(data.taskTypes.list())
    const input = {
      name: 'Goals',
      goal: null,
      startsOn: '2031-03-01',
      endsOn: '2031-03-14',
      capacityStoryPoints: null,
      timeGoals: [{ taskTypeId: type!.id, minutes: 360 }],
    }
    const created = await value(data.sprints.create(input))
    expect(created.timeGoals).toEqual([{ taskTypeId: type!.id, minutes: 360 }])
    const updated = await value(
      data.sprints.update(created.id, { ...input, timeGoals: [] }),
    )
    expect(updated.timeGoals).toEqual([])

    // Cudzy albo nieistniejący rodzaj pracy, ten sam rodzaj dwa razy, zero minut: odrzucone.
    for (const timeGoals of [
      [{ taskTypeId: crypto.randomUUID(), minutes: 60 }],
      [
        { taskTypeId: type!.id, minutes: 60 },
        { taskTypeId: type!.id, minutes: 90 },
      ],
      [{ taskTypeId: type!.id, minutes: 0 }],
    ])
      expect(
        await errorCode(
          data.sprints.update(created.id, { ...input, timeGoals }),
        ),
      ).toBe('validation.invalid')
  })

  it('does not delete sprints that the cadence recreates', async () => {
    await value(
      data.sprints.setCadence({
        lengthDays: 14,
        anchorDate: '2026-01-05',
        namePattern: 'Sprint {n}',
        autoCreate: true,
      }),
    )
    const sprints = await value(data.sprints.list())
    const fromCadence = sprints.find((s) => s.fromCadence)!
    expect(fromCadence.name).toBe('Sprint 1')
    expect(await errorCode(data.sprints.remove(fromCadence.id))).toBe(
      'sprint.cadence_delete',
    )
  })

  it('keeps hotkeys unique and projects keyed', async () => {
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

  it('stores a recurring template with its own time per day', async () => {
    const type = (await value(data.taskTypes.list()))[0]!
    const input = {
      label: 'Daily',
      taskTypeId: type.id,
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
    }
    const created = await value(data.templates.create(input))
    // Zapisane w kolejności dni tygodnia.
    expect(created.schedule).toEqual([
      { day: 1, time: '10:00' },
      { day: 2, time: '09:30' },
    ])
    const listed = await value(data.templates.list())
    expect(listed.find((x) => x.id === created.id)!.schedule).toHaveLength(2)

    // Powtarzane spotkanie bez czasu trwania, dzień dwa razy, zła godzina: odrzucone.
    for (const bad of [
      { ...input, defaultDurationMinutes: null },
      {
        ...input,
        schedule: [
          { day: 1, time: '10:00' },
          { day: 1, time: '11:00' },
        ],
      },
      { ...input, schedule: [{ day: 7, time: '10:00' }] },
      { ...input, schedule: [{ day: 1, time: '25:00' }] },
    ])
      expect(await errorCode(data.templates.create(bad))).toBe(
        'validation.invalid',
      )
  })

  it('stores an any-project template without a fixed project', async () => {
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

  it('validates the story point scale', async () => {
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
    expect(saved.map((s) => s.points)).toEqual([2, 3])
  })

  it('stores overtime with its description and rejects invalid overtime', async () => {
    const types = await value(data.taskTypes.list())
    const extra = types.find((t) => t.kind === 'additional_work')!
    const input = {
      taskTypeId: extra.id,
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
    }
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

    for (const bad of [
      { overtimeMinutes: 151 },
      { overtimeNote: null },
      { overtimeNote: ' ' },
      { overtimeMinutes: 0 },
      { overtimeMinutes: null, overtimeNote: 'Orphan note' },
    ])
      expect(await errorCode(data.entries.create({ ...input, ...bad }))).toBe(
        'validation.invalid',
      )
    // Działający timer nie ma jeszcze czasu, więc nie ma też nadgodzin.
    expect(
      await errorCode(
        data.entries.create({
          ...input,
          workDate: '2026-11-01',
          startTime: '06:00',
          endTime: null,
          durationMinutes: 0,
          running: true,
        }),
      ),
    ).toBe('validation.invalid')
  })

  it('stores entries with notes, SP rules per work type and ranges', async () => {
    const types = await value(data.taskTypes.list())
    const review = types.find((t) => t.kind === 'code_review')!
    const meeting = types.find((t) => t.kind === 'meeting')!
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
      (await value(data.entries.list('2026-11-02'))).map((e) => e.id),
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
    expect(range.map((e) => e.title)).toEqual(['CR !481', 'Planning'])
    const task = await value(data.entries.forTask(created))
    expect(task.map((e) => e.id)).toEqual([created.id])
    await value(data.entries.remove(created.id))
    expect(await errorCode(data.entries.remove(created.id))).toBe('not_found')
  })

  it('runs one timer at a time and stops it on demand', async () => {
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

  it('pauses a task when you switch, then resumes it as a new interval', async () => {
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
    const a = await value(
      data.entries.start({
        ...base,
        title: 'PAY-142 Gateway',
        link: 'https://acme.atlassian.net/browse/PAY-142',
      }),
    )
    // Nagłe zadanie: A zostaje wstrzymane, nie zamknięte.
    const b = await value(
      data.entries.start({ ...base, title: 'Hotfix', link: null }),
    )
    expect(b.stopped).toMatchObject({
      id: a.started.id,
      running: false,
      paused: true,
    })
    expect((await value(data.entries.paused())).map((e) => e.title)).toEqual([
      'PAY-142 Gateway',
    ])

    // Koniec B: zwykły stop, B nie trafia do wstrzymanych.
    const doneB = await value(data.entries.stop(b.started.id))
    expect(doneB.paused).toBe(false)
    expect((await value(data.entries.paused())).map((e) => e.title)).toEqual([
      'PAY-142 Gateway',
    ])

    // Powrót do A: nowa sesja (nowy odcinek), A znika z wstrzymanych.
    const resumed = await value(data.entries.resume(a.started.id))
    expect(resumed.stopped).toBeNull()
    expect(resumed.started).toMatchObject({
      title: 'PAY-142 Gateway',
      link: 'https://acme.atlassian.net/browse/PAY-142',
      storyPoints: 3,
      running: true,
    })
    expect(resumed.started.id).not.toBe(a.started.id)
    expect(await value(data.entries.paused())).toEqual([])
    const day = await value(data.entries.list(today))
    expect(day.filter((e) => e.title === 'PAY-142 Gateway')).toHaveLength(2)

    // Ręczna przerwa i „Gotowe”.
    const pausedA = await value(data.entries.pause(resumed.started.id))
    expect(pausedA).toMatchObject({ running: false, paused: true })
    expect(await value(data.entries.running())).toBeNull()
    await value(data.entries.dismiss(pausedA.id))
    expect(await value(data.entries.paused())).toEqual([])
  })

  it('keeps every account’s data private', async () => {
    const mine = (await value(data.taskTypes.list()))[0]!
    // Drugie konto nie widzi ani nie zmienia cudzych danych.
    jar.clear()
    const other = await value(
      data.auth.register({
        username: `other${stamp}${n}`,
        email: `other${stamp}${n}@example.com`,
        password: 'correct horse 1',
        locale: 'pl',
      }),
    )
    setAccessToken(other.accessToken)
    expect(
      (await value(data.taskTypes.list())).some((t) => t.id === mine.id),
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

  it('updates profile, changes the password and deletes the account', async () => {
    const user = await value(
      data.account.updateProfile({
        displayName: 'Ada',
        email: `ada${stamp}${n}@example.com`,
      }),
    )
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
    expect(await errorCode(data.account.deleteAccount('correct horse 1'))).toBe(
      'auth.wrong_password',
    )
    await value(data.account.deleteAccount('another horse 2'))
    expect(await errorCode(data.account.me())).toBe('auth.no_session')
  })
})
