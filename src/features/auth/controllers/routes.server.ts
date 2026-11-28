import type { GoogleClaims } from '../data/repository.server'
import {
  endSession,
  registerAccount,
  createDemoAccount,
  loginWithPassword,
  loginWithSecondFactor,
  confirmEmail,
  requestPasswordReset,
  resetPassword,
  MAX_FAILED_LOGINS,
  LOCKOUT_MINUTES,
  lower,
  signInWithGoogle,
  refreshSession,
} from '../data/repository.server'
import {
  demoInput,
  emailInput,
  loginInput,
  mfaLoginInput,
  registerInput,
  resetInput,
  tokenInput,
} from '../data/inputs.server'
import { REFRESH_COOKIE, randomToken } from '../data/tokens.server'
import {
  GOOGLE_COOKIE_PATH,
  clearRefreshCookie,
  googleCallback,
  googleJwks,
  requestMeta,
  respondWithSession,
  safeRedirect,
  secure,
} from './http.server'
import { isLocale } from '#/i18n/config'
import type { Locale } from '#/i18n/config'
import { serverEnv } from '#/server/env'
import type { AppEnv } from '#/server/http/context'
import { ApiError } from '#/server/http/errors'
import { body, timezone as timezoneSchema } from '#/server/http/inputs'
import { rateLimit } from '#/server/http/rate-limit'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { jwtVerify } from 'jose'
import { createHash } from 'node:crypto'

export const authRoutes = new Hono<AppEnv>()
  .get('/providers', (c) => c.json({ google: serverEnv.google !== null }))

  .post('/register', async (c) => {
    const meta = requestMeta(c)
    rateLimit(`register:${meta.ip}`, 10, 60 * 60_000)
    const input = await body(c, registerInput)
    return c.json(
      respondWithSession(c, await registerAccount(meta, input)),
      201,
    )
  })

  /**
   * Konto demo bez rejestracji: jednorazowe konto z przykładowymi danymi i planem Pro.
   * Nie ma hasła ani prawdziwego adresu, nie może kupować ani zmieniać danych konta,
   * a po 24 h jest usuwane (src/server/maintenance.ts).
   */
  .post('/demo', async (c) => {
    const meta = requestMeta(c)
    rateLimit(`demo:${meta.ip}`, 10, 60 * 60_000)
    const input = await body(c, demoInput)
    return c.json(
      respondWithSession(c, await createDemoAccount(meta, input)),
      201,
    )
  })

  .post('/login', async (c) => {
    const meta = requestMeta(c)
    const input = await body(c, loginInput)
    rateLimit(`login-ip:${meta.ip}`, 30, 15 * 60_000)
    // Ten sam próg co blokada konta: nieistniejący login też dostaje 429 po tylu próbach,
    // więc odpowiedź 429 nie zdradza, czy konto istnieje.
    rateLimit(
      `login:${lower(input.login)}`,
      MAX_FAILED_LOGINS,
      LOCKOUT_MINUTES * 60_000,
    )
    const result = await loginWithPassword(meta, input)
    // 2FA: hasło się zgadza, ale sesja dopiero po kodzie z aplikacji.
    return c.json(
      'mfaRequired' in result ? result : respondWithSession(c, result),
    )
  })

  /** Drugi krok logowania: bilet z pierwszego kroku + kod z aplikacji albo kod zapasowy. */
  .post('/login/2fa', async (c) => {
    const meta = requestMeta(c)
    const input = await body(c, mfaLoginInput)
    rateLimit(`mfa-ip:${meta.ip}`, 30, 15 * 60_000)
    return c.json(
      respondWithSession(c, await loginWithSecondFactor(meta, input)),
    )
  })

  /** Link z e-maila: potwierdzenie adresu po rejestracji albo nowego adresu po zmianie. */
  .post('/email/confirm', async (c) => {
    const meta = requestMeta(c)
    rateLimit(`email-confirm:${meta.ip}`, 30, 60 * 60_000)
    const { token } = await body(c, tokenInput)
    return c.json(await confirmEmail(token))
  })

  .post('/refresh', async (c) => {
    const token = getCookie(c, REFRESH_COOKIE)
    if (!token) throw new ApiError('auth.no_session', 401)
    const opened = await refreshSession(token, requestMeta(c))
    if (!opened) {
      clearRefreshCookie(c)
      throw new ApiError('auth.no_session', 401)
    }
    return c.json(respondWithSession(c, opened))
  })

  .post('/logout', async (c) => {
    const token = getCookie(c, REFRESH_COOKIE)
    if (token) await endSession(token)
    clearRefreshCookie(c)
    return c.body(null, 204)
  })

  .post('/forgot-password', async (c) => {
    const meta = requestMeta(c)
    rateLimit(`forgot:${meta.ip}`, 10, 60 * 60_000)
    const { email } = await body(c, emailInput)
    const locale = c.get('locale')
    rateLimit(`forgot:${lower(email)}`, 3, 60 * 60_000)
    await requestPasswordReset(email, locale)
    return c.body(null, 204)
  })

  .post('/reset-password', async (c) => {
    const meta = requestMeta(c)
    rateLimit(`reset:${meta.ip}`, 20, 60 * 60_000)
    const input = await body(c, resetInput)
    await resetPassword(input)
    return c.body(null, 204)
  })

  .get('/google', (c) => {
    const google = serverEnv.google
    const redirectTo = safeRedirect(c.req.query('redirect'))
    if (!google) return c.redirect('/login?error=google_unavailable')
    const state = randomToken()
    const verifier = randomToken()
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const tz = timezoneSchema.safeParse(c.req.query('tz'))
    const cookie = {
      httpOnly: true,
      secure,
      sameSite: 'Lax' as const,
      path: GOOGLE_COOKIE_PATH,
      maxAge: 600,
    }
    setCookie(c, 'g_state', state, cookie)
    setCookie(c, 'g_verifier', verifier, cookie)
    setCookie(c, 'g_redirect', redirectTo, cookie)
    setCookie(c, 'g_tz', tz.success ? tz.data : 'UTC', cookie)
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.search = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: googleCallback(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString()
    return c.redirect(url.toString())
  })

  .get('/google/callback', async (c) => {
    const google = serverEnv.google
    const fail = () => c.redirect('/login?error=google')
    const state = getCookie(c, 'g_state')
    const verifier = getCookie(c, 'g_verifier')
    const redirectTo = safeRedirect(getCookie(c, 'g_redirect'))
    const tz = getCookie(c, 'g_tz') ?? 'UTC'
    for (const name of ['g_state', 'g_verifier', 'g_redirect', 'g_tz'])
      deleteCookie(c, name, { path: GOOGLE_COOKIE_PATH, secure })
    const code = c.req.query('code')
    if (
      !google ||
      !code ||
      !state ||
      !verifier ||
      c.req.query('state') !== state
    )
      return fail()

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: googleCallback(),
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
    }).catch(() => null)
    if (!tokenResponse?.ok) return fail()
    const { id_token: idToken } = (await tokenResponse.json()) as {
      id_token?: string
    }
    if (!idToken) return fail()

    let claims: GoogleClaims
    try {
      const { payload } = await jwtVerify(idToken, googleJwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: google.clientId,
      })
      claims = payload as typeof claims
    } catch {
      return fail()
    }
    if (!claims.email || claims.email_verified !== true) return fail()
    const localeCookie = getCookie(c, 'app_locale')
    const locale: Locale = isLocale(localeCookie)
      ? localeCookie
      : c.get('locale')
    const verified = { ...claims, email: claims.email }

    const outcome = await signInWithGoogle(verified, locale, tz, requestMeta(c))
    if (outcome.opened) respondWithSession(c, outcome.opened)
    if (outcome.blocked) return c.redirect('/login?error=disabled')
    if (outcome.mfaToken)
      return c.redirect(
        `/login?${new URLSearchParams({ mfa: outcome.mfaToken, redirect: redirectTo }).toString()}`,
      )
    return c.redirect(redirectTo)
  })
