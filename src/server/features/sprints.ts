import { and, asc, eq, gte, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { todayIn } from '#/domain/dates'
import { missingCadenceSprints, rangesOverlap } from '#/domain/sprints'
import type { DateSpan } from '#/domain/sprints'
import { db } from '../db/client'
import type { Tx } from '../db/client'
import * as t from '../db/schema'
import type { AppEnv } from '../http/context'
import { ApiError, conflict, notFound } from '../http/errors'
import { body, cadenceInput, sprintInput } from '../http/inputs'
import { toCadence, toSprint } from './dto'

async function userToday(tx: Tx, userId: string) {
  const [s] = await tx
    .select({ timezone: t.userSettings.timezone })
    .from(t.userSettings)
    .where(eq(t.userSettings.userId, userId))
  return todayIn(s?.timezone ?? 'UTC')
}

async function getCadence(tx: Tx, userId: string) {
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

export const sprintRoutes = new Hono<AppEnv>()
  .get('/cadence', async (c) => c.json(await getCadence(db, c.get('userId'))))
  .put('/cadence', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, cadenceInput)
    const cadence = await db.transaction(async (tx) => {
      await tx
        .insert(t.sprintCadences)
        .values({ ...input, userId })
        .onConflictDoUpdate({ target: t.sprintCadences.userId, set: input })
      // Nowa kadencja zastępuje przyszłe sprinty z poprzedniej; przeszłe i ręczne zostają.
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
        .where(
          and(eq(t.sprints.userId, userId), eq(t.sprints.fromCadence, true)),
        )
      await syncCadenceSprints(tx, userId)
      return getCadence(tx, userId)
    })
    return c.json(cadence)
  })
  .delete('/cadence', async (c) => {
    await db
      .delete(t.sprintCadences)
      .where(eq(t.sprintCadences.userId, c.get('userId')))
    return c.json(null)
  })
  .get('/', async (c) => {
    const userId = c.get('userId')
    const rows = await db.transaction(async (tx) => {
      await syncCadenceSprints(tx, userId)
      return listSprints(tx, userId)
    })
    return c.json(rows.map(toSprint))
  })
  .post('/', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, sprintInput)
    const row = await db.transaction(async (tx) => {
      await assertNoOverlap(tx, userId, input)
      await assertOwnTypes(tx, userId, input.timeGoals)
      const [created] = await tx
        .insert(t.sprints)
        .values({ ...input, userId, number: null, fromCadence: false })
        .returning()
      return created!
    })
    return c.json(toSprint(row), 201)
  })
  .put('/:id', async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const input = await body(c, sprintInput)
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
    return c.json(toSprint(row))
  })
  .delete('/:id', async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    await db.transaction(async (tx) => {
      const [sprint] = await tx
        .select()
        .from(t.sprints)
        .where(and(eq(t.sprints.id, id), eq(t.sprints.userId, userId)))
      if (!sprint) throw notFound()
      // Sprinty z kadencji tworzą się same, więc usunięty wróciłby przy następnym odczycie.
      if (sprint.fromCadence && (await getCadence(tx, userId))?.autoCreate)
        throw conflict('sprint.cadence_delete')
      await tx.delete(t.sprints).where(eq(t.sprints.id, id))
    })
    return c.body(null, 204)
  })
