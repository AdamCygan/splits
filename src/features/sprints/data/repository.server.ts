import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { and, asc, eq, gte, ne } from 'drizzle-orm'
import { todayIn } from '#/shared/domain/dates'
import {
  missingCadenceSprints,
  rangesOverlap,
} from '#/features/sprints/domain/sprints'
import type { DateSpan } from '#/features/sprints/domain/sprints'
import { database } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import * as schema from '#/server/db/schema'
import { ApiError, conflict, notFound } from '#/server/http/errors'
import type { z } from 'zod'
import type { cadenceInput, sprintInput } from './inputs.server'
import { toCadence, toSprint } from './mappers.server'

async function userToday(transaction: Tx, scope: Scope) {
  const [userSetting] = await transaction
    .select({ timezone: schema.userSettings.timezone })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, scope.userId))
  return todayIn(userSetting?.timezone ?? 'UTC')
}

export async function getCadence(transaction: Tx, scope: Scope) {
  const [row] = await transaction
    .select()
    .from(schema.sprintCadences)
    .where(inScope(schema.sprintCadences, scope))
  return toCadence(row)
}

const listSprints = (transaction: Tx, scope: Scope) =>
  transaction
    .select()
    .from(schema.sprints)
    .where(inScope(schema.sprints, scope))
    .orderBy(asc(schema.sprints.startsOn))

/** Dotwarza brakujące sprinty z kadencji (bieżący i następny), jak demo i job w tle. */
export async function syncCadenceSprints(transaction: Tx, scope: Scope) {
  const cadence = await getCadence(transaction, scope)
  if (!cadence) return
  const existing = await listSprints(transaction, scope)
  const missing = missingCadenceSprints(
    cadence,
    existing,
    await userToday(transaction, scope),
  )
  if (!missing.length) return
  // Nowe sprinty z kadencji dziedziczą cele czasowe po ostatnim sprincie (zwykle się powtarzają).
  const timeGoals = existing.at(-1)?.timeGoals ?? []
  await transaction.insert(schema.sprints).values(
    missing.map((missingSprint) => ({
      ...missingSprint,
      ...owner(scope),
      goal: null,
      fromCadence: true,
      timeGoals,
    })),
  )
}

/** Cele czasowe mogą dotyczyć tylko własnych rodzajów pracy. */
async function assertOwnTypes(
  transaction: Tx,
  scope: Scope,
  goals: ReadonlyArray<{ taskTypeId: string }>,
) {
  if (goals.length === 0) return
  const own = await transaction
    .select({ id: schema.taskTypes.id })
    .from(schema.taskTypes)
    .where(inScope(schema.taskTypes, scope))
  const ids = new Set(own.map((ownedSprint) => ownedSprint.id))
  if (goals.some((goal) => !ids.has(goal.taskTypeId)))
    throw new ApiError('validation.invalid', 400, 'timeGoals')
}

async function assertNoOverlap(
  transaction: Tx,
  scope: Scope,
  range: DateSpan,
  exceptId?: string,
) {
  if (range.endsOn < range.startsOn)
    throw new ApiError('sprint.dates', 400, 'endsOn')
  const others = await transaction
    .select()
    .from(schema.sprints)
    .where(
      and(
        inScope(schema.sprints, scope),
        exceptId ? ne(schema.sprints.id, exceptId) : undefined,
      ),
    )
  if (others.some((other) => rangesOverlap(other, range)))
    throw conflict('sprint.overlap', 'startsOn')
}

export type CadenceInput = z.infer<typeof cadenceInput>
export type SprintBody = z.infer<typeof sprintInput>

/**
 * Nowa kadencja zastępuje przyszłe sprinty z poprzedniej; przeszłe i ręczne zostają.
 * Brakujące sprinty z nowej kadencji powstają od razu.
 */
export async function saveCadence(scope: Scope, input: CadenceInput) {
  return database.transaction(async (transaction) => {
    await transaction
      .insert(schema.sprintCadences)
      .values({ ...input, ...owner(scope) })
      .onConflictDoUpdate({
        target: schema.sprintCadences.workspaceId,
        set: input,
      })
    const today = await userToday(transaction, scope)
    await transaction
      .delete(schema.sprints)
      .where(
        and(
          inScope(schema.sprints, scope),
          eq(schema.sprints.fromCadence, true),
          gte(schema.sprints.endsOn, today),
        ),
      )
    await transaction
      .update(schema.sprints)
      .set({ number: null })
      .where(
        and(
          inScope(schema.sprints, scope),
          eq(schema.sprints.fromCadence, true),
        ),
      )
    await syncCadenceSprints(transaction, scope)
    return getCadence(transaction, scope)
  })
}

export async function removeCadence(scope: Scope) {
  await database
    .delete(schema.sprintCadences)
    .where(inScope(schema.sprintCadences, scope))
}

/** Sprinty konta od najwcześniejszego (najpierw dotworzone brakujące z kadencji). */
export async function getSprints(scope: Scope) {
  const rows = await database.transaction(async (transaction) => {
    await syncCadenceSprints(transaction, scope)
    return listSprints(transaction, scope)
  })
  return rows.map(toSprint)
}

/** Nowy sprint ręczny (bez nakładania się dat, cele tylko dla własnych rodzajów pracy). */
export async function createSprint(scope: Scope, input: SprintBody) {
  const row = await database.transaction(async (transaction) => {
    await assertNoOverlap(transaction, scope, input)
    await assertOwnTypes(transaction, scope, input.timeGoals)
    const [created] = await transaction
      .insert(schema.sprints)
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
  const row = await database.transaction(async (transaction) => {
    await assertNoOverlap(transaction, scope, input, id)
    await assertOwnTypes(transaction, scope, input.timeGoals)
    const [updated] = await transaction
      .update(schema.sprints)
      .set(input)
      .where(and(eq(schema.sprints.id, id), inScope(schema.sprints, scope)))
      .returning()
    if (!updated) throw notFound()
    return updated
  })
  return toSprint(row)
}

/** Usunięcie sprintu; sprintu z włączonej kadencji nie usuwamy (wróciłby przy odczycie). */
export async function removeSprint(scope: Scope, id: string) {
  await database.transaction(async (transaction) => {
    const [sprint] = await transaction
      .select()
      .from(schema.sprints)
      .where(and(eq(schema.sprints.id, id), inScope(schema.sprints, scope)))
    if (!sprint) throw notFound()
    if (
      sprint.fromCadence &&
      (await getCadence(transaction, scope))?.autoCreate
    )
      throw conflict('sprint.cadence_delete')
    await transaction.delete(schema.sprints).where(eq(schema.sprints.id, id))
  })
}

/** Kadencja sprintów konta (null, gdy wyłączona). */
export const getCadenceFor = (scope: Scope) => getCadence(database, scope)
