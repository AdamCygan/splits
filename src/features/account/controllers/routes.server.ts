import {
  enableTwoFactorRequest,
  revokeOtherSessionsRequest,
  changePasswordRequest,
  deleteAccountRequest,
  exportAccount,
  requestEmailChange,
  disableTwoFactorRequest,
  newRecoveryCodesRequest,
  updateProfile,
  cancelEmailChange,
  resendVerification,
  setupTwoFactor,
  listSessions,
  revokeOwnSession,
  sendDeleteCode,
  currentUser,
} from './../data/repository.server'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { REFRESH_COOKIE } from '#/features/auth/data/tokens.server'
import { newRecoveryCodes } from '#/features/auth/data/totp.server'
import type { AppEnv } from '#/server/http/context'
import { body } from '#/server/http/inputs'
import {
  deleteAccountInput,
  emailChangeInput,
  identityInput,
  passwordChangeInput,
  profileInput,
  totpEnableInput,
} from '../data/inputs.server'
import { rateLimit } from '#/server/http/rate-limit'
import { clearRefreshCookie } from '#/features/auth/controllers/routes.server'
import { toUser } from '#/features/auth/data/mappers.server'
import { securityStatus } from '../data/notifications.server'

export const accountRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(toUser(await currentUser(c.get('userId')))))

  /**
   * Eksport wszystkich danych konta do pliku JSON (prawo do przenoszenia danych, RODO art. 20).
   * Bez haseł, tokenów i identyfikatorów Stripe.
   */
  .get('/export', async (c) => {
    const userId = c.get('userId')
    rateLimit(`export:${userId}`, 10, 60 * 60_000)
    c.header(
      'Content-Disposition',
      `attachment; filename="timeblame-export-${new Date().toISOString().slice(0, 10)}.json"`,
    )
    return c.json(await exportAccount(userId))
  })

  .put('/profile', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, profileInput)
    return c.json(await updateProfile(userId, input))
  })

  /**
   * Zmiana e-maila: hasło (i kod 2FA, jeśli włączone), potem link na nowy adres.
   * Adres zmienia się dopiero po kliknięciu, stary dostaje ostrzeżenie.
   */
  .post('/email', async (c) => {
    const userId = c.get('userId')
    rateLimit(`email-change:${userId}`, 5, 60 * 60_000)
    const input = await body(c, emailChangeInput)
    const email = input.email.trim()
    await requestEmailChange(userId, input, email)
    return c.body(null, 204)
  })

  /** Rezygnacja ze zmiany e-maila (link przestaje działać). */
  .delete('/email/pending', async (c) => {
    await cancelEmailChange(c.get('userId'))
    return c.body(null, 204)
  })

  /** Ponowne wysłanie linku potwierdzającego adres. */
  .post('/email/verify', async (c) => {
    const userId = c.get('userId')
    await resendVerification(userId)
    return c.body(null, 204)
  })

  /** Stan bezpieczeństwa: potwierdzenie adresu, oczekująca zmiana, 2FA, Google, kody. */
  .get('/security', async (c) =>
    c.json(await securityStatus(await currentUser(c.get('userId')))),
  )

  /** Początek włączania 2FA: nowy sekret do zeskanowania (zapisuje się dopiero po kodzie). */
  .post('/2fa/setup', async (c) => {
    const user = await currentUser(c.get('userId'))
    return c.json(setupTwoFactor(user))
  })

  /** Włączenie 2FA: kod z aplikacji dla tego sekretu (+ hasło); zwraca kody zapasowe raz. */
  .post('/2fa/enable', async (c) => {
    const userId = c.get('userId')
    rateLimit(`2fa:${userId}`, 10, 15 * 60_000)
    const input = await body(c, totpEnableInput)
    const currentToken = getCookie(c, REFRESH_COOKIE)
    const codes = newRecoveryCodes()
    return c.json(
      await enableTwoFactorRequest(userId, input, currentToken, codes),
    )
  })

  /** Wyłączenie 2FA: hasło (jeśli jest) i aktualny kod albo kod zapasowy. */
  .post('/2fa/disable', async (c) => {
    const userId = c.get('userId')
    rateLimit(`2fa:${userId}`, 10, 15 * 60_000)
    const input = await body(c, identityInput)
    await disableTwoFactorRequest(userId, input)
    return c.body(null, 204)
  })

  /** Nowe kody zapasowe (stare przestają działać); wymaga kodu 2FA. */
  .post('/2fa/recovery-codes', async (c) => {
    const userId = c.get('userId')
    rateLimit(`2fa:${userId}`, 10, 15 * 60_000)
    const input = await body(c, identityInput)
    const codes = newRecoveryCodes()
    return c.json(await newRecoveryCodesRequest(userId, input, codes))
  })

  /** Urządzenia z aktywną sesją (rodziny refresh tokenów), bieżące oznaczone. */
  .get('/sessions', async (c) => {
    const current = getCookie(c, REFRESH_COOKIE)
    return c.json(await listSessions(c.get('userId'), current))
  })

  /** Wylogowanie jednego urządzenia. */
  .delete('/sessions/:id', async (c) => {
    await revokeOwnSession(c.get('userId'), c.req.param('id'))
    return c.body(null, 204)
  })

  /** Wylogowanie wszystkich urządzeń poza tym. */
  .post('/sessions/revoke-others', async (c) => {
    const userId = c.get('userId')
    const currentToken = getCookie(c, REFRESH_COOKIE)
    await revokeOtherSessionsRequest(userId, currentToken)
    return c.body(null, 204)
  })

  .post('/password', async (c) => {
    const userId = c.get('userId')
    rateLimit(`password:${userId}`, 10, 15 * 60_000)
    const input = await body(c, passwordChangeInput)
    const currentToken = getCookie(c, REFRESH_COOKIE)
    await changePasswordRequest(userId, input, currentToken)
    return c.body(null, 204)
  })

  /** Kod do usunięcia konta na adres konta (konto demo usuwa się samo po 24 h). */
  .post('/delete-code', async (c) => {
    const userId = c.get('userId')
    await sendDeleteCode(userId)
    return c.body(null, 204)
  })

  .delete('/', async (c) => {
    const userId = c.get('userId')
    // Kod ma 6 cyfr: limit prób na konto chroni przed zgadywaniem.
    rateLimit(`delete:${userId}`, 10, 15 * 60_000)
    const input = await body(c, deleteAccountInput)
    await deleteAccountRequest(userId, input)
    clearRefreshCookie(c)
    return c.body(null, 204)
  })
