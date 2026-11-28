import { and, asc, eq, gte, ne } from 'drizzle-orm'
import { todayIn } from '#/shared/domain/dates'
import {
  missingCadenceSprints,
  rangesOverlap,
} from '#/features/sprints/domain/sprints'
import type { DateSpan } from '#/features/sprints/domain/sprints'
import { db } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import * as t from '#/server/db/schema'
import { ApiError, conflict, notFound } from '#/server/http/errors'
import type { z } from 'zod'
import type { cadenceInput, sprintInput } from './inputs.server'
import { toCadence, toSprint } from './mappers.server'

async function userToday(tx: Tx, userId: string) {
  const [s] = await tx
    .select({ timezone: t.userSettings.timezone })
    .from(t.userSettings)
    .where(eq(t.userSettings.userId, userId))
  return todayIn(s?.timezone ?? 'UTC')
}

export async function getCadence(tx: Tx, userId: string) {
  const [row] = await tx
    .select()
    .from(t.sprintCadences)
    .where(eq(t.sprintCadences.userId, userId))
  return toCadence(row)
}

const listSprints = (tx: Tx, userId: string) =>
  tx
    .select()
    .from(t.sprints)
    .where(eq(t.sprints.userId, userId))
    .orderBy(asc(t.sprints.startsOn))

/** Dotwarza brakujące sprinty z kadencji (bieżący i następny), jak demo i job w tle. */
export async function syncCadenceSprints(tx: Tx, userId: string) {
  const cadence = await getCadence(tx, userId)
  if (!cadence) return
  const existing = await listSprints(tx, userId)
  const missing = missingCadenceSprints(
    cadence,
    existing,
    await userToday(tx, userId),
  )
  if (!missing.length) return
  // Nowe sprinty z kadencji dziedziczą cele czasowe po ostatnim sprincie (zwykle się powtarzają).
  const timeGoals = existing.at(-1)?.timeGoals ?? []
  await tx.insert(t.sprints).values(
    missing.map((s) => ({
      ...s,
      userId,
      goal: null,
      fromCadence: true,
      timeGoals,
    })),
  )
}

/** Cele czasowe mogą dotyczyć tylko własnych rodzajów pracy. */
async function assertOwnTypes(
  tx: Tx,
  userId: string,
  goals: ReadonlyArray<{ taskTypeId: string }>,
) {
  if (goals.length === 0) return
  const own = await tx
    .select({ id: t.taskTypes.id })
    .from(t.taskTypes)
    .where(eq(t.taskTypes.userId, userId))
  const ids = new Set(own.map((x) => x.id))
  if (goals.some((g) => !ids.has(g.taskTypeId)))
    throw new ApiError('validation.invalid', 400, 'timeGoals')
}

async function assertNoOverlap(
  tx: Tx,
  userId: string,
  range: DateSpan,
  exceptId?: string,
) {
  if (range.endsOn < range.startsOn)
    throw new ApiError('sprint.dates', 400, 'endsOn')
  const others = await tx
    .select()
    .from(t.sprints)
    .where(
      and(
        eq(t.sprints.userId, userId),
        exceptId ? ne(t.sprints.id, exceptId) : undefined,
      ),
    )
  if (others.some((s) => rangesOverlap(s, range)))
    throw conflict('sprint.overlap', 'startsOn')
}

export type CadenceInput = z.infer<typeof cadenceInput>
export type SprintBody = z.infer<typeof sprintInput>

/**
 * Nowa kadencja zastępuje przyszłe sprinty z poprzedniej; przeszłe i ręczne zostają.
 * Brakujące sprinty z nowej kadencji powstają od razu.
 */
export async function saveCadence(userId: string, input: CadenceInput) {
  return db.transaction(async (tx) => {
    await tx
      .insert(t.sprintCadences)
      .values({ ...input, userId })
      .onConflictDoUpdate({ target: t.sprintCadences.userId, set: input })
    const today = await userToday(tx, userId)
    await tx
      .delete(t.sprints)
      .where(
        and(
          eq(t.sprints.userId, userId),
          eq(t.sprints.fromCadence, true),
          gte(t.sprints.endsOn, today),
        ),
      )
    await tx
      .update(t.sprints)
      .set({ number: null })
      .where(and(eq(t.sprints.userId, userId), eq(t.sprints.fromCadence, true)))
    await syncCadenceSprints(tx, userId)
    return getCadence(tx, userId)
  })
}

export async function removeCadence(userId: string) {
  await db.delete(t.sprintCadences).where(eq(t.sprintCadences.userId, userId))
}

/** Sprinty konta od najwcześniejszego (najpierw dotworzone brakujące z kadencji). */
export async function getSprints(userId: string) {
  const rows = await db.transaction(async (tx) => {
    await syncCadenceSprints(tx, userId)
    return listSprints(tx, userId)
  })
  return rows.map(toSprint)
}

/** Nowy sprint ręczny (bez nakładania się dat, cele tylko dla własnych rodzajów pracy). */
export async function createSprint(userId: string, input: SprintBody) {
  const row = await db.transaction(async (tx) => {
    await assertNoOverlap(tx, userId, input)
    await assertOwnTypes(tx, userId, input.timeGoals)
    const [created] = await tx
      .insert(t.sprints)
      .values({ ...input, userId, number: null, fromCadence: false })
      .returning()
    return created!
  })
  return toSprint(row)
}

export async function updateSprint(
  userId: string,
  id: string,
  input: SprintBody,
) {
  const row = await db.transaction(async (tx) => {
    await assertNoOverlap(tx, userId, input, id)
    await assertOwnTypes(tx, userId, input.timeGoals)
    const [updated] = await tx
      .update(t.sprints)
      .set(input)
      .where(and(eq(t.sprints.id, id), eq(t.sprints.userId, userId)))
      .returning()
    if (!updated) throw notFound()
    return updated
  })
  return toSprint(row)
}

/** Usunięcie sprintu; sprintu z włączonej kadencji nie usuwamy (wróciłby przy odczycie). */
export async function removeSprint(userId: string, id: string) {
  await db.transaction(async (tx) => {
    const [sprint] = await tx
      .select()
      .from(t.sprints)
      .where(and(eq(t.sprints.id, id), eq(t.sprints.userId, userId)))
    if (!sprint) throw notFound()
    if (sprint.fromCadence && (await getCadence(tx, userId))?.autoCreate)
      throw conflict('sprint.cadence_delete')
    await tx.delete(t.sprints).where(eq(t.sprints.id, id))
  })
}

/** Kadencja sprintów konta (null, gdy wyłączona). */
export const getCadenceFor = (userId: string) => getCadence(db, userId)
