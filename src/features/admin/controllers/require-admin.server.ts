import type { MiddlewareHandler } from 'hono'
import { serverEnv } from '#/server/env'
import type { AppEnv } from '#/server/http/context'
import { ApiError } from '#/server/http/errors'
import { findUser } from '../data/shared.server'

/**
 * Dostęp tylko dla roli „admin”, sprawdzanej w bazie przy każdym żądaniu (odebranie roli
 * działa od razu). Przy ADMIN_REQUIRE_2FA=true admin musi mieć logowanie dwuetapowe.
 */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await findUser(c.get('userId')).catch((error: unknown) => {
    if (error instanceof ApiError) return null
    throw error
  })
  if (!user || user.role !== 'admin' || user.disabledAt)
    throw new ApiError('auth.forbidden', 403)
  if (serverEnv.adminRequire2fa && !user.totpEnabledAt)
    throw new ApiError('admin.two_factor_required', 403)
  c.set('admin', user)
  await next()
}
