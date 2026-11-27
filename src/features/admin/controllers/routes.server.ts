import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { actionRoutes } from './actions.server'
import { requireAdmin } from '../data/shared.server'
import { statsRoutes } from './stats.server'
import { supportRoutes } from './support.server'
import { userRoutes } from './users.server'

/**
 * Panel administratora (/api/v1/admin). Dostęp tylko dla roli „admin”, sprawdzanej w bazie
 * przy każdym żądaniu. Administrator widzi dane konta i liczniki, ale nie treść wpisów
 * czasu użytkowników. Każda zmiana (i wgląd w faktury) trafia do dziennika admin_actions.
 */
export const adminRoutes = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .route('/', statsRoutes)
  .route('/', userRoutes)
  .route('/', supportRoutes)
  .route('/', actionRoutes)
