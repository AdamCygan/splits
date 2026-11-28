import type { Context } from 'hono'
import type { Scope } from '#/server/db/scope'
import type { AppEnv } from './context'

/** Konto i bieżąca przestrzeń żądania (ustawia middleware przestrzeni). */
export const scopeOf = (c: Context<AppEnv>): Scope => ({
  userId: c.get('userId'),
  workspaceId: c.get('workspaceId'),
})
