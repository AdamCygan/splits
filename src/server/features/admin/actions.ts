import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { ADMIN_ACTION_KINDS } from '#/features/admin/domain/admin'
import { db } from '../../db/client'
import { adminActions } from '../../db/schema'
import type { AppEnv } from '../../http/context'
import { parse } from '../../http/inputs'
import { PAGE_SIZE } from './shared'

const actionsInput = z.object({
  /** Fragment adresu admina. */
  admin: z.string().trim().max(320).optional(),
  /** Fragment adresu konta, którego dotyczy akcja. */
  target: z.string().trim().max(320).optional(),
  /** Dokładnie to konto (historia na stronie użytkownika). */
  targetId: z.uuid().optional(),
  action: z.enum(ADMIN_ACTION_KINDS).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

const like = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`

/** Dziennik zmian z filtrami i stronicowaniem, od najnowszych. */
export const actionRoutes = new Hono<AppEnv>().get('/actions', async (c) => {
  const input = parse(actionsInput, c.req.query())
  const where = and(
    input.admin ? ilike(adminActions.adminEmail, like(input.admin)) : undefined,
    input.target
      ? or(ilike(adminActions.targetEmail, like(input.target)))
      : undefined,
    input.targetId ? eq(adminActions.targetUserId, input.targetId) : undefined,
    input.action ? eq(adminActions.action, input.action) : undefined,
  )
  const [[total], rows] = await Promise.all([
    db.select({ n: count() }).from(adminActions).where(where),
    db
      .select()
      .from(adminActions)
      .where(where)
      .orderBy(desc(adminActions.createdAt))
      .limit(PAGE_SIZE)
      .offset((input.page - 1) * PAGE_SIZE),
  ])
  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      adminEmail: r.adminEmail,
      targetUserId: r.targetUserId,
      targetEmail: r.targetEmail,
      action: r.action,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    })),
    total: total?.n ?? 0,
    page: input.page,
    pageSize: PAGE_SIZE,
  })
})
