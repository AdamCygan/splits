import { actionsInput, listActions } from '../data/actions.server'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { parse } from '#/server/http/inputs'

/** Dziennik zmian z filtrami i stronicowaniem, od najnowszych. */
export const actionRoutes = new Hono<AppEnv>().get(
  '/actions',
  async (context) => {
    const input = parse(actionsInput, context.req.query())
    return context.json(await listActions(input))
  },
)
