import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import type { Context } from 'hono'
import { isApplyTarget } from '#/features/workspaces/domain/workspaces'
import type { ApplyTarget } from '#/features/workspaces/domain/workspaces'
import { db } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { lowerName } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
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
export function applyOf(c: Context<AppEnv>): ApplyTarget | undefined {
  const value = c.req.query('apply')
  return isApplyTarget(value) ? value : undefined
}

/** Wykonuje `op` w każdej docelowej przestrzeni (bieżąca pierwsza, jej wynik wraca). */
export async function inTargets<T>(
  scope: Scope,
  apply: ApplyTarget | undefined,
  op: (target: Scope) => Promise<T>,
) {
  const targets = await applyTargets(db, scope, apply)
  const result = await op(targets[0]!)
  for (const target of targets.slice(1)) await bestEffort(() => op(target))
  return result
}

/** Zapis w innej przestrzeni: błąd reguł (konflikt, walidacja) pomija tylko tę przestrzeń. */
async function bestEffort(op: () => Promise<unknown>) {
  try {
    await op()
  } catch (error) {
    if (!isRuleError(error)) throw error
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
  const row = await sourceRow(db, kind, scope, id)
  if (!row) return null
  return {
    syncId: row.syncId,
    name: 'name' in row ? row.name : null,
    startsOn: 'startsOn' in row ? row.startsOn : null,
    endsOn: 'endsOn' in row ? row.endsOn : null,
  }
}

function sourceRow(tx: Tx, kind: MirrorKind, scope: Scope, id: string) {
  const one = <TRow>(rows: Promise<Array<TRow>>) =>
    rows.then((r) => r[0] ?? null)
  switch (kind) {
    case 'workTypes':
      return one(
        tx
          .select()
          .from(t.taskTypes)
          .where(and(eq(t.taskTypes.id, id), inScope(t.taskTypes, scope))),
      )
    case 'statuses':
      return one(
        tx
          .select()
          .from(t.taskStatuses)
          .where(
            and(eq(t.taskStatuses.id, id), inScope(t.taskStatuses, scope)),
          ),
      )
    case 'tags':
      return one(
        tx
          .select()
          .from(t.tags)
          .where(and(eq(t.tags.id, id), inScope(t.tags, scope))),
      )
    case 'sprints':
      return one(
        tx
          .select()
          .from(t.sprints)
          .where(and(eq(t.sprints.id, id), inScope(t.sprints, scope))),
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
  op: () => Promise<T>,
  idOf: (result: T) => string = () => id!,
) {
  if (apply !== 'all') return op()
  const before = id ? await snapshot(kind, scope, id) : null
  const result = await op()
  const targets = (await applyTargets(db, scope, 'all')).slice(1)
  for (const target of targets)
    await bestEffort(() =>
      db.transaction((tx) =>
        mirrorInto(tx, kind, scope, target, idOf(result), before),
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
  op: (target: Scope, id: string) => Promise<unknown>,
): Promise<void> {
  if (apply !== 'all') {
    await op(scope, id)
    return
  }
  const before = await snapshot(kind, scope, id)
  await op(scope, id)
  if (!before) return
  const targets = (await applyTargets(db, scope, 'all')).slice(1)
  for (const target of targets) {
    const match = await counterpart(db, kind, target, before)
    if (match) await bestEffort(() => op(target, match.id))
  }
}

async function counterpart(
  tx: Tx,
  kind: MirrorKind,
  target: Scope,
  before: Snapshot,
): Promise<{ id: string } | null> {
  if (kind === 'sprints') {
    const rows = await tx
      .select()
      .from(t.sprints)
      .where(inScope(t.sprints, target))
    return (
      rows.find((r) => r.syncId === before.syncId) ??
      rows.find(
        (r) => r.startsOn === before.startsOn && r.endsOn === before.endsOn,
      ) ??
      null
    )
  }
  const table =
    kind === 'workTypes'
      ? t.taskTypes
      : kind === 'statuses'
        ? t.taskStatuses
        : t.tags
  const rows = await tx
    .select({ id: table.id, syncId: table.syncId, name: table.name })
    .from(table as typeof t.tags)
    .where(inScope(table, target))
  return (
    rows.find((r) => r.syncId === before.syncId) ??
    (before.name
      ? rows.find((r) => lowerName(r.name) === lowerName(before.name!))
      : undefined) ??
    null
  )
}

async function mirrorInto(
  tx: Tx,
  kind: MirrorKind,
  from: Scope,
  to: Scope,
  id: string,
  before: Snapshot | null,
) {
  const source = await sourceRow(tx, kind, from, id)
  if (!source) return
  const match = await counterpart(
    tx,
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
      const s = source as typeof t.taskTypes.$inferSelect
      const { id: _i, userId: _u, workspaceId: _w, createdAt: _c, ...data } = s
      if (match)
        await tx
          .update(t.taskTypes)
          .set(data)
          .where(eq(t.taskTypes.id, match.id))
      else
        await tx.insert(t.taskTypes).values({
          ...data,
          sortOrder: await nextOrder(tx, t.taskTypes, to),
          ...owner(to),
        })
      return
    }
    case 'statuses': {
      const s = source as typeof t.taskStatuses.$inferSelect
      const { id: _i, userId: _u, workspaceId: _w, sortOrder: _o, ...data } = s
      if (match && data.archivedAt) {
        // Archiwizacja nie może zostawić grupy bez aktywnego statusu.
        const [left] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(t.taskStatuses)
          .where(
            and(
              inScope(t.taskStatuses, to),
              eq(t.taskStatuses.category, data.category),
              isNull(t.taskStatuses.archivedAt),
              ne(t.taskStatuses.id, match.id),
            ),
          )
        if ((left?.n ?? 0) === 0) return
      }
      if (data.isDefault)
        await tx
          .update(t.taskStatuses)
          .set({ isDefault: false })
          .where(inScope(t.taskStatuses, to))
      if (match)
        await tx
          .update(t.taskStatuses)
          .set(data)
          .where(eq(t.taskStatuses.id, match.id))
      else
        await tx.insert(t.taskStatuses).values({
          ...data,
          sortOrder: await nextOrder(tx, t.taskStatuses, to),
          ...owner(to),
        })
      return
    }
    case 'tags': {
      const s = source as typeof t.tags.$inferSelect
      const { id: _i, userId: _u, workspaceId: _w, ...data } = s
      if (match)
        await tx.update(t.tags).set(data).where(eq(t.tags.id, match.id))
      else await tx.insert(t.tags).values({ ...data, ...owner(to) })
      return
    }
    case 'sprints': {
      const s = source as typeof t.sprints.$inferSelect
      const { id: _i, userId: _u, workspaceId: _w, ...data } = s
      const types = await taskTypeMap(tx, from, to)
      const values = {
        ...data,
        timeGoals: s.timeGoals.flatMap((g) => {
          const typeId = types.get(g.taskTypeId)
          return typeId ? [{ ...g, taskTypeId: typeId }] : []
        }),
      }
      // Sprinty w przestrzeni nie mogą na siebie nachodzić (poza tym, który zmieniamy).
      const overlapping = await tx
        .select({ id: t.sprints.id })
        .from(t.sprints)
        .where(
          and(
            inScope(t.sprints, to),
            match ? ne(t.sprints.id, match.id) : undefined,
            sql`${t.sprints.startsOn} <= ${values.endsOn} and ${t.sprints.endsOn} >= ${values.startsOn}`,
          ),
        )
      if (overlapping.length) return
      if (match)
        await tx.update(t.sprints).set(values).where(eq(t.sprints.id, match.id))
      else await tx.insert(t.sprints).values({ ...values, ...owner(to) })
      return
    }
  }
}

async function nextOrder(
  tx: Tx,
  table: typeof t.taskTypes | typeof t.taskStatuses,
  scope: Scope,
) {
  const [row] = await tx
    .select({ n: sql<number>`coalesce(max(${table.sortOrder}) + 1, 0)::int` })
    .from(table as typeof t.taskStatuses)
    .where(inScope(table, scope))
  return row?.n ?? 0
}
