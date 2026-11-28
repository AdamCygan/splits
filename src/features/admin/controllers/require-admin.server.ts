import { db } from '#/server/db/client'
import { users } from '#/server/db/schema'
import { serverEnv } from '#/server/env'
import type { AppEnv } from '#/server/http/context'
import { ApiError } from '#/server/http/errors'
import { eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'

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
