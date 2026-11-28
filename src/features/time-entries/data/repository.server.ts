import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
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

import { database } from '#/server/db/client'

import type { Tx } from '#/server/db/client'

import * as schema from '#/server/db/schema'

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

export type Row = typeof schema.timeEntries.$inferSelect

export interface TaskRef {
  link: string | null
  taskTypeId: string
  title: string
}

export async function userTimezone(
  transaction: Tx,
  scope: Pick<Scope, 'userId'>,
) {
  const [userSetting] = await transaction
    .select({ timezone: schema.userSettings.timezone })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, scope.userId))
  return userSetting?.timezone ?? 'UTC'
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
  transaction: Tx,
  scope: Scope,
  input: TimeEntryInput,
  timezone: string,
) {
  const type = await ownTaskType(transaction, scope, input.taskTypeId)
  if (!type) throw new ApiError('type.unknown', 400, 'taskTypeId')
  const isForeignProject =
    input.projectId && !(await ownProject(transaction, scope, input.projectId))
  if (isForeignProject) throw invalid('projectId')
  const issue = validateEntry(input, type)[0]
  if (issue) throw invalid(issue.field)
  // Wpisy dopisuje się za dziś i za dni, które minęły; przyszłość nie ma jeszcze przepracowanego czasu.
  const isFutureDate = input.workDate > todayIn(timezone)
  if (isFutureDate) throw invalid('workDate')
  const startsInFuture =
    input.running &&
    input.startTime &&
    isFutureStart(input.startTime, nowTimeIn(timezone))
  if (startsInFuture) throw invalid('time')
}

export const mine = (scope: Scope) => inScope(schema.timeEntries, scope)

/**
 * Nowy wpis: timer działa tylko dziś, a plan Free dopisuje wpisy z ostatnich 30 dni
 * (tyle historii widać w raportach Free). Edycja starszych wpisów zostaje możliwa.
 */
export async function checkNewEntryDate(
  transaction: Tx,
  scope: Scope,
  input: TimeEntryInput,
  timezone: string,
) {
  const today = todayIn(timezone)
  const runsOnOtherDay = input.running && input.workDate !== today
  if (runsOnOtherDay) throw invalid('workDate')
  const oldest = addDays(today, -(FREE_LIMITS.historyDays - 1))
  const isWithinHistory = input.workDate >= oldest
  if (isWithinHistory) return
  const [user] = await transaction
    .select({ plan: schema.users.plan, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, scope.userId))
  const isFreePlan = !hasProAccess(user)
  if (isFreePlan) throw new ApiError('plan.limit_history', 403, 'workDate')
}

/** Wpisy tego samego zadania — to samo co sameTask(): ten sam link, a bez linku typ i tytuł. */
export function sameTaskAs(ref: TaskRef) {
  const link = ref.link?.trim()
  return link
    ? eq(schema.timeEntries.link, link)
    : and(
        isNull(schema.timeEntries.link),
        eq(schema.timeEntries.taskTypeId, ref.taskTypeId),
        eq(
          sql`lower(trim(${schema.timeEntries.title}))`,
          ref.title.trim().toLowerCase(),
        ),
      )
}

/**
 * Zatrzymuje działający timer (poza `exceptId`); w bazie pilnuje tego unikalny indeks.
 * Start innego zadania przerywa bieżące, więc zostaje ono wstrzymane i czeka na „Wznów”.
 */
export async function stopRunning(
  transaction: Tx,
  scope: Scope,
  timezone: string,
  exceptId?: string,
) {
  const [running] = await transaction
    .select()
    .from(schema.timeEntries)
    // Jeden timer na konto: start w jednej przestrzeni wstrzymuje zadanie z innej.
    .where(
      and(
        eq(schema.timeEntries.userId, scope.userId),
        eq(schema.timeEntries.running, true),
      ),
    )
    .for('update')
  const isFree = !running || running.id === exceptId
  if (isFree) return null
  return stop(transaction, running, timezone, true)
}

export async function stop(
  transaction: Tx,
  entry: Row,
  timezone: string,
  paused = false,
) {
  const values = stoppedValues(
    { ...entry, startedAt: entry.startedAt?.toISOString() ?? null },
    todayIn(timezone),
    nowTimeIn(timezone),
  )
  const [stopped] = await transaction
    .update(schema.timeEntries)
    .set({ ...values, startedAt: entry.startedAt, paused })
    .where(eq(schema.timeEntries.id, entry.id))
    .returning()
  return stopped!
}

/** Oznacza zadanie (wszystkie sesje) jako zakończone albo otwiera je z powrotem. */
export async function setFinished(
  transaction: Tx,
  scope: Scope,
  ref: TaskRef,
  finished: boolean,
) {
  const rows = await transaction
    .update(schema.timeEntries)
    .set({ finishedAt: finished ? new Date() : null })
    .where(and(mine(scope), sameTaskAs(ref)))
    .returning({ id: schema.timeEntries.id })
  if (finished) await clearPaused(transaction, scope, ref)
  return rows.length
}

/** Zadanie znowu ruszyło albo jest skończone: znika z listy wstrzymanych. */
export async function clearPaused(transaction: Tx, scope: Scope, ref: TaskRef) {
  await transaction
    .update(schema.timeEntries)
    .set({ paused: false })
    .where(
      and(mine(scope), eq(schema.timeEntries.paused, true), sameTaskAs(ref)),
    )
}

/** Godzina startu bez zmian = ten sam moment; nowa godzina = przeliczamy od „teraz”. */
export function timerStart(
  input: TimeEntryInput,
  previous: Row | null,
  timezone: string,
) {
  const { startTime } = input
  const isNotTimer = !input.running || !startTime
  if (isNotTimer) return null
  const isSameTimer = previous?.running && previous.startTime === startTime
  if (isSameTimer) return previous.startedAt
  return new Date(startedAtFor(startTime, nowTimeIn(timezone)))
}

export async function ownEntry(transaction: Tx, scope: Scope, id: string) {
  const [entry] = await transaction
    .select()
    .from(schema.timeEntries)
    .where(and(eq(schema.timeEntries.id, id), mine(scope)))
    .for('update')
  if (!entry) throw notFound()
  return entry
}

/** Nowy działający wpis; poprzedni timer zostaje wstrzymany, a to zadanie znika z wstrzymanych. */
export async function startTimer(
  transaction: Tx,
  scope: Scope,
  input: TimeEntryInput,
  timezone: string,
) {
  await check(transaction, scope, input, timezone)
  await checkNewEntryDate(transaction, scope, input, timezone)
  const stopped = await stopRunning(transaction, scope, timezone)
  const values = clean(input)
  await clearPaused(transaction, scope, values)
  // Nowa sesja = praca trwa dalej, więc zakończone zadanie znów jest w toku.
  await setFinished(transaction, scope, values, false)
  const [started] = await transaction
    .insert(schema.timeEntries)
    .values({
      ...values,
      ...owner(scope),
      startedAt: timerStart(input, null, timezone),
    })
    .returning()
  return { started: started!, stopped }
}

export interface TimerRows {
  started: Row
  stopped: Row | null
}

export const timerResult = (timerRows: TimerRows) => ({
  started: toEntry(timerRows.started),
  stopped: timerRows.stopped ? toEntry(timerRows.stopped) : null,
})

/** Wpisy z jednego dnia, najnowsze najpierw (świeży wpis jest na górze listy). */
export const entriesOn = (transaction: Tx, scope: Scope, date: string) =>
  transaction
    .select()
    .from(schema.timeEntries)
    .where(and(mine(scope), eq(schema.timeEntries.workDate, date)))
    .orderBy(desc(schema.timeEntries.createdAt))

/** Wstrzymane danego dnia: jedna pozycja na zadanie, najświeższe najpierw, najwyżej 5. */
export async function pausedOn(transaction: Tx, scope: Scope, date: string) {
  const rows = await transaction
    .select()
    .from(schema.timeEntries)
    .where(
      and(
        mine(scope),
        eq(schema.timeEntries.paused, true),
        eq(schema.timeEntries.running, false),
        eq(schema.timeEntries.workDate, date),
      ),
    )
    .orderBy(desc(schema.timeEntries.updatedAt))
  const seen = new Set<string>()
  return rows
    .filter((row) => {
      const key = taskGroupKey(row)
      const isDuplicate = seen.has(key)
      if (isDuplicate) return false
      seen.add(key)
      return true
    })
    .slice(0, 5)
}

/**
 * Wznów: nowa sesja (nowy odcinek czasu) z tym samym tytułem, linkiem, typem, projektem i SP.
 * Działający timer innego zadania zostaje wstrzymany. Używa tego też koniec przerwy.
 */
export async function resumeEntry(transaction: Tx, account: Scope, id: string) {
  // Koniec przerwy może wznowić zadanie z innej przestrzeni: liczy się przestrzeń wpisu.
  const [found] = await transaction
    .select({ workspaceId: schema.timeEntries.workspaceId })
    .from(schema.timeEntries)
    .where(
      and(
        eq(schema.timeEntries.id, id),
        eq(schema.timeEntries.userId, account.userId),
      ),
    )
  if (!found) throw notFound()
  const scope = { userId: account.userId, workspaceId: found.workspaceId }
  const entry = await ownEntry(transaction, scope, id)
  if (entry.running) return { started: entry, stopped: null }
  const timezone = await userTimezone(transaction, scope)
  const type = await ownTaskType(transaction, scope, entry.taskTypeId)
  return startTimer(
    transaction,
    scope,
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

export async function getRunningEntry(scope: Scope) {
  const [row] = await database
    .select()
    .from(schema.timeEntries)
    .where(and(mine(scope), eq(schema.timeEntries.running, true)))
  return row ? toEntry(row) : null
}

/** Wstrzymane dziś zadania (jedna pozycja na zadanie, najświeższe najpierw, najwyżej 5). */
export async function getPausedToday(scope: Scope) {
  const today = todayIn(await userTimezone(database, scope))
  return (await pausedOn(database, scope, today)).map(toEntry)
}

/**
 * Wyszukiwarka palety poleceń: cała historia, tytuł, link i notatki (także nadgodzin
 * i przedłużeń), każde słowo osobno. Filtr w SQL (ILIKE po kolumnach użytkownika),
 * ranking i fragment notatki w domenie.
 */
export async function searchAll(scope: Scope, query: string) {
  const words = searchWords(query).filter(
    (searchWord) => searchWord.length >= 2,
  )
  const hasNoWords = words.length === 0
  if (hasNoWords) return []
  const anyField = (word: string) => {
    const pattern = likePattern(word)
    return or(
      ilike(schema.timeEntries.title, pattern),
      ilike(schema.timeEntries.link, pattern),
      ilike(schema.timeEntries.note, pattern),
      ilike(schema.timeEntries.overtimeNote, pattern),
      ilike(schema.timeEntries.extensionNote, pattern),
    )
  }
  // Sesje, w których występuje którekolwiek słowo; pełne dopasowanie (wszystkie słowa
  // w obrębie zadania, także rozłożone na kilka sesji) sprawdza domena.
  const hits = await database
    .select({
      title: schema.timeEntries.title,
      link: schema.timeEntries.link,
      taskTypeId: schema.timeEntries.taskTypeId,
    })
    .from(schema.timeEntries)
    .where(and(mine(scope), or(...words.map(anyField))))
    .orderBy(desc(schema.timeEntries.workDate))
    .limit(400)
  const hasNoHits = hits.length === 0
  if (hasNoHits) return []
  // Wszystkie sesje trafionych zadań (po tytule albo linku), żeby policzyć czas i sesje.
  const titles = [...new Set(hits.map((hit) => hit.title))].slice(0, 100)
  const links = [
    ...new Set(hits.flatMap((hit) => (hit.link ? [hit.link] : []))),
  ].slice(0, 100)
  const rows = await database
    .select()
    .from(schema.timeEntries)
    .where(
      and(
        mine(scope),
        links.length
          ? or(
              inArray(schema.timeEntries.title, titles),
              inArray(schema.timeEntries.link, links),
            )
          : inArray(schema.timeEntries.title, titles),
      ),
    )
    .orderBy(
      desc(schema.timeEntries.workDate),
      desc(schema.timeEntries.createdAt),
    )
    .limit(2000)
  return rankSearchResults(rows.map(toEntry), query)
}

/** Wyszukiwarka zadań (także zakończonych) po tytule albo linku, do kontynuacji pracy. */
export async function searchTasks(scope: Scope, pattern: string) {
  const rows = await database
    .select()
    .from(schema.timeEntries)
    .where(
      and(
        mine(scope),
        or(
          ilike(schema.timeEntries.title, pattern),
          ilike(schema.timeEntries.link, pattern),
        ),
      ),
    )
    .orderBy(
      desc(schema.timeEntries.workDate),
      desc(schema.timeEntries.createdAt),
    )
    .limit(500)
  return groupSearchResults(rows.map(toEntry))
}

export async function getUnfinishedTasks(scope: Scope) {
  const today = todayIn(await userTimezone(database, scope))
  const recent = await database
    .selectDistinct({
      link: schema.timeEntries.link,
      title: schema.timeEntries.title,
      taskTypeId: schema.timeEntries.taskTypeId,
    })
    .from(schema.timeEntries)
    .where(
      and(
        mine(scope),
        gte(
          schema.timeEntries.workDate,
          addDays(today, -UNFINISHED_LOOKBACK_DAYS),
        ),
      ),
    )
  const hasNoRecent = recent.length === 0
  if (hasNoRecent) return []
  // Całe zadania (także sesje sprzed okna), żeby suma czasu i znacznik „zakończone” były pełne.
  const rows = await database
    .select()
    .from(schema.timeEntries)
    .where(
      and(
        mine(scope),
        sql`(${sql.join(
          recent.map((recentEntry) => sql`(${sameTaskAs(recentEntry)})`),
          sql` or `,
        )})`,
      ),
    )
  const types = await database
    .select({ id: schema.taskTypes.id, kind: schema.taskTypes.kind })
    .from(schema.taskTypes)
    .where(inScope(schema.taskTypes, scope))
  const kinds = new Map(types.map((type) => [type.id, type.kind]))
  return unfinishedTasks(rows.map(toEntry), today, (id) => kinds.get(id))
}

/** Zadanie zakończone (`finished: true`) albo z powrotem w toku. */
export async function finishTask(
  scope: Scope,
  input: z.infer<typeof taskFinishInput>,
) {
  const updated = await database.transaction((transaction) =>
    setFinished(transaction, scope, input.ref, input.finished),
  )
  const isNotFound = updated === 0
  if (isNotFound) throw notFound()
  return { updated }
}

export async function getTaskSessions(
  scope: Scope,
  ref: z.infer<typeof taskRefInput>,
) {
  const rows = await database
    .select()
    .from(schema.timeEntries)
    .where(
      and(
        mine(scope),
        eq(schema.timeEntries.running, false),
        sameTaskAs({ ...ref, link: ref.link ?? null }),
      ),
    )
    .orderBy(
      asc(schema.timeEntries.workDate),
      asc(schema.timeEntries.createdAt),
    )
  return rows.map(toEntry)
}

export async function createEntry(
  scope: Scope,
  input: z.infer<typeof entryInput>,
) {
  const row = await database.transaction(async (transaction) => {
    const timezone = await userTimezone(transaction, scope)
    if (input.running)
      return (await startTimer(transaction, scope, input, timezone)).started
    await check(transaction, scope, input, timezone)
    await checkNewEntryDate(transaction, scope, input, timezone)
    const [created] = await transaction
      .insert(schema.timeEntries)
      .values({ ...clean(input), ...owner(scope), startedAt: null })
      .returning()
    return created!
  })
  return toEntry(row)
}

export async function startTimerFor(scope: Scope, input: TimeEntryInput) {
  const result = await database.transaction(async (transaction) =>
    startTimer(
      transaction,
      scope,
      input,
      await userTimezone(transaction, scope),
    ),
  )
  return timerResult(result)
}

/** Koniec pracy nad zadaniem: zatrzymany wpis nie trafia do wstrzymanych. */
export async function stopEntry(scope: Scope, id: string) {
  const row = await database.transaction(async (transaction) => {
    const entry = await ownEntry(transaction, scope, id)
    if (!entry.running) return entry
    return stop(transaction, entry, await userTimezone(transaction, scope))
  })
  return toEntry(row)
}

/** Przerwa: sesja się kończy, a zadanie czeka na pasku z przyciskiem „Wznów”. */
export async function pauseEntry(scope: Scope, id: string) {
  const row = await database.transaction(async (transaction) => {
    const entry = await ownEntry(transaction, scope, id)
    if (!entry.running) return entry
    return stop(
      transaction,
      entry,
      await userTimezone(transaction, scope),
      true,
    )
  })
  return toEntry(row)
}

/**
 * Wznów: nowa sesja (nowy odcinek czasu) z tym samym tytułem, linkiem, typem, projektem i SP.
 * Działający timer innego zadania zostaje wstrzymany, więc można swobodnie skakać między zadaniami.
 */
export async function resumeTask(scope: Scope, id: string) {
  const result = await database.transaction((transaction) =>
    resumeEntry(transaction, scope, id),
  )
  return timerResult(result)
}

/** Zadanie skończone: znika z paska wstrzymanych (zalogowany czas zostaje). */
export async function dismissPaused(scope: Scope, id: string) {
  await database.transaction(async (transaction) => {
    const entry = await ownEntry(transaction, scope, id)
    await setFinished(transaction, scope, entry, true)
  })
  return
}

/**
 * Edycja zadania z raportu: tytuł, link, projekt i SP zmieniają się we wszystkich wpisach
 * zadania naraz (zadanie = wpisy z tym samym linkiem, a bez linku z tym samym typem i tytułem).
 */
export async function deleteTask(
  scope: Scope,
  input: z.infer<typeof taskDeleteInput>,
) {
  const deleted = await database
    .delete(schema.timeEntries)
    .where(
      and(
        mine(scope),
        sameTaskAs(input.ref),
        ...(input.date ? [eq(schema.timeEntries.workDate, input.date)] : []),
      ),
    )
    .returning({ id: schema.timeEntries.id })
  const isNotFound = deleted.length === 0
  if (isNotFound) throw notFound()
  return { deleted: deleted.length }
}

export async function updateTask(
  scope: Scope,
  input: z.infer<typeof taskUpdateInput>,
) {
  const rows = await database.transaction(async (transaction) => {
    const timezone = await userTimezone(transaction, scope)
    const found = await transaction
      .select()
      .from(schema.timeEntries)
      .where(and(mine(scope), sameTaskAs(input.ref)))
    const isNotFound = found.length === 0
    if (isNotFound) throw notFound()
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
      await check(transaction, scope, next, timezone)
      const cleaned = clean(next)
      const [saved] = await transaction
        .update(schema.timeEntries)
        .set({
          title: cleaned.title,
          link: cleaned.link,
          projectId: cleaned.projectId,
          storyPoints: cleaned.storyPoints,
          estimateMinutes: cleaned.estimateMinutes,
        })
        .where(eq(schema.timeEntries.id, row.id))
        .returning()
      updated.push(saved!)
    }
    return updated
  })
  return rows
    .sort((left, right) =>
      (left.workDate + (left.startTime ?? '')).localeCompare(
        right.workDate + (right.startTime ?? ''),
      ),
    )
    .map(toEntry)
}

/** Sama notatka (np. odhaczony checkbox na liście), bez walidacji całego wpisu. */
export async function updateNote(
  scope: Scope,
  id: string,
  note: string | null,
) {
  const row = await database.transaction(async (transaction) => {
    const entry = await ownEntry(transaction, scope, id)
    if (!note) {
      const [type] = await transaction
        .select({ req: schema.taskTypes.descriptionRequirement })
        .from(schema.taskTypes)
        .where(eq(schema.taskTypes.id, entry.taskTypeId))
      const requiresStoryPoints = type?.req === 'required'
      if (requiresStoryPoints) throw invalid('note')
    }
    const [updated] = await transaction
      .update(schema.timeEntries)
      .set({ note })
      .where(eq(schema.timeEntries.id, entry.id))
      .returning()
    return updated!
  })
  return toEntry(row)
}

export async function updateEntry(
  scope: Scope,
  id: string,
  input: z.infer<typeof entryInput>,
) {
  const row = await database.transaction(async (transaction) => {
    const entry = await ownEntry(transaction, scope, id)
    const timezone = await userTimezone(transaction, scope)
    await check(transaction, scope, input, timezone)
    if (input.running) await stopRunning(transaction, scope, timezone, id)
    const [updated] = await transaction
      .update(schema.timeEntries)
      .set({
        ...clean(input),
        startedAt: timerStart(input, entry, timezone),
        // Edycja działającego wpisu nie zmienia wstrzymania; zatrzymanie w formularzu je kończy.
        paused: input.running ? false : entry.paused && !entry.running,
      })
      .where(eq(schema.timeEntries.id, id))
      .returning()
    return updated!
  })
  return toEntry(row)
}

export async function deleteEntry(scope: Scope, id: string) {
  const [row] = await database
    .delete(schema.timeEntries)
    .where(and(eq(schema.timeEntries.id, id), mine(scope)))
    .returning({ id: schema.timeEntries.id })
  if (!row) throw notFound()
  return
}

/** Wpisy z jednego dnia, od najnowszych. */
export async function listEntriesOn(scope: Scope, date: string) {
  return (await entriesOn(database, scope, date)).map(toEntry)
}

/**
 * Wpisy z zakresu dni (raporty). Plan Free widzi tylko ostatnie dni z FREE_LIMITS
 * (jak w cenniku): pilnowane tutaj, nie tylko w interfejsie.
 */
export async function listEntriesInRange(
  scope: Scope,
  requestedFrom: string,
  to: string,
) {
  const [user] = await database
    .select({ plan: schema.users.plan, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, scope.userId))
  const oldest = addDays(
    todayIn(await userTimezone(database, scope)),
    -(FREE_LIMITS.historyDays - 1),
  )
  const from =
    !hasProAccess(user) && requestedFrom < oldest ? oldest : requestedFrom
  const isReversedRange = to < from
  if (isReversedRange) return []
  const rows = await database
    .select()
    .from(schema.timeEntries)
    .where(
      and(
        mine(scope),
        gte(schema.timeEntries.workDate, from),
        lte(schema.timeEntries.workDate, to),
      ),
    )
    .orderBy(
      asc(schema.timeEntries.workDate),
      asc(schema.timeEntries.createdAt),
    )
  return rows.map(toEntry)
}
