import { settingsSchema } from './dto'
import type { UserSettings } from './dto'
import { get, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface SettingsApi {
  get: () => R<UserSettings>
  update: (input: UserSettings) => R<UserSettings>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const settingsApi: SettingsApi = {
  get: () => get('/settings', settingsSchema),
  update: (input) => send('PUT', '/settings', settingsSchema, input),
}
