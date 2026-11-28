import { scaleSchema } from './dto'
import type { SpScaleStep } from './dto'
import { get, send, withApply } from '#/shared/data/http'
import type { ApplyTo, R } from '#/shared/data/http'

export interface SpScaleApi {
  get: () => R<Array<SpScaleStep>>
  replace: (
    steps: Array<Omit<SpScaleStep, 'id'>>,
    apply?: ApplyTo,
  ) => R<Array<SpScaleStep>>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const spScaleApi: SpScaleApi = {
  get: () => get('/story-point-scale', scaleSchema),
  replace: (steps, apply) =>
    send('PUT', withApply('/story-point-scale', apply), scaleSchema, {
      steps,
    }),
}
