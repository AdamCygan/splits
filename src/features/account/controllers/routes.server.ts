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
} from '../data/repository.server'
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
import { clearRefreshCookie } from '#/features/auth/controllers/http.server'
import { toUser } from '#/features/auth/data/mappers.server'
import { securityStatus } from '../data/notifications.server'

export const accountRoutes = new Hono<AppEnv>()
  .get('/', async (context) =>
    context.json(toUser(await currentUser(context.get('userId')))),
  )

  /**
   * Eksport wszystkich danych konta do pliku JSON (prawo do przenoszenia danych, RODO art. 20).
   * Bez haseł, tokenów i identyfikatorów Stripe.
   */
  .get('/export', async (context) => {
    const userId = context.get('userId')
    rateLimit(`export:${userId}`, 10, 60 * 60_000)
    context.header(
      'Content-Disposition',
      `attachment; filename="timeblame-export-${new Date().toISOString().slice(0, 10)}.json"`,
    )
    return context.json(await exportAccount(userId))
  })

  .put('/profile', async (context) => {
    const userId = context.get('userId')
    const input = await body(context, profileInput)
    return context.json(await updateProfile(userId, input))
  })

  /**
   * Zmiana e-maila: hasło (i kod 2FA, jeśli włączone), potem link na nowy adres.
   * Adres zmienia się dopiero po kliknięciu, stary dostaje ostrzeżenie.
   */
  .post('/email', async (context) => {
    const userId = context.get('userId')
    rateLimit(`email-change:${userId}`, 5, 60 * 60_000)
    const input = await body(context, emailChangeInput)
    const email = input.email.trim()
    await requestEmailChange(userId, input, email)
    return context.body(null, 204)
  })

  /** Rezygnacja ze zmiany e-maila (link przestaje działać). */
  .delete('/email/pending', async (context) => {
    await cancelEmailChange(context.get('userId'))
    return context.body(null, 204)
  })

  /** Ponowne wysłanie linku potwierdzającego adres. */
  .post('/email/verify', async (context) => {
    const userId = context.get('userId')
    await resendVerification(userId)
    return context.body(null, 204)
  })

  /** Stan bezpieczeństwa: potwierdzenie adresu, oczekująca zmiana, 2FA, Google, kody. */
  .get('/security', async (context) =>
    context.json(
      await securityStatus(await currentUser(context.get('userId'))),
    ),
  )

  /** Początek włączania 2FA: nowy sekret do zeskanowania (zapisuje się dopiero po kodzie). */
  .post('/2fa/setup', async (context) => {
    const user = await currentUser(context.get('userId'))
    return context.json(setupTwoFactor(user))
  })

  /** Włączenie 2FA: kod z aplikacji dla tego sekretu (+ hasło); zwraca kody zapasowe raz. */
  .post('/2fa/enable', async (context) => {
    const userId = context.get('userId')
    rateLimit(`2fa:${userId}`, 10, 15 * 60_000)
    const input = await body(context, totpEnableInput)
    const currentToken = getCookie(context, REFRESH_COOKIE)
    const codes = newRecoveryCodes()
    return context.json(
      await enableTwoFactorRequest(userId, input, currentToken, codes),
    )
  })

  /** Wyłączenie 2FA: hasło (jeśli jest) i aktualny kod albo kod zapasowy. */
  .post('/2fa/disable', async (context) => {
    const userId = context.get('userId')
    rateLimit(`2fa:${userId}`, 10, 15 * 60_000)
    const input = await body(context, identityInput)
    await disableTwoFactorRequest(userId, input)
    return context.body(null, 204)
  })

  /** Nowe kody zapasowe (stare przestają działać); wymaga kodu 2FA. */
  .post('/2fa/recovery-codes', async (context) => {
    const userId = context.get('userId')
    rateLimit(`2fa:${userId}`, 10, 15 * 60_000)
    const input = await body(context, identityInput)
    const codes = newRecoveryCodes()
    return context.json(await newRecoveryCodesRequest(userId, input, codes))
  })

  /** Urządzenia z aktywną sesją (rodziny refresh tokenów), bieżące oznaczone. */
  .get('/sessions', async (context) => {
    const current = getCookie(context, REFRESH_COOKIE)
    return context.json(await listSessions(context.get('userId'), current))
  })

  /** Wylogowanie jednego urządzenia. */
  .delete('/sessions/:id', async (context) => {
    await revokeOwnSession(context.get('userId'), context.req.param('id'))
    return context.body(null, 204)
  })

  /** Wylogowanie wszystkich urządzeń poza tym. */
  .post('/sessions/revoke-others', async (context) => {
    const userId = context.get('userId')
    const currentToken = getCookie(context, REFRESH_COOKIE)
    await revokeOtherSessionsRequest(userId, currentToken)
    return context.body(null, 204)
  })

  .post('/password', async (context) => {
    const userId = context.get('userId')
    rateLimit(`password:${userId}`, 10, 15 * 60_000)
    const input = await body(context, passwordChangeInput)
    const currentToken = getCookie(context, REFRESH_COOKIE)
    await changePasswordRequest(userId, input, currentToken)
    return context.body(null, 204)
  })

  /** Kod do usunięcia konta na adres konta (konto demo usuwa się samo po 24 h). */
  .post('/delete-code', async (context) => {
    const userId = context.get('userId')
    await sendDeleteCode(userId)
    return context.body(null, 204)
  })

  .delete('/', async (context) => {
    const userId = context.get('userId')
    // Kod ma 6 cyfr: limit prób na konto chroni przed zgadywaniem.
    rateLimit(`delete:${userId}`, 10, 15 * 60_000)
    const input = await body(context, deleteAccountInput)
    await deleteAccountRequest(userId, input)
    clearRefreshCookie(context)
    return context.body(null, 204)
  })
