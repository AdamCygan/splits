import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { currentUser } from '#/features/account/data/repository.server'
import { seedWorkspaceData } from '#/features/auth/data/workspace.server'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'
import { copyNeeds } from '#/features/workspaces/domain/workspaces'
import type {
  ApplyTarget,
  CopyKind,
} from '#/features/workspaces/domain/workspaces'
import { database } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { lowerName } from '#/server/db/helpers'
import * as schema from '#/server/db/schema'
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

const toWorkspace = (
  row: typeof schema.workspaces.$inferSelect,
): Workspace => ({
  id: row.id,
  name: row.name,
  color: row.color,
})

/** Przestrzenie konta w kolejności z ustawień. */
export const workspacesOf = (transaction: Tx, userId: string) =>
  transaction
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.userId, userId))
    .orderBy(asc(schema.workspaces.sortOrder), asc(schema.workspaces.createdAt))

/**
 * Bieżąca przestrzeń żądania: ta z ciasteczka, jeśli należy do konta, inaczej pierwsza.
 * Konto bez przestrzeni (nie powinno się zdarzyć) dostaje nową, żeby aplikacja działała.
 */
export async function resolveWorkspace(
  userId: string,
  requested: string | undefined,
) {
  const rows = await database
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.userId, userId))
    .orderBy(asc(schema.workspaces.sortOrder), asc(schema.workspaces.createdAt))
  if (requested && rows.some((row) => row.id === requested)) return requested
  if (rows[0]) return rows[0].id
  // Konto usunięte przed chwilą (token jeszcze ważny): sesja już nie istnieje.
  const [user] = await database
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
  if (!user) throw new ApiError('auth.no_session', 401)
  return database.transaction(async (transaction) => {
    const { locale, timezone } = await accountLocale(transaction, userId)
    const [row] = await transaction
      .insert(schema.workspaces)
      .values({ userId, name: 'Workspace', color: '#3D3BF3' })
      .returning()
    await seedWorkspaceData(
      transaction,
      { userId, workspaceId: row!.id },
      locale,
      timezone,
    )
    return row!.id
  })
}

async function accountLocale(transaction: Tx, userId: string) {
  const [userSetting] = await transaction
    .select({
      locale: schema.userSettings.locale,
      timezone: schema.userSettings.timezone,
    })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
  return {
    locale: userSetting?.locale === 'pl' ? ('pl' as const) : ('en' as const),
    timezone: userSetting?.timezone ?? 'UTC',
  }
}

export async function getWorkspaceState(scope: Scope): Promise<WorkspaceState> {
  const [rows, [prefs]] = await Promise.all([
    workspacesOf(database, scope.userId),
    database
      .select({
        apply: schema.userSettings.workspaceApply,
        askDaily: schema.userSettings.askWorkspaceDaily,
      })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, scope.userId)),
  ])
  return {
    current: scope.workspaceId,
    items: rows.map(toWorkspace),
    prefs: { apply: prefs?.apply ?? {}, askDaily: prefs?.askDaily ?? true },
  }
}

/** Przestrzeń konta albo 404 (cudza wygląda tak samo jak nieistniejąca). */
async function ownWorkspace(transaction: Tx, userId: string, id: string) {
  const [row] = await transaction
    .select()
    .from(schema.workspaces)
    .where(
      and(eq(schema.workspaces.id, id), eq(schema.workspaces.userId, userId)),
    )
  if (!row) throw notFound()
  return row
}

async function assertNameFree(
  transaction: Tx,
  userId: string,
  name: string,
  exceptId?: string,
) {
  const [taken] = await transaction
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(
      and(
        eq(schema.workspaces.userId, userId),
        sql`lower(${schema.workspaces.name}) = ${lowerName(name)}`,
        exceptId ? ne(schema.workspaces.id, exceptId) : undefined,
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
  const row = await database.transaction(async (transaction) => {
    const user = await currentUser(userId)
    const existing = await workspacesOf(transaction, userId)
    if (!hasProAccess(user) && existing.length >= FREE_LIMITS.workspaces)
      throw new ApiError('plan.limit_workspaces', 403)
    await assertNameFree(transaction, userId, input.name)
    const source = input.copyFrom
      ? await ownWorkspace(transaction, userId, input.copyFrom)
      : null
    const [created] = await transaction
      .insert(schema.workspaces)
      .values({
        userId,
        name: input.name.trim(),
        color: input.color,
        sortOrder: existing.length,
      })
      .returning()
    const { locale, timezone } = await accountLocale(transaction, userId)
    const to = { userId, workspaceId: created!.id }
    await seedWorkspaceData(transaction, to, locale, timezone)
    if (source && input.copy.length)
      await copyInto(
        transaction,
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
  const row = await database.transaction(async (transaction) => {
    await ownWorkspace(transaction, userId, id)
    await assertNameFree(transaction, userId, input.name, id)
    const [updated] = await transaction
      .update(schema.workspaces)
      .set({ name: input.name.trim(), color: input.color })
      .where(eq(schema.workspaces.id, id))
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
  await database.transaction(async (transaction) => {
    for (const [key, id] of ids.entries())
      await transaction
        .update(schema.workspaces)
        .set({ sortOrder: key })
        .where(
          and(
            eq(schema.workspaces.id, id),
            eq(schema.workspaces.userId, userId),
          ),
        )
  })
  return (await workspacesOf(database, userId)).map(toWorkspace)
}

/**
 * Usuwa przestrzeń z całą zawartością (projekty, sprinty, wpisy…). Ostatniej nie da się usunąć.
 * Działający timer albo przerwa w tej przestrzeni znikają razem z nią.
 */
export async function deleteWorkspace(userId: string, id: string) {
  await database.transaction(async (transaction) => {
    await ownWorkspace(transaction, userId, id)
    const all = await workspacesOf(transaction, userId)
    if (all.length <= 1) throw new ApiError('workspace.last', 409)
    await transaction
      .delete(schema.workspaces)
      .where(eq(schema.workspaces.id, id))
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
  await database.transaction(async (transaction) => {
    await ownWorkspace(transaction, userId, id)
    await ownWorkspace(transaction, userId, from)
    await copyInto(
      transaction,
      { userId, workspaceId: from },
      { userId, workspaceId: id },
      copyNeeds(kinds),
    )
  })
}

/** Ustawia bieżącą przestrzeń (sprawdza tylko, czy należy do konta; ciasteczko ustawia trasa). */
export async function assertOwnWorkspace(userId: string, id: string) {
  return toWorkspace(await ownWorkspace(database, userId, id))
}

export async function updatePrefs(
  userId: string,
  input: z.infer<typeof prefsInput>,
) {
  await database
    .update(schema.userSettings)
    .set({
      ...(input.apply === undefined
        ? {}
        : {
            workspaceApply: sql`${schema.userSettings.workspaceApply} || ${JSON.stringify(input.apply)}::jsonb`,
          }),
      ...(input.askDaily === undefined
        ? {}
        : { askWorkspaceDaily: input.askDaily }),
    })
    .where(eq(schema.userSettings.userId, userId))
}

/**
 * Przestrzenie, do których trafia zmiana: bieżąca albo wszystkie przestrzenie konta
 * (bieżąca zawsze pierwsza, bo jej wynik wraca do klienta).
 */
export async function applyTargets(
  transaction: Tx,
  scope: Scope,
  applyTo: ApplyTarget | undefined,
): Promise<Array<Scope>> {
  if (applyTo !== 'all') return [scope]
  const rows = await workspacesOf(transaction, scope.userId)
  return [
    scope,
    ...rows
      .filter((row) => row.id !== scope.workspaceId)
      .map((row) => ({ userId: scope.userId, workspaceId: row.id })),
  ]
}

/** Id przestrzeni, do których trafia zmiana (bieżąca pierwsza). */
export const targetIds = async (
  scope: Scope,
  applyTo: ApplyTarget | undefined,
) =>
  (await applyTargets(database, scope, applyTo)).map(
    (scopedRow) => scopedRow.workspaceId,
  )
