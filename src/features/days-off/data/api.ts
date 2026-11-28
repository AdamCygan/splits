import { dayOffSchema } from './dto'
import type { DayOff, DayOffInput } from './dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send, withApply } from '#/shared/data/http'
import type { ApplyTo, R } from '#/shared/data/http'

/** Dni wolne: urlop, L4, święta. */
export interface DaysOffApi {
  list: (from: string, to: string) => R<Array<DayOff>>
  /** Zaznacza zakres (dni pracy z ustawień; jeden dzień zawsze), zwraca zapisane dni. */
  set: (input: DayOffInput, apply?: ApplyTo) => R<Array<DayOff>>
  remove: (from: string, to: string, apply?: ApplyTo) => R<undefined>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const daysOffApi: DaysOffApi = {
  list: (from, to) =>
    get(
      `/days-off?${new URLSearchParams({ from, to })}`,
      z.array(dayOffSchema),
    ),
  set: (input, apply) =>
    send('PUT', withApply('/days-off', apply), z.array(dayOffSchema), input),
  remove: (from, to, apply) =>
    send(
      'DELETE',
      withApply(`/days-off?${new URLSearchParams({ from, to })}`, apply),
      emptyResponse,
    ),
}
