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

export async function ownProject(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select({ id: t.projects.id })
    .from(t.projects)
    .where(and(eq(t.projects.id, id), eq(t.projects.userId, userId)))
  return row
}

export const activeProjects = (tx: Tx, userId: string) =>
  countRows(
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(t.projects)
      .where(and(eq(t.projects.userId, userId), isNull(t.projects.archivedAt))),
  )

interface ProjectIdentity {
  name: string
  key: string | null
}

export async function assertProjectUnique(
  tx: Tx,
  userId: string,
  input: ProjectIdentity,
  exceptId?: string,
) {
  const others = await tx
    .select()
    .from(t.projects)
    .where(
      and(
        eq(t.projects.userId, userId),
        exceptId ? ne(t.projects.id, exceptId) : undefined,
      ),
    )
  if (others.some((p) => lowerName(p.name) === lowerName(input.name)))
    throw conflict('name_taken', 'name')
  if (input.key && others.some((p) => p.key === input.key))
    throw conflict('key_taken', 'key')
}

const freeProjectSlot = (tx: Tx, userId: string) =>
  assertFreeSlot(
    userId,
    () => activeProjects(tx, userId),
    FREE_LIMITS.projects,
    'plan.limit_projects',
  )

/** Projekty konta, alfabetycznie. */
export async function listProjects(userId: string) {
  const rows = await db
    .select()
    .from(t.projects)
    .where(eq(t.projects.userId, userId))
    .orderBy(asc(t.projects.name))
  return rows.map(toProject)
}

/** Nowy projekt (unikalna nazwa i klucz, limit planu Free). */
export async function createProject(userId: string, input: ProjectInput) {
  const row = await db.transaction(async (tx) => {
    await freeProjectSlot(tx, userId)
    await assertProjectUnique(tx, userId, input)
    const [created] = await tx
      .insert(t.projects)
      .values({ ...input, userId })
      .returning()
    return created!
  })
  return toProject(row)
}

export async function updateProject(
  userId: string,
  id: string,
  input: ProjectInput,
) {
  const row = await db.transaction(async (tx) => {
    if (!(await ownProject(tx, userId, id))) throw notFound()
    await assertProjectUnique(tx, userId, input, id)
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
  userId: string,
  id: string,
  archived: boolean,
) {
  const mine = and(eq(t.projects.id, id), eq(t.projects.userId, userId))
  const row = await db.transaction(async (tx) => {
    const [project] = await tx
      .select({ archivedAt: t.projects.archivedAt })
      .from(t.projects)
      .where(mine)
    if (!project) throw notFound()
    if (!archived && project.archivedAt) await freeProjectSlot(tx, userId)
    const [updated] = await tx
      .update(t.projects)
      .set({ archivedAt: archived ? new Date() : null })
      .where(mine)
      .returning()
    return updated!
  })
  return toProject(row)
}
