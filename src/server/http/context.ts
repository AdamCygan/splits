import type { Locale } from '#/i18n/config'
import type { users } from '../db/schema'

/** Zmienne dostępne w handlerach Hono (`c.get('userId')`). */
export interface AppEnv {
  Variables: {
    locale: Locale
    userId: string
    traceId: string
    /** Tylko w /admin: zalogowany administrator (ustawia requireAdmin). */
    admin?: typeof users.$inferSelect
  }
}
