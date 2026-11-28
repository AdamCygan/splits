import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import type { Context } from 'hono'
import { isApplyTarget } from '#/features/workspaces/domain/workspaces'
import type { ApplyTarget } from '#/features/workspaces/domain/workspaces'
import { database } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { lowerName } from '#/server/db/helpers'
import * as schema from '#/server/db/schema'
import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import type { AppEnv } from '#/server/http/context'
import { taskTypeMap } from './copy.server'
import { applyTargets } from './repository.server'

/**
 * „Zastosuj we wszystkich przestrzeniach”: zmiana w bieżącej przestrzeni trafia też do
 * odpowiedników w pozostałych. Odpowiednik to element z tym samym sync_id, a gdy go nie ma,
 * z tą samą nazwą (sprint: te same daty) sprzed zmiany; brakujący powstaje jako kopia.
 * Każda przestrzeń jest zapisywana osobno: gdy w którejś zmiana łamie jej reguły (np. nazwa
 * zajęta przez inny element), ta przestrzeń zostaje bez zmian, a reszta dostaje zmianę.
 */

/** ?apply=all|this z adresu żądania (brak = tylko bieżąca przestrzeń). */
export function applyOf(context: Context<AppEnv>): ApplyTarget | undefined {
  const value = context.req.query('apply')
  return isApplyTarget(value) ? value : undefined
}

/** Wykonuje `op` w każdej docelowej przestrzeni (bieżąca pierwsza, jej wynik wraca). */
export async function inTargets<T>(
  scope: Scope,
  apply: ApplyTarget | undefined,
  operation: (target: Scope) => Promise<T>,
) {
  const targets = await applyTargets(database, scope, apply)
  const result = await operation(targets[0]!)
  for (const target of targets.slice(1))
    await bestEffort(() => operation(target))
  return result
}

/** Zapis w innej przestrzeni: błąd reguł (konflikt, walidacja) pomija tylko tę przestrzeń. */
async function bestEffort(operation: () => Promise<unknown>) {
  try {
    await operation()
  } catch (error) {
    const isUnexpected = !isRuleError(error)
    if (isUnexpected) throw error
  }
}

const isRuleError = (error: unknown) => {
  const status = (error as { status?: number }).status
  const code = (error as { code?: string }).code
  return (
    (status !== undefined && status < 500) ||
    code === '23505' ||
    code === '23514'
  )
}

export type MirrorKind = 'workTypes' | 'statuses' | 'tags' | 'sprints'

/** Jak element wyglądał przed zmianą (do odszukania odpowiedników bez wspólnego sync_id). */
export interface Snapshot {
  syncId: string
  name: string | null
  startsOn: string | null
  endsOn: string | null
}

export async function snapshot(
  kind: MirrorKind,
  scope: Scope,
  id: string,
): Promise<Snapshot | null> {
  const row = await sourceRow(database, kind, scope, id)
  if (!row) return null
  return {
    syncId: row.syncId,
    name: 'name' in row ? row.name : null,
    startsOn: 'startsOn' in row ? row.startsOn : null,
    endsOn: 'endsOn' in row ? row.endsOn : null,
  }
}

function sourceRow(
  transaction: Tx,
  kind: MirrorKind,
  scope: Scope,
  id: string,
) {
  const one = <TRow>(rows: Promise<Array<TRow>>) =>
    rows.then((resultRows) => resultRows[0] ?? null)
  switch (kind) {
    case 'workTypes':
      return one(
        transaction
          .select()
          .from(schema.taskTypes)
          .where(
            and(eq(schema.taskTypes.id, id), inScope(schema.taskTypes, scope)),
          ),
      )
    case 'statuses':
      return one(
        transaction
          .select()
          .from(schema.taskStatuses)
          .where(
            and(
              eq(schema.taskStatuses.id, id),
              inScope(schema.taskStatuses, scope),
            ),
          ),
      )
    case 'tags':
      return one(
        transaction
          .select()
          .from(schema.tags)
          .where(and(eq(schema.tags.id, id), inScope(schema.tags, scope))),
      )
    case 'sprints':
      return one(
        transaction
          .select()
          .from(schema.sprints)
          .where(
            and(eq(schema.sprints.id, id), inScope(schema.sprints, scope)),
          ),
      )
  }
}

/**
 * Zmiana albo nowy element: po zapisie w bieżącej przestrzeni (`op`) kopiuje jego stan do
 * pozostałych. `idOf` wskazuje element w wyniku (nowy element nie ma id przed zapisem).
 */
export async function mirrored<T>(
  scope: Scope,
  apply: ApplyTarget | undefined,
  kind: MirrorKind,
  id: string | null,
  operation: () => Promise<T>,
  idOf: (result: T) => string = () => id!,
) {
  const isSingleWorkspace = apply !== 'all'
  if (isSingleWorkspace) return operation()
  const before = id ? await snapshot(kind, scope, id) : null
  const result = await operation()
  const targets = (await applyTargets(database, scope, 'all')).slice(1)
  for (const target of targets)
    await bestEffort(() =>
      database.transaction((transaction) =>
        mirrorInto(transaction, kind, scope, target, idOf(result), before),
      ),
    )
  return result
}

/** Usunięcie: po usunięciu w bieżącej przestrzeni usuwa odpowiedniki w pozostałych. */
export async function removedEverywhere(
  scope: Scope,
  apply: ApplyTarget | undefined,
  kind: 'tags' | 'sprints',
  id: string,
  operation: (target: Scope, id: string) => Promise<unknown>,
): Promise<void> {
  const isSingleWorkspace = apply !== 'all'
  if (isSingleWorkspace) {
    await operation(scope, id)
    return
  }
  const before = await snapshot(kind, scope, id)
  await operation(scope, id)
  if (!before) return
  const targets = (await applyTargets(database, scope, 'all')).slice(1)
  for (const target of targets) {
    const match = await counterpart(database, kind, target, before)
    if (match) await bestEffort(() => operation(target, match.id))
  }
}

async function counterpart(
  transaction: Tx,
  kind: MirrorKind,
  target: Scope,
  before: Snapshot,
): Promise<{ id: string } | null> {
  const isSprints = kind === 'sprints'
  if (isSprints) {
    const rows = await transaction
      .select()
      .from(schema.sprints)
      .where(inScope(schema.sprints, target))
    return (
      rows.find((row) => row.syncId === before.syncId) ??
      rows.find(
        (row) =>
          row.startsOn === before.startsOn && row.endsOn === before.endsOn,
      ) ??
      null
    )
  }
  const table =
    kind === 'workTypes'
      ? schema.taskTypes
      : kind === 'statuses'
        ? schema.taskStatuses
        : schema.tags
  const rows = await transaction
    .select({ id: table.id, syncId: table.syncId, name: table.name })
    .from(table as typeof schema.tags)
    .where(inScope(table, target))
  return (
    rows.find((row) => row.syncId === before.syncId) ??
    (before.name
      ? rows.find((row) => lowerName(row.name) === lowerName(before.name!))
      : undefined) ??
    null
  )
}

async function mirrorInto(
  transaction: Tx,
  kind: MirrorKind,
  from: Scope,
  to: Scope,
  id: string,
  before: Snapshot | null,
) {
  const source = await sourceRow(transaction, kind, from, id)
  if (!source) return
  const match = await counterpart(
    transaction,
    kind,
    to,
    before ?? {
      syncId: source.syncId,
      name: 'name' in source ? source.name : null,
      startsOn: 'startsOn' in source ? source.startsOn : null,
      endsOn: 'endsOn' in source ? source.endsOn : null,
    },
  )
  switch (kind) {
    case 'workTypes': {
      const sourceTaskType = source as typeof schema.taskTypes.$inferSelect
      const {
        id: _id,
        userId: _userId,
        workspaceId: _workspaceId,
        createdAt: _createdAt,
        ...data
      } = sourceTaskType
      if (match)
        await transaction
          .update(schema.taskTypes)
          .set(data)
          .where(eq(schema.taskTypes.id, match.id))
      else
        await transaction.insert(schema.taskTypes).values({
          ...data,
          sortOrder: await nextOrder(transaction, schema.taskTypes, to),
          ...owner(to),
        })
      return
    }
    case 'statuses': {
      const sourceStatus = source as typeof schema.taskStatuses.$inferSelect
      const {
        id: _id,
        userId: _userId,
        workspaceId: _workspaceId,
        sortOrder: _sortOrder,
        ...data
      } = sourceStatus
      const restoresMatch = match && data.archivedAt
      if (restoresMatch) {
        // Archiwizacja nie może zostawić grupy bez aktywnego statusu.
        const [left] = await transaction
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.taskStatuses)
          .where(
            and(
              inScope(schema.taskStatuses, to),
              eq(schema.taskStatuses.category, data.category),
              isNull(schema.taskStatuses.archivedAt),
              ne(schema.taskStatuses.id, match.id),
            ),
          )
        const isUnused = (left?.n ?? 0) === 0
        if (isUnused) return
      }
      if (data.isDefault)
        await transaction
          .update(schema.taskStatuses)
          .set({ isDefault: false })
          .where(inScope(schema.taskStatuses, to))
      if (match)
        await transaction
          .update(schema.taskStatuses)
          .set(data)
          .where(eq(schema.taskStatuses.id, match.id))
      else
        await transaction.insert(schema.taskStatuses).values({
          ...data,
          sortOrder: await nextOrder(transaction, schema.taskStatuses, to),
          ...owner(to),
        })
      return
    }
    case 'tags': {
      const sourceTag = source as typeof schema.tags.$inferSelect
      const {
        id: _id,
        userId: _userId,
        workspaceId: _workspaceId,
        ...data
      } = sourceTag
      if (match)
        await transaction
          .update(schema.tags)
          .set(data)
          .where(eq(schema.tags.id, match.id))
      else
        await transaction.insert(schema.tags).values({ ...data, ...owner(to) })
      return
    }
    case 'sprints': {
      const sourceSprint = source as typeof schema.sprints.$inferSelect
      const {
        id: _id,
        userId: _userId,
        workspaceId: _workspaceId,
        ...data
      } = sourceSprint
      const types = await taskTypeMap(transaction, from, to)
      const values = {
        ...data,
        timeGoals: sourceSprint.timeGoals.flatMap((sprintTimeGoal) => {
          const typeId = types.get(sprintTimeGoal.taskTypeId)
          return typeId ? [{ ...sprintTimeGoal, taskTypeId: typeId }] : []
        }),
      }
      // Sprinty w przestrzeni nie mogą na siebie nachodzić (poza tym, który zmieniamy).
      const overlapping = await transaction
        .select({ id: schema.sprints.id })
        .from(schema.sprints)
        .where(
          and(
            inScope(schema.sprints, to),
            match ? ne(schema.sprints.id, match.id) : undefined,
            sql`${schema.sprints.startsOn} <= ${values.endsOn} and ${schema.sprints.endsOn} >= ${values.startsOn}`,
          ),
        )
      if (overlapping.length) return
      if (match)
        await transaction
          .update(schema.sprints)
          .set(values)
          .where(eq(schema.sprints.id, match.id))
      else
        await transaction
          .insert(schema.sprints)
          .values({ ...values, ...owner(to) })
      return
    }
  }
}

async function nextOrder(
  transaction: Tx,
  table: typeof schema.taskTypes | typeof schema.taskStatuses,
  scope: Scope,
) {
  const [row] = await transaction
    .select({ n: sql<number>`coalesce(max(${table.sortOrder}) + 1, 0)::int` })
    .from(table as typeof schema.taskStatuses)
    .where(inScope(table, scope))
  return row?.n ?? 0
}
