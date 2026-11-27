import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm'

import type { TimeEntryInput } from '#/features/time-entries/data/dto'

import { addDays, nowTimeIn, todayIn } from '#/shared/domain/dates'

import {
  isFutureStart,
  startedAtFor,
  stoppedValues,
  validateEntry,
} from '#/features/time-entries/domain/entries'

import { spForType, taskGroupKey } from '#/features/reports/domain/report'

import {
  UNFINISHED_LOOKBACK_DAYS,
  unfinishedTasks,
} from '#/features/time-entries/domain/unfinished'

import {
  groupSearchResults,
  likePattern,
  rankSearchResults,
  searchWords,
} from '#/features/tasks/domain/task-search'

import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'

import { db } from '#/server/db/client'

import type { Tx } from '#/server/db/client'

import * as t from '#/server/db/schema'

import { ApiError, invalid, notFound } from '#/server/http/errors'

import type {
  entryInput,
  taskRefInput,
  taskUpdateInput,
  taskDeleteInput,
  taskFinishInput,
} from './inputs.server'

import { ownProject } from '#/features/projects/data/repository.server'

import { ownTaskType } from '#/features/task-types/data/repository.server'

import { toEntry } from './mappers.server'

import type { z } from 'zod'

export type Row = typeof t.timeEntries.$inferSelect

export interface TaskRef {
  link: string | null
  taskTypeId: string
  title: string
}

export async function userTimezone(tx: Tx, userId: string) {
  const [s] = await tx
    .select({ timezone: t.userSettings.timezone })
    .from(t.userSettings)
    .where(eq(t.userSettings.userId, userId))
  return s?.timezone ?? 'UTC'
}

/** Puste teksty zapisujemy jako null. */
export const clean = (input: TimeEntryInput) => ({
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
export async function check(
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

export const mine = (userId: string) => eq(t.timeEntries.userId, userId)

/**
 * Nowy wpis: timer działa tylko dziś, a plan Free dopisuje wpisy z ostatnich 30 dni
 * (tyle historii widać w raportach Free). Edycja starszych wpisów zostaje możliwa.
 */
export async function checkNewEntryDate(
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
export function sameTaskAs(ref: TaskRef) {
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

export async function stop(
  tx: Tx,
  entry: Row,
  timezone: string,
  paused = false,
) {
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
export async function setFinished(
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
export async function clearPaused(tx: Tx, userId: string, ref: TaskRef) {
  await tx
    .update(t.timeEntries)
    .set({ paused: false })
    .where(and(mine(userId), eq(t.timeEntries.paused, true), sameTaskAs(ref)))
}

/** Godzina startu bez zmian = ten sam moment; nowa godzina = przeliczamy od „teraz”. */
export function timerStart(
  input: TimeEntryInput,
  previous: Row | null,
  timezone: string,
) {
  if (!input.running || !input.startTime) return null
  if (previous?.running && previous.startTime === input.startTime)
    return previous.startedAt
  return new Date(startedAtFor(input.startTime, nowTimeIn(timezone)))
}

export async function ownEntry(tx: Tx, userId: string, id: string) {
  const [entry] = await tx
    .select()
    .from(t.timeEntries)
    .where(and(eq(t.timeEntries.id, id), mine(userId)))
    .for('update')
  if (!entry) throw notFound()
  return entry
}

/** Nowy działający wpis; poprzedni timer zostaje wstrzymany, a to zadanie znika z wstrzymanych. */
export async function startTimer(
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

export interface TimerRows {
  started: Row
  stopped: Row | null
}

export const timerResult = (r: TimerRows) => ({
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

export async function getRunningEntry(userId: string) {
  const [row] = await db
    .select()
    .from(t.timeEntries)
    .where(and(mine(userId), eq(t.timeEntries.running, true)))
  return row ? toEntry(row) : null
}

/** Wstrzymane dziś zadania (jedna pozycja na zadanie, najświeższe najpierw, najwyżej 5). */
export async function getPausedToday(userId: string) {
  const today = todayIn(await userTimezone(db, userId))
  return (await pausedOn(db, userId, today)).map(toEntry)
}

/**
 * Wyszukiwarka palety poleceń: cała historia, tytuł, link i notatki (także nadgodzin
 * i przedłużeń), każde słowo osobno. Filtr w SQL (ILIKE po kolumnach użytkownika),
 * ranking i fragment notatki w domenie.
 */
export async function searchAll(userId: string, q: string) {
  const words = searchWords(q).filter((w) => w.length >= 2)
  if (words.length === 0) return []
  const anyField = (w: string) => {
    const p = likePattern(w)
    return or(
      ilike(t.timeEntries.title, p),
      ilike(t.timeEntries.link, p),
      ilike(t.timeEntries.note, p),
      ilike(t.timeEntries.overtimeNote, p),
      ilike(t.timeEntries.extensionNote, p),
    )
  }
  // Sesje, w których występuje którekolwiek słowo; pełne dopasowanie (wszystkie słowa
  // w obrębie zadania, także rozłożone na kilka sesji) sprawdza domena.
  const hits = await db
    .select({
      title: t.timeEntries.title,
      link: t.timeEntries.link,
      taskTypeId: t.timeEntries.taskTypeId,
    })
    .from(t.timeEntries)
    .where(and(mine(userId), or(...words.map(anyField))))
    .orderBy(desc(t.timeEntries.workDate))
    .limit(400)
  if (hits.length === 0) return []
  // Wszystkie sesje trafionych zadań (po tytule albo linku), żeby policzyć czas i sesje.
  const titles = [...new Set(hits.map((h) => h.title))].slice(0, 100)
  const links = [
    ...new Set(hits.flatMap((h) => (h.link ? [h.link] : []))),
  ].slice(0, 100)
  const rows = await db
    .select()
    .from(t.timeEntries)
    .where(
      and(
        mine(userId),
        links.length
          ? or(
              inArray(t.timeEntries.title, titles),
              inArray(t.timeEntries.link, links),
            )
          : inArray(t.timeEntries.title, titles),
      ),
    )
    .orderBy(desc(t.timeEntries.workDate), desc(t.timeEntries.createdAt))
    .limit(2000)
  return rankSearchResults(rows.map(toEntry), q)
}

/** Wyszukiwarka zadań (także zakończonych) po tytule albo linku, do kontynuacji pracy. */
export async function searchTasks(userId: string, pattern: string) {
  const rows = await db
    .select()
    .from(t.timeEntries)
    .where(
      and(
        mine(userId),
        or(
          ilike(t.timeEntries.title, pattern),
          ilike(t.timeEntries.link, pattern),
        ),
      ),
    )
    .orderBy(desc(t.timeEntries.workDate), desc(t.timeEntries.createdAt))
    .limit(500)
  return groupSearchResults(rows.map(toEntry))
}

export async function getUnfinishedTasks(userId: string) {
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
        gte(t.timeEntries.workDate, addDays(today, -UNFINISHED_LOOKBACK_DAYS)),
      ),
    )
  if (recent.length === 0) return []
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
  return unfinishedTasks(rows.map(toEntry), today, (id) => kinds.get(id))
}

/** Zadanie zakończone (`finished: true`) albo z powrotem w toku. */
export async function finishTask(
  userId: string,
  input: z.infer<typeof taskFinishInput>,
) {
  const updated = await db.transaction((tx) =>
    setFinished(tx, userId, input.ref, input.finished),
  )
  if (updated === 0) throw notFound()
  return { updated }
}

export async function getTaskSessions(
  userId: string,
  ref: z.infer<typeof taskRefInput>,
) {
  const rows = await db
    .select()
    .from(t.timeEntries)
    .where(
      and(
        mine(userId),
        eq(t.timeEntries.running, false),
        sameTaskAs({ ...ref, link: ref.link ?? null }),
      ),
    )
    .orderBy(asc(t.timeEntries.workDate), asc(t.timeEntries.createdAt))
  return rows.map(toEntry)
}

export async function createEntry(
  userId: string,
  input: z.infer<typeof entryInput>,
) {
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
  return toEntry(row)
}

export async function startTimerFor(userId: string, input: TimeEntryInput) {
  const result = await db.transaction(async (tx) =>
    startTimer(tx, userId, input, await userTimezone(tx, userId)),
  )
  return timerResult(result)
}

/** Koniec pracy nad zadaniem: zatrzymany wpis nie trafia do wstrzymanych. */
export async function stopEntry(userId: string, id: string) {
  const row = await db.transaction(async (tx) => {
    const entry = await ownEntry(tx, userId, id)
    if (!entry.running) return entry
    return stop(tx, entry, await userTimezone(tx, userId))
  })
  return toEntry(row)
}

/** Przerwa: sesja się kończy, a zadanie czeka na pasku z przyciskiem „Wznów”. */
export async function pauseEntry(userId: string, id: string) {
  const row = await db.transaction(async (tx) => {
    const entry = await ownEntry(tx, userId, id)
    if (!entry.running) return entry
    return stop(tx, entry, await userTimezone(tx, userId), true)
  })
  return toEntry(row)
}

/**
 * Wznów: nowa sesja (nowy odcinek czasu) z tym samym tytułem, linkiem, typem, projektem i SP.
 * Działający timer innego zadania zostaje wstrzymany, więc można swobodnie skakać między zadaniami.
 */
export async function resumeTask(userId: string, id: string) {
  const result = await db.transaction((tx) => resumeEntry(tx, userId, id))
  return timerResult(result)
}

/** Zadanie skończone: znika z paska wstrzymanych (zalogowany czas zostaje). */
export async function dismissPaused(userId: string, id: string) {
  await db.transaction(async (tx) => {
    const entry = await ownEntry(tx, userId, id)
    await setFinished(tx, userId, entry, true)
  })
  return
}

/**
 * Edycja zadania z raportu: tytuł, link, projekt i SP zmieniają się we wszystkich wpisach
 * zadania naraz (zadanie = wpisy z tym samym linkiem, a bez linku z tym samym typem i tytułem).
 */
export async function deleteTask(
  userId: string,
  input: z.infer<typeof taskDeleteInput>,
) {
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
  return { deleted: deleted.length }
}

export async function updateTask(
  userId: string,
  input: z.infer<typeof taskUpdateInput>,
) {
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
  return rows
    .sort((a, b) =>
      (a.workDate + (a.startTime ?? '')).localeCompare(
        b.workDate + (b.startTime ?? ''),
      ),
    )
    .map(toEntry)
}

/** Sama notatka (np. odhaczony checkbox na liście), bez walidacji całego wpisu. */
export async function updateNote(
  userId: string,
  id: string,
  note: string | null,
) {
  const row = await db.transaction(async (tx) => {
    const entry = await ownEntry(tx, userId, id)
    if (!note) {
      const [type] = await tx
        .select({ req: t.taskTypes.descriptionRequirement })
        .from(t.taskTypes)
        .where(eq(t.taskTypes.id, entry.taskTypeId))
      if (type?.req === 'required') throw invalid('note')
    }
    const [updated] = await tx
      .update(t.timeEntries)
      .set({ note })
      .where(eq(t.timeEntries.id, entry.id))
      .returning()
    return updated!
  })
  return toEntry(row)
}

export async function updateEntry(
  userId: string,
  id: string,
  input: z.infer<typeof entryInput>,
) {
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
  return toEntry(row)
}

export async function deleteEntry(userId: string, id: string) {
  const [row] = await db
    .delete(t.timeEntries)
    .where(and(eq(t.timeEntries.id, id), mine(userId)))
    .returning({ id: t.timeEntries.id })
  if (!row) throw notFound()
  return
}

/** Wpisy z jednego dnia, od najnowszych. */
export async function listEntriesOn(userId: string, date: string) {
  return (await entriesOn(db, userId, date)).map(toEntry)
}

/**
 * Wpisy z zakresu dni (raporty). Plan Free widzi tylko ostatnie dni z FREE_LIMITS
 * (jak w cenniku): pilnowane tutaj, nie tylko w interfejsie.
 */
export async function listEntriesInRange(
  userId: string,
  requestedFrom: string,
  to: string,
) {
  const [user] = await db
    .select({ plan: t.users.plan, role: t.users.role })
    .from(t.users)
    .where(eq(t.users.id, userId))
  const oldest = addDays(
    todayIn(await userTimezone(db, userId)),
    -(FREE_LIMITS.historyDays - 1),
  )
  const from =
    !hasProAccess(user) && requestedFrom < oldest ? oldest : requestedFrom
  if (to < from) return []
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
  return rows.map(toEntry)
}
