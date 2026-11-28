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
  .get('/providers', (context) =>
    context.json({ google: serverEnv.google !== null }),
  )

  .post('/register', async (context) => {
    const meta = requestMeta(context)
    rateLimit(`register:${meta.ip}`, 10, 60 * 60_000)
    const input = await body(context, registerInput)
    return context.json(
      respondWithSession(context, await registerAccount(meta, input)),
      201,
    )
  })

  /**
   * Konto demo bez rejestracji: jednorazowe konto z przykładowymi danymi i planem Pro.
   * Nie ma hasła ani prawdziwego adresu, nie może kupować ani zmieniać danych konta,
   * a po 24 h jest usuwane (src/server/maintenance.ts).
   */
  .post('/demo', async (context) => {
    const meta = requestMeta(context)
    rateLimit(`demo:${meta.ip}`, 10, 60 * 60_000)
    const input = await body(context, demoInput)
    return context.json(
      respondWithSession(context, await createDemoAccount(meta, input)),
      201,
    )
  })

  .post('/login', async (context) => {
    const meta = requestMeta(context)
    const input = await body(context, loginInput)
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
    return context.json(
      'mfaRequired' in result ? result : respondWithSession(context, result),
    )
  })

  /** Drugi krok logowania: bilet z pierwszego kroku + kod z aplikacji albo kod zapasowy. */
  .post('/login/2fa', async (context) => {
    const meta = requestMeta(context)
    const input = await body(context, mfaLoginInput)
    rateLimit(`mfa-ip:${meta.ip}`, 30, 15 * 60_000)
    return context.json(
      respondWithSession(context, await loginWithSecondFactor(meta, input)),
    )
  })

  /** Link z e-maila: potwierdzenie adresu po rejestracji albo nowego adresu po zmianie. */
  .post('/email/confirm', async (context) => {
    const meta = requestMeta(context)
    rateLimit(`email-confirm:${meta.ip}`, 30, 60 * 60_000)
    const { token } = await body(context, tokenInput)
    return context.json(await confirmEmail(token))
  })

  .post('/refresh', async (context) => {
    const token = getCookie(context, REFRESH_COOKIE)
    if (!token) throw new ApiError('auth.no_session', 401)
    const opened = await refreshSession(token, requestMeta(context))
    if (!opened) {
      clearRefreshCookie(context)
      throw new ApiError('auth.no_session', 401)
    }
    return context.json(respondWithSession(context, opened))
  })

  .post('/logout', async (context) => {
    const token = getCookie(context, REFRESH_COOKIE)
    if (token) await endSession(token)
    clearRefreshCookie(context)
    return context.body(null, 204)
  })

  .post('/forgot-password', async (context) => {
    const meta = requestMeta(context)
    rateLimit(`forgot:${meta.ip}`, 10, 60 * 60_000)
    const { email } = await body(context, emailInput)
    const locale = context.get('locale')
    rateLimit(`forgot:${lower(email)}`, 3, 60 * 60_000)
    await requestPasswordReset(email, locale)
    return context.body(null, 204)
  })

  .post('/reset-password', async (context) => {
    const meta = requestMeta(context)
    rateLimit(`reset:${meta.ip}`, 20, 60 * 60_000)
    const input = await body(context, resetInput)
    await resetPassword(input)
    return context.body(null, 204)
  })

  .get('/google', (context) => {
    const google = serverEnv.google
    const redirectTo = safeRedirect(context.req.query('redirect'))
    if (!google) return context.redirect('/login?error=google_unavailable')
    const state = randomToken()
    const verifier = randomToken()
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const timeZone = timezoneSchema.safeParse(context.req.query('tz'))
    const cookie = {
      httpOnly: true,
      secure,
      sameSite: 'Lax' as const,
      path: GOOGLE_COOKIE_PATH,
      maxAge: 600,
    }
    setCookie(context, 'g_state', state, cookie)
    setCookie(context, 'g_verifier', verifier, cookie)
    setCookie(context, 'g_redirect', redirectTo, cookie)
    setCookie(context, 'g_tz', timeZone.success ? timeZone.data : 'UTC', cookie)
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
    return context.redirect(url.toString())
  })

  .get('/google/callback', async (context) => {
    const google = serverEnv.google
    const fail = () => context.redirect('/login?error=google')
    const state = getCookie(context, 'g_state')
    const verifier = getCookie(context, 'g_verifier')
    const redirectTo = safeRedirect(getCookie(context, 'g_redirect'))
    const timeZone = getCookie(context, 'g_tz') ?? 'UTC'
    for (const name of ['g_state', 'g_verifier', 'g_redirect', 'g_tz'])
      deleteCookie(context, name, { path: GOOGLE_COOKIE_PATH, secure })
    const code = context.req.query('code')
    const isInvalidCallback =
      !google ||
      !code ||
      !state ||
      !verifier ||
      context.req.query('state') !== state
    if (isInvalidCallback) return fail()

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
    const { email } = claims
    const isUnverifiedEmail = !email || claims.email_verified !== true
    if (isUnverifiedEmail) return fail()
    const localeCookie = getCookie(context, 'app_locale')
    const locale: Locale = isLocale(localeCookie)
      ? localeCookie
      : context.get('locale')
    const verified = { ...claims, email }

    const outcome = await signInWithGoogle(
      verified,
      locale,
      timeZone,
      requestMeta(context),
    )
    if (outcome.opened) respondWithSession(context, outcome.opened)
    if (outcome.blocked) return context.redirect('/login?error=disabled')
    if (outcome.mfaToken)
      return context.redirect(
        `/login?${new URLSearchParams({ mfa: outcome.mfaToken, redirect: redirectTo }).toString()}`,
      )
    return context.redirect(redirectTo)
  })
