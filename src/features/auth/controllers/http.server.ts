import {
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_DAYS,
} from '../data/tokens.server'
import type { OpenedSession } from '../data/repository.server'
import { serverEnv } from '#/server/env'
import { clientIp } from '#/server/http/client-ip'
import type { Context } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { createRemoteJWKSet } from 'jose'

export const secure = serverEnv.appUrl.startsWith('https://')

export function requestMeta(c: Context) {
  return {
    ip: clientIp(c.req, serverEnv.clientIpHeader),
    userAgent: c.req.header('user-agent') ?? null,
  }
}

/** Ustawia ciasteczko z refresh tokenem i zwraca sesję do odpowiedzi. */
export function respondWithSession(c: Context, opened: OpenedSession) {
  setRefreshCookie(c, opened.refreshToken)
  return opened.session
}

function setRefreshCookie(c: Context, token: string) {
  setCookie(c, REFRESH_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_DAYS * 86_400,
  })
}

export function clearRefreshCookie(c: Context) {
  deleteCookie(c, REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH, secure })
}

// ---------------------------------------------------------------------------
// Google (OAuth 2.0 + OpenID Connect, kod autoryzacyjny z PKCE)
// ---------------------------------------------------------------------------

export const GOOGLE_COOKIE_PATH = '/api/v1/auth/google'

export const googleJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
)

export const googleCallback = () =>
  `${serverEnv.appUrl}/api/v1/auth/google/callback`

/** Tylko ścieżki w obrębie aplikacji (bez „//host”), żeby nikt nie zrobił z nas przekierowania na obcą stronę. */
export const safeRedirect = (value: string | undefined) =>
  value && /^\/(?!\/)[\w\-./?=&%#]*$/.test(value) ? value : '/app'
