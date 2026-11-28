import { scopeOf } from '#/server/http/scope'
import {
  listBreaks,
  getRunningBreak,
  startBreak,
  endBreak,
  addBreak,
  removeBreak,
} from '../data/repository.server'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { body, dateQuery, parse } from '#/server/http/inputs'
import { breakEndInput, breakInput } from '../data/inputs.server'

export const breakRoutes = new Hono<AppEnv>()
  /** Przerwy z dnia (?date=), od najwcześniejszej. */
  .get('/', async (c) => {
    const { date } = parse(dateQuery, c.req.query())
    return c.json(await listBreaks(scopeOf(c), date))
  })

  /** Trwająca przerwa albo null. */
  .get('/running', async (c) => {
    return c.json(await getRunningBreak(scopeOf(c)))
  })

  /**
   * Start przerwy: działający timer zadania zostaje wstrzymany (jak „Wstrzymaj”), a przerwa
   * zapamiętuje je, żeby „Koniec przerwy” mogło je od razu wznowić.
   */
  .post('/start', async (c) => {
    const scope = scopeOf(c)
    return c.json(await startBreak(scope), 201)
  })

  /** Koniec przerwy: czas liczony od startu (co najmniej minuta); opcjonalnie wznawia zadanie. */
  .post('/:id/end', async (c) => {
    const scope = scopeOf(c)
    const { resume } = await body(c, breakEndInput)
    return c.json(await endBreak(scope, c.req.param('id'), resume))
  })

  /** Przerwa dopisana po fakcie (czas trwania albo godziny od–do). */
  .post('/', async (c) => {
    const scope = scopeOf(c)
    const input = await body(c, breakInput)
    return c.json(await addBreak(scope, input), 201)
  })

  .delete('/:id', async (c) => {
    const scope = scopeOf(c)
    await removeBreak(scope, c.req.param('id'))
    return c.body(null, 204)
  })
