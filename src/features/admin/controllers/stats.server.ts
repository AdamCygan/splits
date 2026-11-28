import { getStats } from '../data/stats.server'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'

/**
 * Liczby na górze panelu. Aktywni = konta, które dodały wpis czasu w okresie (a nie tylko
 * się zalogowały). Przychód = faktycznie zapłacone kwoty minus zwroty (tabela payments,
 * z webhooków Stripe), osobno dla każdej waluty.
 */
export const statsRoutes = new Hono<AppEnv>().get('/stats', async (context) => {
  return context.json(await getStats())
})
