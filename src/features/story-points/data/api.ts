import { scaleSchema } from './dto'
import type { SpScaleStep } from './dto'
import { get, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface SpScaleApi {
  get: () => R<Array<SpScaleStep>>
  replace: (steps: Array<Omit<SpScaleStep, 'id'>>) => R<Array<SpScaleStep>>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const spScaleApi: SpScaleApi = {
  get: () => get('/story-point-scale', scaleSchema),
  replace: (steps) => send('PUT', '/story-point-scale', scaleSchema, { steps }),
}
