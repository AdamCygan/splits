import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
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

async function userToday(tx: Tx, scope: Scope) {
  const [s] = await tx
    .select({ timezone: t.userSettings.timezone })
    .from(t.userSettings)
    .where(eq(t.userSettings.userId, scope.userId))
  return todayIn(s?.timezone ?? 'UTC')
}

export async function getCadence(tx: Tx, scope: Scope) {
  const [row] = await tx
    .select()
    .from(t.sprintCadences)
    .where(inScope(t.sprintCadences, scope))
  return toCadence(row)
}

const listSprints = (tx: Tx, scope: Scope) =>
  tx
    .select()
    .from(t.sprints)
    .where(inScope(t.sprints, scope))
    .orderBy(asc(t.sprints.startsOn))

/** Dotwarza brakujące sprinty z kadencji (bieżący i następny), jak demo i job w tle. */
export async function syncCadenceSprints(tx: Tx, scope: Scope) {
  const cadence = await getCadence(tx, scope)
  if (!cadence) return
  const existing = await listSprints(tx, scope)
  const missing = missingCadenceSprints(
    cadence,
    existing,
    await userToday(tx, scope),
  )
  if (!missing.length) return
  // Nowe sprinty z kadencji dziedziczą cele czasowe po ostatnim sprincie (zwykle się powtarzają).
  const timeGoals = existing.at(-1)?.timeGoals ?? []
  await tx.insert(t.sprints).values(
    missing.map((s) => ({
      ...s,
      ...owner(scope),
      goal: null,
      fromCadence: true,
      timeGoals,
    })),
  )
}

/** Cele czasowe mogą dotyczyć tylko własnych rodzajów pracy. */
async function assertOwnTypes(
  tx: Tx,
  scope: Scope,
  goals: ReadonlyArray<{ taskTypeId: string }>,
) {
  if (goals.length === 0) return
  const own = await tx
    .select({ id: t.taskTypes.id })
    .from(t.taskTypes)
    .where(inScope(t.taskTypes, scope))
  const ids = new Set(own.map((x) => x.id))
  if (goals.some((g) => !ids.has(g.taskTypeId)))
    throw new ApiError('validation.invalid', 400, 'timeGoals')
}

async function assertNoOverlap(
  tx: Tx,
  scope: Scope,
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
        inScope(t.sprints, scope),
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
export async function saveCadence(scope: Scope, input: CadenceInput) {
  return db.transaction(async (tx) => {
    await tx
      .insert(t.sprintCadences)
      .values({ ...input, ...owner(scope) })
      .onConflictDoUpdate({ target: t.sprintCadences.workspaceId, set: input })
    const today = await userToday(tx, scope)
    await tx
      .delete(t.sprints)
      .where(
        and(
          inScope(t.sprints, scope),
          eq(t.sprints.fromCadence, true),
          gte(t.sprints.endsOn, today),
        ),
      )
    await tx
      .update(t.sprints)
      .set({ number: null })
      .where(and(inScope(t.sprints, scope), eq(t.sprints.fromCadence, true)))
    await syncCadenceSprints(tx, scope)
    return getCadence(tx, scope)
  })
}

export async function removeCadence(scope: Scope) {
  await db.delete(t.sprintCadences).where(inScope(t.sprintCadences, scope))
}

/** Sprinty konta od najwcześniejszego (najpierw dotworzone brakujące z kadencji). */
export async function getSprints(scope: Scope) {
  const rows = await db.transaction(async (tx) => {
    await syncCadenceSprints(tx, scope)
    return listSprints(tx, scope)
  })
  return rows.map(toSprint)
}

/** Nowy sprint ręczny (bez nakładania się dat, cele tylko dla własnych rodzajów pracy). */
export async function createSprint(scope: Scope, input: SprintBody) {
  const row = await db.transaction(async (tx) => {
    await assertNoOverlap(tx, scope, input)
    await assertOwnTypes(tx, scope, input.timeGoals)
    const [created] = await tx
      .insert(t.sprints)
      .values({ ...input, ...owner(scope), number: null, fromCadence: false })
      .returning()
    return created!
  })
  return toSprint(row)
}

export async function updateSprint(
  scope: Scope,
  id: string,
  input: SprintBody,
) {
  const row = await db.transaction(async (tx) => {
    await assertNoOverlap(tx, scope, input, id)
    await assertOwnTypes(tx, scope, input.timeGoals)
    const [updated] = await tx
      .update(t.sprints)
      .set(input)
      .where(and(eq(t.sprints.id, id), inScope(t.sprints, scope)))
      .returning()
    if (!updated) throw notFound()
    return updated
  })
  return toSprint(row)
}

/** Usunięcie sprintu; sprintu z włączonej kadencji nie usuwamy (wróciłby przy odczycie). */
export async function removeSprint(scope: Scope, id: string) {
  await db.transaction(async (tx) => {
    const [sprint] = await tx
      .select()
      .from(t.sprints)
      .where(and(eq(t.sprints.id, id), inScope(t.sprints, scope)))
    if (!sprint) throw notFound()
    if (sprint.fromCadence && (await getCadence(tx, scope))?.autoCreate)
      throw conflict('sprint.cadence_delete')
    await tx.delete(t.sprints).where(eq(t.sprints.id, id))
  })
}

/** Kadencja sprintów konta (null, gdy wyłączona). */
export const getCadenceFor = (scope: Scope) => getCadence(db, scope)
