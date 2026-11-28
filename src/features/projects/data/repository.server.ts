import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { assertFreeSlot } from '#/features/billing/data/limits.server'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { database } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { countRows, lowerName } from '#/server/db/helpers'
import * as schema from '#/server/db/schema'
import { conflict, notFound } from '#/server/http/errors'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'
import type { ProjectInput } from './dto'
import { toProject } from './mappers.server'

export async function ownProject(transaction: Tx, scope: Scope, id: string) {
  const [row] = await transaction
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), inScope(schema.projects, scope)))
  return row
}

export const activeProjects = (transaction: Tx, scope: Scope) =>
  countRows(
    transaction
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.projects)
      .where(
        and(
          inScope(schema.projects, scope),
          isNull(schema.projects.archivedAt),
        ),
      ),
  )

interface ProjectIdentity {
  name: string
  key: string | null
}

export async function assertProjectUnique(
  transaction: Tx,
  scope: Scope,
  input: ProjectIdentity,
  exceptId?: string,
) {
  const others = await transaction
    .select()
    .from(schema.projects)
    .where(
      and(
        inScope(schema.projects, scope),
        exceptId ? ne(schema.projects.id, exceptId) : undefined,
      ),
    )
  const isNameTaken = others.some(
    (other) => lowerName(other.name) === lowerName(input.name),
  )
  if (isNameTaken) throw conflict('name_taken', 'name')
  const isKeyTaken =
    input.key && others.some((other) => other.key === input.key)
  if (isKeyTaken) throw conflict('key_taken', 'key')
}

const freeProjectSlot = (transaction: Tx, scope: Scope) =>
  assertFreeSlot(
    scope.userId,
    () => activeProjects(transaction, scope),
    FREE_LIMITS.projects,
    'plan.limit_projects',
  )

/** Projekty konta, alfabetycznie. */
export async function listProjects(scope: Scope) {
  const rows = await database
    .select()
    .from(schema.projects)
    .where(inScope(schema.projects, scope))
    .orderBy(asc(schema.projects.name))
  return rows.map(toProject)
}

/** Nowy projekt (unikalna nazwa i klucz, limit planu Free). */
export async function createProject(scope: Scope, input: ProjectInput) {
  const row = await database.transaction(async (transaction) => {
    await freeProjectSlot(transaction, scope)
    await assertProjectUnique(transaction, scope, input)
    const [created] = await transaction
      .insert(schema.projects)
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
  const row = await database.transaction(async (transaction) => {
    const isForeignProject = !(await ownProject(transaction, scope, id))
    if (isForeignProject) throw notFound()
    await assertProjectUnique(transaction, scope, input, id)
    const [updated] = await transaction
      .update(schema.projects)
      .set(input)
      .where(eq(schema.projects.id, id))
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
  const mine = and(eq(schema.projects.id, id), inScope(schema.projects, scope))
  const row = await database.transaction(async (transaction) => {
    const [project] = await transaction
      .select({ archivedAt: schema.projects.archivedAt })
      .from(schema.projects)
      .where(mine)
    if (!project) throw notFound()
    const isRestoring = !archived && project.archivedAt
    if (isRestoring) await freeProjectSlot(transaction, scope)
    const [updated] = await transaction
      .update(schema.projects)
      .set({ archivedAt: archived ? new Date() : null })
      .where(mine)
      .returning()
    return updated!
  })
  return toProject(row)
}
