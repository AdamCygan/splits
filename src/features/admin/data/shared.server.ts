import { and, eq, isNull } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'
import type { AdminActionKind } from '#/features/admin/domain/admin'
import { db } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import { adminActions, refreshTokens, users } from '#/server/db/schema'
import { serverEnv } from '#/server/env'
import type { AppEnv } from '#/server/http/context'
import { ApiError, notFound } from '#/server/http/errors'

export type UserRow = typeof users.$inferSelect

export const PAGE_SIZE = 25
export const ACTIVE_SUBSCRIPTION = ['active', 'trialing', 'past_due']
export const DAY = 86_400_000

/**
 * Dostęp tylko dla roli „admin”, sprawdzanej w bazie przy każdym żądaniu (odebranie roli
 * działa od razu). Przy ADMIN_REQUIRE_2FA=true admin musi mieć logowanie dwuetapowe.
 */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, c.get('userId')))
  if (!user || user.role !== 'admin' || user.disabledAt)
    throw new ApiError('auth.forbidden', 403)
  if (serverEnv.adminRequire2fa && !user.totpEnabledAt)
    throw new ApiError('admin.two_factor_required', 403)
  c.set('admin', user)
  await next()
}

/** Wpis w dzienniku zmian; `target` = null przy akcjach na wielu kontach. */
export function log(
  tx: Tx,
  admin: UserRow,
  target: Pick<UserRow, 'id' | 'email'> | null,
  action: AdminActionKind,
  detail: string | null = null,
) {
  return tx.insert(adminActions).values({
    adminId: admin.id,
    adminEmail: admin.email,
    targetUserId: target?.id ?? null,
    targetEmail: target?.email ?? null,
    action,
    detail,
  })
}

export async function findUser(id: string) {
  if (!z.uuid().safeParse(id).success) throw notFound()
  const [user] = await db.select().from(users).where(eq(users.id, id))
  if (!user) throw notFound()
  return user
}

export const revokeAllSessions = (tx: Tx, userId: string) =>
  tx
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
    )
