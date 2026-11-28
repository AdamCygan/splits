import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { currentUser } from '#/features/account/data/repository.server'
import { seedWorkspaceData } from '#/features/auth/data/workspace.server'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'
import { copyNeeds } from '#/features/workspaces/domain/workspaces'
import type {
  ApplyTarget,
  CopyKind,
} from '#/features/workspaces/domain/workspaces'
import { db } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { lowerName } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import type { Scope } from '#/server/db/scope'
import { ApiError, conflict, notFound } from '#/server/http/errors'
import type { z } from 'zod'
import { copyInto } from './copy.server'
import type {
  Workspace,
  WorkspaceCreateInput,
  WorkspaceInput,
  WorkspaceState,
} from './dto'
import type { prefsInput } from './inputs.server'

const toWorkspace = (row: typeof t.workspaces.$inferSelect): Workspace => ({
  id: row.id,
  name: row.name,
  color: row.color,
})

/** Przestrzenie konta w kolejności z ustawień. */
export const workspacesOf = (tx: Tx, userId: string) =>
  tx
    .select()
    .from(t.workspaces)
    .where(eq(t.workspaces.userId, userId))
    .orderBy(asc(t.workspaces.sortOrder), asc(t.workspaces.createdAt))

/**
 * Bieżąca przestrzeń żądania: ta z ciasteczka, jeśli należy do konta, inaczej pierwsza.
 * Konto bez przestrzeni (nie powinno się zdarzyć) dostaje nową, żeby aplikacja działała.
 */
export async function resolveWorkspace(
  userId: string,
  requested: string | undefined,
) {
  const rows = await db
    .select({ id: t.workspaces.id })
    .from(t.workspaces)
    .where(eq(t.workspaces.userId, userId))
    .orderBy(asc(t.workspaces.sortOrder), asc(t.workspaces.createdAt))
  if (requested && rows.some((r) => r.id === requested)) return requested
  if (rows[0]) return rows[0].id
  // Konto usunięte przed chwilą (token jeszcze ważny): sesja już nie istnieje.
  const [user] = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(eq(t.users.id, userId))
  if (!user) throw new ApiError('auth.no_session', 401)
  return db.transaction(async (tx) => {
    const { locale, timezone } = await accountLocale(tx, userId)
    const [row] = await tx
      .insert(t.workspaces)
      .values({ userId, name: 'Workspace', color: '#3D3BF3' })
      .returning()
    await seedWorkspaceData(
      tx,
      { userId, workspaceId: row!.id },
      locale,
      timezone,
    )
    return row!.id
  })
}

async function accountLocale(tx: Tx, userId: string) {
  const [s] = await tx
    .select({
      locale: t.userSettings.locale,
      timezone: t.userSettings.timezone,
    })
    .from(t.userSettings)
    .where(eq(t.userSettings.userId, userId))
  return {
    locale: s?.locale === 'pl' ? ('pl' as const) : ('en' as const),
    timezone: s?.timezone ?? 'UTC',
  }
}

export async function getWorkspaceState(scope: Scope): Promise<WorkspaceState> {
  const [rows, [prefs]] = await Promise.all([
    workspacesOf(db, scope.userId),
    db
      .select({
        apply: t.userSettings.workspaceApply,
        askDaily: t.userSettings.askWorkspaceDaily,
      })
      .from(t.userSettings)
      .where(eq(t.userSettings.userId, scope.userId)),
  ])
  return {
    current: scope.workspaceId,
    items: rows.map(toWorkspace),
    prefs: { apply: prefs?.apply ?? {}, askDaily: prefs?.askDaily ?? true },
  }
}

/** Przestrzeń konta albo 404 (cudza wygląda tak samo jak nieistniejąca). */
async function ownWorkspace(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select()
    .from(t.workspaces)
    .where(and(eq(t.workspaces.id, id), eq(t.workspaces.userId, userId)))
  if (!row) throw notFound()
  return row
}

async function assertNameFree(
  tx: Tx,
  userId: string,
  name: string,
  exceptId?: string,
) {
  const [taken] = await tx
    .select({ id: t.workspaces.id })
    .from(t.workspaces)
    .where(
      and(
        eq(t.workspaces.userId, userId),
        sql`lower(${t.workspaces.name}) = ${lowerName(name)}`,
        exceptId ? ne(t.workspaces.id, exceptId) : undefined,
      ),
    )
  if (taken) throw conflict('name_taken', 'name')
}

/**
 * Nowa przestrzeń: konfiguracja startowa w języku konta, potem wybrane rzeczy skopiowane
 * z innej przestrzeni (rodzaje pracy, statusy, skala SP…). Plan Free ma jedną przestrzeń.
 */
export async function createWorkspace(
  userId: string,
  input: WorkspaceCreateInput,
) {
  const row = await db.transaction(async (tx) => {
    const user = await currentUser(userId)
    const existing = await workspacesOf(tx, userId)
    if (!hasProAccess(user) && existing.length >= FREE_LIMITS.workspaces)
      throw new ApiError('plan.limit_workspaces', 403)
    await assertNameFree(tx, userId, input.name)
    const source = input.copyFrom
      ? await ownWorkspace(tx, userId, input.copyFrom)
      : null
    const [created] = await tx
      .insert(t.workspaces)
      .values({
        userId,
        name: input.name.trim(),
        color: input.color,
        sortOrder: existing.length,
      })
      .returning()
    const { locale, timezone } = await accountLocale(tx, userId)
    const to = { userId, workspaceId: created!.id }
    await seedWorkspaceData(tx, to, locale, timezone)
    if (source && input.copy.length)
      await copyInto(
        tx,
        { userId, workspaceId: source.id },
        to,
        copyNeeds(input.copy),
      )
    return created!
  })
  return toWorkspace(row)
}

export async function updateWorkspace(
  userId: string,
  id: string,
  input: WorkspaceInput,
) {
  const row = await db.transaction(async (tx) => {
    await ownWorkspace(tx, userId, id)
    await assertNameFree(tx, userId, input.name, id)
    const [updated] = await tx
      .update(t.workspaces)
      .set({ name: input.name.trim(), color: input.color })
      .where(eq(t.workspaces.id, id))
      .returning()
    return updated!
  })
  return toWorkspace(row)
}

/** Nowa kolejność (skróty Alt+Shift+1…9 idą po niej). */
export async function reorderWorkspaces(
  userId: string,
  ids: ReadonlyArray<string>,
) {
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries())
      await tx
        .update(t.workspaces)
        .set({ sortOrder: i })
        .where(and(eq(t.workspaces.id, id), eq(t.workspaces.userId, userId)))
  })
  return (await workspacesOf(db, userId)).map(toWorkspace)
}

/**
 * Usuwa przestrzeń z całą zawartością (projekty, sprinty, wpisy…). Ostatniej nie da się usunąć.
 * Działający timer albo przerwa w tej przestrzeni znikają razem z nią.
 */
export async function deleteWorkspace(userId: string, id: string) {
  await db.transaction(async (tx) => {
    await ownWorkspace(tx, userId, id)
    const all = await workspacesOf(tx, userId)
    if (all.length <= 1) throw new ApiError('workspace.last', 409)
    await tx.delete(t.workspaces).where(eq(t.workspaces.id, id))
  })
}

/** Kopiuje wybrane rzeczy z innej przestrzeni konta do `id` (łączy z tym, co już jest). */
export async function copyToWorkspace(
  userId: string,
  id: string,
  from: string,
  kinds: ReadonlyArray<CopyKind>,
) {
  if (id === from) throw new ApiError('validation.invalid', 400, 'from')
  await db.transaction(async (tx) => {
    await ownWorkspace(tx, userId, id)
    await ownWorkspace(tx, userId, from)
    await copyInto(
      tx,
      { userId, workspaceId: from },
      { userId, workspaceId: id },
      copyNeeds(kinds),
    )
  })
}

/** Ustawia bieżącą przestrzeń (sprawdza tylko, czy należy do konta; ciasteczko ustawia trasa). */
export async function assertOwnWorkspace(userId: string, id: string) {
  return toWorkspace(await ownWorkspace(db, userId, id))
}

export async function updatePrefs(
  userId: string,
  input: z.infer<typeof prefsInput>,
) {
  await db
    .update(t.userSettings)
    .set({
      ...(input.apply === undefined
        ? {}
        : {
            workspaceApply: sql`${t.userSettings.workspaceApply} || ${JSON.stringify(input.apply)}::jsonb`,
          }),
      ...(input.askDaily === undefined
        ? {}
        : { askWorkspaceDaily: input.askDaily }),
    })
    .where(eq(t.userSettings.userId, userId))
}

/**
 * Przestrzenie, do których trafia zmiana: bieżąca albo wszystkie przestrzenie konta
 * (bieżąca zawsze pierwsza, bo jej wynik wraca do klienta).
 */
export async function applyTargets(
  tx: Tx,
  scope: Scope,
  applyTo: ApplyTarget | undefined,
): Promise<Array<Scope>> {
  if (applyTo !== 'all') return [scope]
  const rows = await workspacesOf(tx, scope.userId)
  return [
    scope,
    ...rows
      .filter((r) => r.id !== scope.workspaceId)
      .map((r) => ({ userId: scope.userId, workspaceId: r.id })),
  ]
}

/** Id przestrzeni, do których trafia zmiana (bieżąca pierwsza). */
export const targetIds = async (
  scope: Scope,
  applyTo: ApplyTarget | undefined,
) => (await applyTargets(db, scope, applyTo)).map((x) => x.workspaceId)
