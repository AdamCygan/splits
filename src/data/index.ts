import { httpSource } from './http/http-source'
import type { DataSource } from './source'

/** Jedno miejsce wyboru źródła danych: API aplikacji pod /api/v1 (src/server). */
export const data: DataSource = httpSource

export type { DataSource } from './source'
