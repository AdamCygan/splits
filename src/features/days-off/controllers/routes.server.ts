import { applyOf, inTargets } from '#/features/workspaces/data/sync.server'
import { scopeOf } from '#/server/http/scope'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { invalid } from '#/server/http/errors'
import { body, parse, rangeQuery } from '#/server/http/inputs'
import { diffDays } from '#/shared/domain/dates'
import { dayOffInput } from '../data/inputs.server'
import {
  listDaysOff,
  removeDaysOff,
  setDaysOff,
} from '../data/repository.server'

/** Najdłuższy zakres w jednym zapisie (rok urlopu z zapasem). */
const MAX_RANGE_DAYS = 366

export const dayOffRoutes = new Hono<AppEnv>()
  .get('/', async (context) => {
    const { from, to } = parse(rangeQuery, context.req.query())
    return context.json(await listDaysOff(scopeOf(context), from, to))
  })

  /**
   * Zaznacza zakres jako wolne. Weekendy i inne dni spoza dni pracy z ustawień są pomijane,
   * chyba że zakres to jeden dzień (np. dyżur w sobotę, który odbierasz). Zwraca zapisane dni.
   */
  .put('/', async (context) => {
    const input = await body(context, dayOffInput)
    if (input.to < input.from) throw invalid('to')
    const length = diffDays(input.from, input.to) + 1
    if (length > MAX_RANGE_DAYS) throw invalid('to')
    return context.json(
      await inTargets(scopeOf(context), applyOf(context), (scope) =>
        setDaysOff(scope, input, length),
      ),
    )
  })

  /** Usuwa dni wolne z zakresu (?from=&to=), np. cały urlop albo jeden dzień. */
  .delete('/', async (context) => {
    const { from, to } = parse(rangeQuery, context.req.query())
    if (to < from) throw invalid('to')
    await inTargets(scopeOf(context), applyOf(context), (scope) =>
      removeDaysOff(scope, from, to),
    )
    return context.body(null, 204)
  })
