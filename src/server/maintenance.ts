import { and, eq, lt, or } from 'drizzle-orm'
import { db } from './db/client'
import { authTokens, refreshTokens, stripeEvents, users } from './db/schema'
import { reportError } from './monitoring'

export const DEMO_LIFETIME_HOURS = 24
const HOUR = 3_600_000
const DAY = 24 * HOUR

/**
 * Sprzątanie bazy. Bez niego tabele rosną bez końca: każde odświeżenie sesji (co 15 minut
 * na aktywnego użytkownika) dopisuje wiersz do refresh_tokens.
 *  - konta demo starsze niż 24 h (ON DELETE CASCADE usuwa ich dane),
 *  - refresh tokeny wygasłe albo unieważnione ponad dobę temu (doba zostaje na wykrycie kradzieży),
 *  - tokeny resetu hasła wygasłe ponad dobę temu,
 *  - znaczniki webhooków Stripe starsze niż 90 dni (Stripe ponawia zdarzenia najwyżej przez 3 dni).
 */
export async function runMaintenance(now = Date.now()) {
  const demo = await db
    .delete(users)
    .where(
      and(
        eq(users.isDemo, true),
        lt(users.createdAt, new Date(now - DEMO_LIFETIME_HOURS * HOUR)),
      ),
    )
    .returning({ id: users.id })
  const sessions = await db
    .delete(refreshTokens)
    .where(
      or(
        lt(refreshTokens.expiresAt, new Date(now)),
        lt(refreshTokens.revokedAt, new Date(now - DAY)),
      ),
    )
    .returning({ id: refreshTokens.id })
  const tokens = await db
    .delete(authTokens)
    .where(lt(authTokens.expiresAt, new Date(now - DAY)))
    .returning({ id: authTokens.id })
  const events = await db
    .delete(stripeEvents)
    .where(lt(stripeEvents.processedAt, new Date(now - 90 * DAY)))
    .returning({ id: stripeEvents.id })
  return {
    demoAccounts: demo.length,
    refreshTokens: sessions.length,
    authTokens: tokens.length,
    stripeEvents: events.length,
  }
}

let timer: ReturnType<typeof setInterval> | null = null

/** Co godzinę, pierwszy raz minutę po starcie. Timer nie trzyma procesu przy życiu. */
export function startMaintenance() {
  if (timer) return
  const run = () =>
    runMaintenance().catch((error: unknown) => {
      console.error('[maintenance]', error)
      void reportError(error, { tags: { area: 'maintenance' } })
    })
  setTimeout(run, 60_000).unref()
  timer = setInterval(run, HOUR)
  timer.unref()
}
