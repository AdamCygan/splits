import { and, count, desc, eq, ilike, or } from 'drizzle-orm'

import { z } from 'zod'

import { ADMIN_ACTION_KINDS } from '#/features/admin/domain/admin'

import { database } from '#/server/db/client'

import { adminActions } from '#/server/db/schema'

import { PAGE_SIZE } from './shared.server'

export const actionsInput = z.object({
  /** Fragment adresu admina. */
  admin: z.string().trim().max(320).optional(),
  /** Fragment adresu konta, którego dotyczy akcja. */
  target: z.string().trim().max(320).optional(),
  /** Dokładnie to konto (historia na stronie użytkownika). */
  targetId: z.uuid().optional(),
  action: z.enum(ADMIN_ACTION_KINDS).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export const like = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`

export async function listActions(input: z.infer<typeof actionsInput>) {
  const where = and(
    input.admin ? ilike(adminActions.adminEmail, like(input.admin)) : undefined,
    input.target
      ? or(ilike(adminActions.targetEmail, like(input.target)))
      : undefined,
    input.targetId ? eq(adminActions.targetUserId, input.targetId) : undefined,
    input.action ? eq(adminActions.action, input.action) : undefined,
  )
  const [[total], rows] = await Promise.all([
    database.select({ count: count() }).from(adminActions).where(where),
    database
      .select()
      .from(adminActions)
      .where(where)
      .orderBy(desc(adminActions.createdAt))
      .limit(PAGE_SIZE)
      .offset((input.page - 1) * PAGE_SIZE),
  ])
  return {
    items: rows.map((row) => ({
      id: row.id,
      adminEmail: row.adminEmail,
      targetUserId: row.targetUserId,
      targetEmail: row.targetEmail,
      action: row.action,
      detail: row.detail,
      createdAt: row.createdAt.toISOString(),
    })),
    total: total?.count ?? 0,
    page: input.page,
    pageSize: PAGE_SIZE,
  }
}
