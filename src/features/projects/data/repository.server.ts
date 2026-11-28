import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { assertFreeSlot } from '#/features/billing/data/limits.server'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { db } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { countRows, lowerName } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import { conflict, notFound } from '#/server/http/errors'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'
import type { ProjectInput } from './dto'
import { toProject } from './mappers.server'

export async function ownProject(tx: Tx, scope: Scope, id: string) {
  const [row] = await tx
    .select({ id: t.projects.id })
    .from(t.projects)
    .where(and(eq(t.projects.id, id), inScope(t.projects, scope)))
  return row
}

export const activeProjects = (tx: Tx, scope: Scope) =>
  countRows(
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(t.projects)
      .where(and(inScope(t.projects, scope), isNull(t.projects.archivedAt))),
  )

interface ProjectIdentity {
  name: string
  key: string | null
}

export async function assertProjectUnique(
  tx: Tx,
  scope: Scope,
  input: ProjectIdentity,
  exceptId?: string,
) {
  const others = await tx
    .select()
    .from(t.projects)
    .where(
      and(
        inScope(t.projects, scope),
        exceptId ? ne(t.projects.id, exceptId) : undefined,
      ),
    )
  if (others.some((p) => lowerName(p.name) === lowerName(input.name)))
    throw conflict('name_taken', 'name')
  if (input.key && others.some((p) => p.key === input.key))
    throw conflict('key_taken', 'key')
}

const freeProjectSlot = (tx: Tx, scope: Scope) =>
  assertFreeSlot(
    scope.userId,
    () => activeProjects(tx, scope),
    FREE_LIMITS.projects,
    'plan.limit_projects',
  )

/** Projekty konta, alfabetycznie. */
export async function listProjects(scope: Scope) {
  const rows = await db
    .select()
    .from(t.projects)
    .where(inScope(t.projects, scope))
    .orderBy(asc(t.projects.name))
  return rows.map(toProject)
}

/** Nowy projekt (unikalna nazwa i klucz, limit planu Free). */
export async function createProject(scope: Scope, input: ProjectInput) {
  const row = await db.transaction(async (tx) => {
    await freeProjectSlot(tx, scope)
    await assertProjectUnique(tx, scope, input)
    const [created] = await tx
      .insert(t.projects)
      .values({ ...input, ...owner(scope) })
      .returning()
    return created!
  })
  return toProject(row)
}

export async function updateProject(
  scope: Scope,
  id: string,
  input: ProjectInput,
) {
  const row = await db.transaction(async (tx) => {
    if (!(await ownProject(tx, scope, id))) throw notFound()
    await assertProjectUnique(tx, scope, input, id)
    const [updated] = await tx
      .update(t.projects)
      .set(input)
      .where(eq(t.projects.id, id))
      .returning()
    return updated!
  })
  return toProject(row)
}

/** Archiwizacja albo przywrócenie; przywrócenie liczy się do limitu planu Free. */
export async function setProjectArchived(
  scope: Scope,
  id: string,
  archived: boolean,
) {
  const mine = and(eq(t.projects.id, id), inScope(t.projects, scope))
  const row = await db.transaction(async (tx) => {
    const [project] = await tx
      .select({ archivedAt: t.projects.archivedAt })
      .from(t.projects)
      .where(mine)
    if (!project) throw notFound()
    if (!archived && project.archivedAt) await freeProjectSlot(tx, scope)
    const [updated] = await tx
      .update(t.projects)
      .set({ archivedAt: archived ? new Date() : null })
      .where(mine)
      .returning()
    return updated!
  })
  return toProject(row)
}
