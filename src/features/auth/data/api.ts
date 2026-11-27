import { sessionSchema, loginResultSchema } from './dto'
import type { AuthSession, LoginInput, LoginResult, RegisterInput } from './dto'
import type { Locale } from '#/i18n/config'
import { apiRequest, emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { base } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

/** Endpointy auth: 401 oznacza złe dane, a nie wygasłą sesję — bez automatycznego odświeżania. */
const auth = <T>(path: string, schema: z.ZodType<T>, body?: unknown) =>
  apiRequest(`${base}/auth${path}`, {
    method: 'POST',
    schema,
    body,
    retryOnUnauthorized: false,
  })

export interface AuthApi {
  register: (input: RegisterInput) => R<AuthSession>
  login: (input: LoginInput) => R<LoginResult>
  /** Drugi krok logowania: kod z aplikacji albo kod zapasowy. */
  loginWithCode: (mfaToken: string, code: string) => R<AuthSession>
  /** Link z e-maila: potwierdzenie adresu albo nowego adresu. */
  confirmEmail: (token: string) => R<{ kind: 'verified' | 'changed' }>
  /** Odtwarza sesję z refresh tokenu (ciasteczko httpOnly). */
  restore: () => R<AuthSession>
  logout: () => R<undefined>
  forgotPassword: (email: string) => R<undefined>
  resetPassword: (token: string, password: string) => R<undefined>
  providers: () => R<{ google: boolean }>
  /** Konto demo z przykładowymi danymi, bez rejestracji (usuwane po 24 h). */
  demo: (input: { locale: Locale; timezone?: string }) => R<AuthSession>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const authApi: AuthApi = {
  register: (input) => auth('/register', sessionSchema, input),
  login: (input) => auth('/login', loginResultSchema, input),
  loginWithCode: (mfaToken, code) =>
    auth('/login/2fa', sessionSchema, { mfaToken, code }),
  confirmEmail: (token) =>
    auth(
      '/email/confirm',
      z.object({ kind: z.enum(['verified', 'changed']) }),
      { token },
    ),
  restore: () => auth('/refresh', sessionSchema),
  logout: () => auth('/logout', emptyResponse),
  forgotPassword: (email) => auth('/forgot-password', emptyResponse, { email }),
  resetPassword: (token, password) =>
    auth('/reset-password', emptyResponse, { token, password }),
  providers: () =>
    apiRequest(`${base}/auth/providers`, {
      schema: z.object({ google: z.boolean() }),
      retryOnUnauthorized: false,
    }),
  demo: (input) => auth('/demo', sessionSchema, input),
}
