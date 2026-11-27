import { dayOffSchema } from './dto'
import type { DayOff, DayOffInput } from './dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

/** Dni wolne: urlop, L4, święta. */
export interface DaysOffApi {
  list: (from: string, to: string) => R<Array<DayOff>>
  /** Zaznacza zakres (dni pracy z ustawień; jeden dzień zawsze), zwraca zapisane dni. */
  set: (input: DayOffInput) => R<Array<DayOff>>
  remove: (from: string, to: string) => R<undefined>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const daysOffApi: DaysOffApi = {
  list: (from, to) =>
    get(
      `/days-off?${new URLSearchParams({ from, to })}`,
      z.array(dayOffSchema),
    ),
  set: (input) => send('PUT', '/days-off', z.array(dayOffSchema), input),
  remove: (from, to) =>
    send(
      'DELETE',
      `/days-off?${new URLSearchParams({ from, to })}`,
      emptyResponse,
    ),
}
