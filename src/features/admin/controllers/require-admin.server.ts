import type { MiddlewareHandler } from 'hono'
import { serverEnv } from '#/server/env'
import type { AppEnv } from '#/server/http/context'
import { ApiError } from '#/server/http/errors'
import { findUser } from '../data/shared.server'

/**
 * Dostęp tylko dla roli „admin”, sprawdzanej w bazie przy każdym żądaniu (odebranie roli
 * działa od razu). Przy ADMIN_REQUIRE_2FA=true admin musi mieć logowanie dwuetapowe.
 */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (
  context,
  next,
) => {
  const user = await findUser(context.get('userId')).catch((error: unknown) => {
    const isApiError = error instanceof ApiError
    if (isApiError) return null
    throw error
  })
  const isNotActiveAdmin = !user || user.role !== 'admin' || user.disabledAt
  if (isNotActiveAdmin) throw new ApiError('auth.forbidden', 403)
  const isMissingRequiredTwoFactor =
    serverEnv.adminRequire2fa && !user.totpEnabledAt
  if (isMissingRequiredTwoFactor)
    throw new ApiError('admin.two_factor_required', 403)
  context.set('admin', user)
  await next()
}
