import { bootstrapSchema } from './dto'
import type { Bootstrap } from './dto'
import { get } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface AppApi {
  /** Konto, konfiguracja i dzisiejszy dzień jednym żądaniem (start panelu). */
  bootstrap: () => R<Bootstrap>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const appApi: AppApi = {
  bootstrap: () => get('/bootstrap', bootstrapSchema),
}
