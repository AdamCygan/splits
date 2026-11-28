import type { Context } from 'hono'
import type { Scope } from '#/server/db/scope'
import type { AppEnv } from './context'

/** Konto i bieżąca przestrzeń żądania (ustawia middleware przestrzeni). */
export const scopeOf = (context: Context<AppEnv>): Scope => ({
  userId: context.get('userId'),
  workspaceId: context.get('workspaceId'),
})
