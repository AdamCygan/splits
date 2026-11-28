import { actionsInput, listActions } from '../data/actions.server'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { parse } from '#/server/http/inputs'

/** Dziennik zmian z filtrami i stronicowaniem, od najnowszych. */
export const actionRoutes = new Hono<AppEnv>().get('/actions', async (c) => {
  const input = parse(actionsInput, c.req.query())
  return c.json(await listActions(input))
})
