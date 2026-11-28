import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { and, asc, eq } from 'drizzle-orm'
import { database } from '#/server/db/client'
import * as schema from '#/server/db/schema'
import { notFound } from '#/server/http/errors'
import type { TagInput } from './dto'
import { toTag } from './mappers.server'

const ownTag = (scope: Scope, id: string) =>
  and(eq(schema.tags.id, id), inScope(schema.tags, scope))

/** Tagi konta, alfabetycznie. */
export async function listTags(scope: Scope) {
  const rows = await database
    .select()
    .from(schema.tags)
    .where(inScope(schema.tags, scope))
    .orderBy(asc(schema.tags.name))
  return rows.map(toTag)
}

export async function createTag(scope: Scope, input: TagInput) {
  const [created] = await database
    .insert(schema.tags)
    .values({ ...input, ...owner(scope) })
    .returning()
  return toTag(created!)
}

export async function updateTag(scope: Scope, id: string, input: TagInput) {
  const [row] = await database
    .update(schema.tags)
    .set(input)
    .where(ownTag(scope, id))
    .returning()
  if (!row) throw notFound()
  return toTag(row)
}

export async function removeTag(scope: Scope, id: string) {
  await database.delete(schema.tags).where(ownTag(scope, id))
}
