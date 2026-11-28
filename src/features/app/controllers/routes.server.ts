import { getBootstrap } from './../data/repository.server'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'

/**
 * Start panelu jednym żądaniem: konto, ustawienia, konfiguracja i dzisiejszy dzień.
 * Wcześniej ekran „Dziś” wysyłał 8 osobnych żądań, a lista wpisów czekała dodatkowo
 * na ustawienia (strefa czasowa). Tu serwer zna strefę, więc wszystko wraca naraz.
 */
export const bootstrapRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const userId = c.get('userId')
  return c.json(await getBootstrap(userId))
})
