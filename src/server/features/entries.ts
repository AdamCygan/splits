import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { TimeEntryInput } from '#/data/types'
import { addDays, nowTimeIn, todayIn } from '#/domain/dates'
import {
  isFutureStart,
  startedAtFor,
  stoppedValues,
  validateEntry,
} from '#/domain/entries'
import { spForType, taskGroupKey } from '#/domain/report'
import { UNFINISHED_LOOKBACK_DAYS, unfinishedTasks } from '#/domain/unfinished'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/plans'
import { db } from '../db/client'
import type { Tx } from '../db/client'
import * as t from '../db/schema'
import type { AppEnv } from '../http/context'
import { ApiError, invalid, notFound } from '../http/errors'
import {
  body,
  dateQuery,
  entryInput,
  parse,
  rangeQuery,
  taskRefInput,
  taskUpdateInput,
  taskDeleteInput,
  taskFinishInput,
  timerInput,
} from '../http/inputs'
import { ownProject, ownTaskType } from './config'
import { toEntry } from './dto'

type Row = typeof t.timeEntries.$inferSelect
type TaskRef = { link: string | null; taskTypeId: string; title: string }

export async function userTimezone(tx: Tx, userId: string) {
  const [s] = await tx
    .select({ timezone: t.userSettings.timezone })
    .from(t.userSettings)
    .where(eq(t.userSettings.userId, userId))
  return s?.timezone ?? 'UTC'
}

/** Puste teksty zapisujemy jako null. */
const clean = (input: TimeEntryInput) => ({
  ...input,
  title: input.title.trim(),
  link: input.link?.trim() || null,
  note: input.note?.trim() ? input.note.trimEnd() : null,
  overtimeMinutes: input.overtimeMinutes,
  overtimeNote:
    input.overtimeMinutes === null
      ? null
      : (input.overtimeNote?.trim() ?? null),
  estimateMinutes: input.estimateMinutes ?? null,
  extensionMinutes: input.extensionMinutes ?? null,
  extensionNote:
    (input.extensionMinutes ?? null) === null
      ? null
      : (input.extensionNote?.trim() ?? null),
})

/** Te same reguły co formularz (validateEntry) plus własność typu i projektu. */
async function check(
  tx: Tx,
  userId: string,
  input: TimeEntryInput,
  timezone: string,
) {
  const type = await ownTaskType(tx, userId, input.taskTypeId)
  if (!type) throw new ApiError('type.unknown', 400, 'taskTypeId')
  if (input.projectId && !(await ownProject(tx, userId, input.projectId)))
    throw invalid('projectId')
  const issue = validateEntry(input, type)[0]
  if (issue) throw invalid(issue.field)
  // Wpisy dopisuje się za dziś i za dni, które minęły; przyszłość nie ma jeszcze przepracowanego czasu.
  if (input.workDate > todayIn(timezone)) throw invalid('workDate')
  if (
    input.running &&
    input.startTime &&
    isFutureStart(input.startTime, nowTimeIn(timezone))
  )
    throw invalid('time')
}

const mine = (userId: string) => eq(t.timeEntries.userId, userId)

/**
 * Nowy wpis: timer działa tylko dziś, a plan Free dopisuje wpisy z ostatnich 30 dni
 * (tyle historii widać w raportach Free). Edycja starszych wpisów zostaje możliwa.
 */
async function checkNewEntryDate(
  tx: Tx,
  userId: string,
  input: TimeEntryInput,
  timezone: string,
) {
  const today = todayIn(timezone)
  if (input.running && input.workDate !== today) throw invalid('workDate')
  const oldest = addDays(today, -(FREE_LIMITS.historyDays - 1))
  if (input.workDate >= oldest) return
  const [user] = await tx
    .select({ plan: t.users.plan, role: t.users.role })
    .from(t.users)
    .where(eq(t.users.id, userId))
  if (!hasProAccess(user))
    throw new ApiError('plan.limit_history', 403, 'workDate')
}

/** Wpisy tego samego zadania — to samo co sameTask(): ten sam link, a bez linku typ i tytuł. */
function sameTaskAs(ref: TaskRef) {
  const link = ref.link?.trim()
  return link
    ? eq(t.timeEntries.link, link)
    : and(
        isNull(t.timeEntries.link),
        eq(t.timeEntries.taskTypeId, ref.taskTypeId),
        eq(
          sql`lower(trim(${t.timeEntries.title}))`,
          ref.title.trim().toLowerCase(),
        ),
      )
}

/**
 * Zatrzymuje działający timer (poza `exceptId`); w bazie pilnuje tego unikalny indeks.
 * Start innego zadania przerywa bieżące, więc zostaje ono wstrzymane i czeka na „Wznów”.
 */
export async function stopRunning(
  tx: Tx,
  userId: string,
  timezone: string,
  exceptId?: string,
) {
  const [running] = await tx
    .select()
    .from(t.timeEntries)
    .where(and(mine(userId), eq(t.timeEntries.running, true)))
    .for('update')
  if (!running || running.id === exceptId) return null
  return stop(tx, running, timezone, true)
}

async function stop(tx: Tx, entry: Row, timezone: string, paused = false) {
  const values = stoppedValues(
    { ...entry, startedAt: entry.startedAt?.toISOString() ?? null },
    todayIn(timezone),
    nowTimeIn(timezone),
  )
  const [stopped] = await tx
    .update(t.timeEntries)
    .set({ ...values, startedAt: entry.startedAt, paused })
    .where(eq(t.timeEntries.id, entry.id))
    .returning()
  return stopped!
}

/** Oznacza zadanie (wszystkie sesje) jako zakończone albo otwiera je z powrotem. */
async function setFinished(
  tx: Tx,
  userId: string,
  ref: TaskRef,
  finished: boolean,
) {
  const rows = await tx
    .update(t.timeEntries)
    .set({ finishedAt: finished ? new Date() : null })
    .where(and(mine(userId), sameTaskAs(ref)))
    .returning({ id: t.timeEntries.id })
  if (finished) await clearPaused(tx, userId, ref)
  return rows.length
}

/** Zadanie znowu ruszyło albo jest skończone: znika z listy wstrzymanych. */
async function clearPaused(tx: Tx, userId: string, ref: TaskRef) {
  await tx
    .update(t.timeEntries)
    .set({ paused: false })
    .where(and(mine(userId), eq(t.timeEntries.paused, true), sameTaskAs(ref)))
}

/** Godzina startu bez zmian = ten sam moment; nowa godzina = przeliczamy od „teraz”. */
function timerStart(
  input: TimeEntryInput,
  previous: Row | null,
  timezone: string,
) {
  if (!input.running || !input.startTime) return null
  if (previous?.running && previous.startTime === input.startTime)
    return previous.startedAt
  return new Date(startedAtFor(input.startTime, nowTimeIn(timezone)))
}

async function ownEntry(tx: Tx, userId: string, id: string) {
  const [entry] = await tx
    .select()
    .from(t.timeEntries)
    .where(and(eq(t.timeEntries.id, id), mine(userId)))
    .for('update')
  if (!entry) throw notFound()
  return entry
}

/** Nowy działający wpis; poprzedni timer zostaje wstrzymany, a to zadanie znika z wstrzymanych. */
async function startTimer(
  tx: Tx,
  userId: string,
  input: TimeEntryInput,
  timezone: string,
) {
  await check(tx, userId, input, timezone)
  await checkNewEntryDate(tx, userId, input, timezone)
  const stopped = await stopRunning(tx, userId, timezone)
  const values = clean(input)
  await clearPaused(tx, userId, values)
  // Nowa sesja = praca trwa dalej, więc zakończone zadanie znów jest w toku.
  await setFinished(tx, userId, values, false)
  const [started] = await tx
    .insert(t.timeEntries)
    .values({
      ...values,
      userId,
      startedAt: timerStart(input, null, timezone),
    })
    .returning()
  return { started: started!, stopped }
}

const timerResult = (r: { started: Row; stopped: Row | null }) => ({
  started: toEntry(r.started),
  stopped: r.stopped ? toEntry(r.stopped) : null,
})

/** Wpisy z jednego dnia, najnowsze najpierw (świeży wpis jest na górze listy). */
export const entriesOn = (tx: Tx, userId: string, date: string) =>
  tx
    .select()
    .from(t.timeEntries)
    .where(and(mine(userId), eq(t.timeEntries.workDate, date)))
    .orderBy(desc(t.timeEntries.createdAt))

/** Wstrzymane danego dnia: jedna pozycja na zadanie, najświeższe najpierw, najwyżej 5. */
export async function pausedOn(tx: Tx, userId: string, date: string) {
  const rows = await tx
    .select()
    .from(t.timeEntries)
    .where(
      and(
        mine(userId),
        eq(t.timeEntries.paused, true),
        eq(t.timeEntries.running, false),
        eq(t.timeEntries.workDate, date),
      ),
    )
    .orderBy(desc(t.timeEntries.updatedAt))
  const seen = new Set<string>()
  return rows
    .filter((r) => {
      const key = taskGroupKey(r)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 5)
}

/**
 * Wznów: nowa sesja (nowy odcinek czasu) z tym samym tytułem, linkiem, typem, projektem i SP.
 * Działający timer innego zadania zostaje wstrzymany. Używa tego też koniec przerwy.
 */
export async function resumeEntry(tx: Tx, userId: string, id: string) {
  const entry = await ownEntry(tx, userId, id)
  if (entry.running) return { started: entry, stopped: null }
  const timezone = await userTimezone(tx, userId)
  const type = await ownTaskType(tx, userId, entry.taskTypeId)
  return startTimer(
    tx,
    userId,
    {
      taskTypeId: entry.taskTypeId,
      projectId: entry.projectId,
      title: entry.title,
      link: entry.link,
      storyPoints: spForType(type, entry.storyPoints),
      workDate: todayIn(timezone),
      startTime: nowTimeIn(timezone),
      endTime: null,
      durationMinutes: 0,
      note: null,
      // Nowa sesja zaczyna bez nadgodzin; oznaczysz je po zatrzymaniu.
      overtimeMinutes: null,
      overtimeNote: null,
      // Estymata należy do zadania: nowa sesja ją zachowuje.
      estimateMinutes: entry.estimateMinutes,
      extensionMinutes: null,
      extensionNote: null,
      running: true,
    },
    timezone,
  )
}

export const entryRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const userId = c.get('userId')
    if (c.req.query('date')) {
      const { date } = parse(dateQuery, c.req.query())
      return c.json((await entriesOn(db, userId, date)).map(toEntry))
    }
    const range = parse(rangeQuery, c.req.query())
    if (range.to < range.from) throw invalid('to')
    // Plan Free: raporty z ostatnich 30 dni (jak w cenniku) — pilnowane także tutaj, nie tylko w UI.
    const [user] = await db
      .select({ plan: t.users.plan, role: t.users.role })
      .from(t.users)
      .where(eq(t.users.id, userId))
    const oldest = addDays(
      todayIn(await userTimezone(db, userId)),
      -(FREE_LIMITS.historyDays - 1),
    )
    const from =
      !hasProAccess(user) && range.from < oldest ? oldest : range.from
    const { to } = range
    if (to < from) return c.json([])
    const rows = await db
      .select()
      .from(t.timeEntries)
      .where(
        and(
          mine(userId),
          gte(t.timeEntries.workDate, from),
          lte(t.timeEntries.workDate, to),
        ),
      )
      .orderBy(asc(t.timeEntries.workDate), asc(t.timeEntries.createdAt))
    return c.json(rows.map(toEntry))
  })

  .get('/running', async (c) => {
    const [row] = await db
      .select()
      .from(t.timeEntries)
      .where(and(mine(c.get('userId')), eq(t.timeEntries.running, true)))
    return c.json(row ? toEntry(row) : null)
  })

  /** Wstrzymane dziś zadania (jedna pozycja na zadanie, najświeższe najpierw, najwyżej 5). */
  .get('/paused', async (c) => {
    const userId = c.get('userId')
    const today = todayIn(await userTimezone(db, userId))
    return c.json((await pausedOn(db, userId, today)).map(toEntry))
  })

  /** Zadania z poprzednich dni, których nie zakończono — do kontynuacji na „Dziś”. */
  .get('/unfinished', async (c) => {
    const userId = c.get('userId')
    const today = todayIn(await userTimezone(db, userId))
    const recent = await db
      .selectDistinct({
        link: t.timeEntries.link,
        title: t.timeEntries.title,
        taskTypeId: t.timeEntries.taskTypeId,
      })
      .from(t.timeEntries)
      .where(
        and(
          mine(userId),
          gte(
            t.timeEntries.workDate,
            addDays(today, -UNFINISHED_LOOKBACK_DAYS),
          ),
        ),
      )
    if (recent.length === 0) return c.json([])
    // Całe zadania (także sesje sprzed okna), żeby suma czasu i znacznik „zakończone” były pełne.
    const rows = await db
      .select()
      .from(t.timeEntries)
      .where(
        and(
          mine(userId),
          sql`(${sql.join(
            recent.map((r) => sql`(${sameTaskAs(r)})`),
            sql` or `,
          )})`,
        ),
      )
    const types = await db
      .select({ id: t.taskTypes.id, kind: t.taskTypes.kind })
      .from(t.taskTypes)
      .where(eq(t.taskTypes.userId, userId))
    const kinds = new Map(types.map((x) => [x.id, x.kind]))
    return c.json(
      unfinishedTasks(rows.map(toEntry), today, (id) => kinds.get(id)),
    )
  })

  /** Zadanie zakończone (`finished: true`) albo z powrotem w toku. */
  .post('/task/finish', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, taskFinishInput)
    const updated = await db.transaction((tx) =>
      setFinished(tx, userId, input.ref, input.finished),
    )
    if (updated === 0) throw notFound()
    return c.json({ updated })
  })

  .get('/by-task', async (c) => {
    const ref = parse(taskRefInput, c.req.query())
    const rows = await db
      .select()
      .from(t.timeEntries)
      .where(
        and(
          mine(c.get('userId')),
          eq(t.timeEntries.running, false),
          sameTaskAs({ ...ref, link: ref.link ?? null }),
        ),
      )
      .orderBy(asc(t.timeEntries.workDate), asc(t.timeEntries.createdAt))
    return c.json(rows.map(toEntry))
  })

  .post('/', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, entryInput)
    const row = await db.transaction(async (tx) => {
      const timezone = await userTimezone(tx, userId)
      if (input.running)
        return (await startTimer(tx, userId, input, timezone)).started
      await check(tx, userId, input, timezone)
      await checkNewEntryDate(tx, userId, input, timezone)
      const [created] = await tx
        .insert(t.timeEntries)
        .values({ ...clean(input), userId, startedAt: null })
        .returning()
      return created!
    })
    return c.json(toEntry(row), 201)
  })

  .post('/timer', async (c) => {
    const userId = c.get('userId')
    const raw = await body(c, timerInput)
    const input: TimeEntryInput = {
      ...raw,
      endTime: null,
      durationMinutes: 0,
      overtimeMinutes: null,
      overtimeNote: null,
      extensionMinutes: null,
      extensionNote: null,
      running: true,
    }
    const result = await db.transaction(async (tx) =>
      startTimer(tx, userId, input, await userTimezone(tx, userId)),
    )
    return c.json(timerResult(result), 201)
  })

  /** Koniec pracy nad zadaniem: zatrzymany wpis nie trafia do wstrzymanych. */
  .post('/:id/stop', async (c) => {
    const userId = c.get('userId')
    const row = await db.transaction(async (tx) => {
      const entry = await ownEntry(tx, userId, c.req.param('id'))
      if (!entry.running) return entry
      return stop(tx, entry, await userTimezone(tx, userId))
    })
    return c.json(toEntry(row))
  })

  /** Przerwa: sesja się kończy, a zadanie czeka na pasku z przyciskiem „Wznów”. */
  .post('/:id/pause', async (c) => {
    const userId = c.get('userId')
    const row = await db.transaction(async (tx) => {
      const entry = await ownEntry(tx, userId, c.req.param('id'))
      if (!entry.running) return entry
      return stop(tx, entry, await userTimezone(tx, userId), true)
    })
    return c.json(toEntry(row))
  })

  /**
   * Wznów: nowa sesja (nowy odcinek czasu) z tym samym tytułem, linkiem, typem, projektem i SP.
   * Działający timer innego zadania zostaje wstrzymany, więc można swobodnie skakać między zadaniami.
   */
  .post('/:id/resume', async (c) => {
    const userId = c.get('userId')
    const result = await db.transaction((tx) =>
      resumeEntry(tx, userId, c.req.param('id')),
    )
    return c.json(timerResult(result), 201)
  })

  /** Zadanie skończone: znika z paska wstrzymanych (zalogowany czas zostaje). */
  .post('/:id/dismiss', async (c) => {
    const userId = c.get('userId')
    await db.transaction(async (tx) => {
      const entry = await ownEntry(tx, userId, c.req.param('id'))
      await setFinished(tx, userId, entry, true)
    })
    return c.body(null, 204)
  })

  /**
   * Edycja zadania z raportu: tytuł, link, projekt i SP zmieniają się we wszystkich wpisach
   * zadania naraz (zadanie = wpisy z tym samym linkiem, a bez linku z tym samym typem i tytułem).
   */
  /** Usuwa zadanie: wszystkie jego sesje (także trwający timer) albo tylko te z `date`. */
  .post('/task/delete', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, taskDeleteInput)
    const deleted = await db
      .delete(t.timeEntries)
      .where(
        and(
          mine(userId),
          sameTaskAs(input.ref),
          ...(input.date ? [eq(t.timeEntries.workDate, input.date)] : []),
        ),
      )
      .returning({ id: t.timeEntries.id })
    if (deleted.length === 0) throw notFound()
    return c.json({ deleted: deleted.length })
  })

  .put('/task', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, taskUpdateInput)
    const rows = await db.transaction(async (tx) => {
      const timezone = await userTimezone(tx, userId)
      const found = await tx
        .select()
        .from(t.timeEntries)
        .where(and(mine(userId), sameTaskAs(input.ref)))
      if (found.length === 0) throw notFound()
      const changes = {
        title: input.title,
        link: input.link,
        projectId: input.projectId,
        storyPoints: input.storyPoints,
        ...(input.estimateMinutes === undefined
          ? {}
          : { estimateMinutes: input.estimateMinutes }),
      }
      const updated = []
      for (const row of found) {
        const next: TimeEntryInput = { ...toEntry(row), ...changes }
        await check(tx, userId, next, timezone)
        const cleaned = clean(next)
        const [saved] = await tx
          .update(t.timeEntries)
          .set({
            title: cleaned.title,
            link: cleaned.link,
            projectId: cleaned.projectId,
            storyPoints: cleaned.storyPoints,
            estimateMinutes: cleaned.estimateMinutes,
          })
          .where(eq(t.timeEntries.id, row.id))
          .returning()
        updated.push(saved!)
      }
      return updated
    })
    return c.json(
      rows
        .sort((a, b) =>
          (a.workDate + (a.startTime ?? '')).localeCompare(
            b.workDate + (b.startTime ?? ''),
          ),
        )
        .map(toEntry),
    )
  })

  .put('/:id', async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const input = await body(c, entryInput)
    const row = await db.transaction(async (tx) => {
      const entry = await ownEntry(tx, userId, id)
      const timezone = await userTimezone(tx, userId)
      await check(tx, userId, input, timezone)
      if (input.running) await stopRunning(tx, userId, timezone, id)
      const [updated] = await tx
        .update(t.timeEntries)
        .set({
          ...clean(input),
          startedAt: timerStart(input, entry, timezone),
          // Edycja działającego wpisu nie zmienia wstrzymania; zatrzymanie w formularzu je kończy.
          paused: input.running ? false : entry.paused && !entry.running,
        })
        .where(eq(t.timeEntries.id, id))
        .returning()
      return updated!
    })
    return c.json(toEntry(row))
  })

  .delete('/:id', async (c) => {
    const [row] = await db
      .delete(t.timeEntries)
      .where(
        and(eq(t.timeEntries.id, c.req.param('id')), mine(c.get('userId'))),
      )
      .returning({ id: t.timeEntries.id })
    if (!row) throw notFound()
    return c.body(null, 204)
  })
