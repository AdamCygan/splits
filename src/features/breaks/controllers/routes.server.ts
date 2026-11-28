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
  .get('/', async (context) => {
    const { date } = parse(dateQuery, context.req.query())
    return context.json(await listBreaks(scopeOf(context), date))
  })

  /** Trwająca przerwa albo null. */
  .get('/running', async (context) => {
    return context.json(await getRunningBreak(scopeOf(context)))
  })

  /**
   * Start przerwy: działający timer zadania zostaje wstrzymany (jak „Wstrzymaj”), a przerwa
   * zapamiętuje je, żeby „Koniec przerwy” mogło je od razu wznowić.
   */
  .post('/start', async (context) => {
    const scope = scopeOf(context)
    return context.json(await startBreak(scope), 201)
  })

  /** Koniec przerwy: czas liczony od startu (co najmniej minuta); opcjonalnie wznawia zadanie. */
  .post('/:id/end', async (context) => {
    const scope = scopeOf(context)
    const { resume } = await body(context, breakEndInput)
    return context.json(await endBreak(scope, context.req.param('id'), resume))
  })

  /** Przerwa dopisana po fakcie (czas trwania albo godziny od–do). */
  .post('/', async (context) => {
    const scope = scopeOf(context)
    const input = await body(context, breakInput)
    return context.json(await addBreak(scope, input), 201)
  })

  .delete('/:id', async (context) => {
    const scope = scopeOf(context)
    await removeBreak(scope, context.req.param('id'))
    return context.body(null, 204)
  })
