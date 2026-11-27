import { securityStatusSchema, activeSessionSchema } from './dto'
import type {
  ActiveSession,
  IdentityInput,
  PasswordChangeInput,
  ProfileInput,
  SecurityStatus,
} from './dto'
import { userSchema } from '#/features/auth/data/dto'
import type { User } from '#/features/auth/data/dto'
import { emptyResponse } from '#/lib/api-client'
import { z } from '#/lib/zod'
import { get, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface AccountApi {
  me: () => R<User>
  updateProfile: (input: ProfileInput) => R<User>
  changePassword: (input: PasswordChangeInput) => R<undefined>
  /** Kod do usunięcia konta na e-mail (ważny 15 minut). */
  sendDeleteCode: () => R<undefined>
  deleteAccount: (code: string) => R<undefined>
  security: () => R<SecurityStatus>
  /** Zmiana e-maila: link na nowy adres, zmiana dopiero po kliknięciu. */
  changeEmail: (input: { email: string } & IdentityInput) => R<undefined>
  cancelEmailChange: () => R<undefined>
  resendVerification: () => R<undefined>
  twoFactorSetup: () => R<{ secret: string; otpauthUrl: string }>
  twoFactorEnable: (input: {
    secret: string
    code: string
    password?: string
  }) => R<{ recoveryCodes: Array<string> }>
  twoFactorDisable: (input: IdentityInput) => R<undefined>
  newRecoveryCodes: (
    input: IdentityInput,
  ) => R<{ recoveryCodes: Array<string> }>
  sessions: () => R<Array<ActiveSession>>
  revokeSession: (id: string) => R<undefined>
  revokeOtherSessions: () => R<undefined>
  /** Wszystkie dane konta jako obiekt JSON (do pobrania jako plik). */
  exportData: () => R<unknown>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const accountApi: AccountApi = {
  me: () => get('/account', userSchema),
  updateProfile: (input) => send('PUT', '/account/profile', userSchema, input),
  changePassword: (input) =>
    send('POST', '/account/password', emptyResponse, input),
  sendDeleteCode: () => send('POST', '/account/delete-code', emptyResponse),
  deleteAccount: (code) => send('DELETE', '/account', emptyResponse, { code }),
  security: () => get('/account/security', securityStatusSchema),
  changeEmail: (input) => send('POST', '/account/email', emptyResponse, input),
  cancelEmailChange: () =>
    send('DELETE', '/account/email/pending', emptyResponse),
  resendVerification: () =>
    send('POST', '/account/email/verify', emptyResponse),
  twoFactorSetup: () =>
    send(
      'POST',
      '/account/2fa/setup',
      z.object({ secret: z.string(), otpauthUrl: z.string() }),
    ),
  twoFactorEnable: (input) =>
    send(
      'POST',
      '/account/2fa/enable',
      z.object({ recoveryCodes: z.array(z.string()) }),
      input,
    ),
  twoFactorDisable: (input) =>
    send('POST', '/account/2fa/disable', emptyResponse, input),
  newRecoveryCodes: (input) =>
    send(
      'POST',
      '/account/2fa/recovery-codes',
      z.object({ recoveryCodes: z.array(z.string()) }),
      input,
    ),
  sessions: () => get('/account/sessions', z.array(activeSessionSchema)),
  revokeSession: (id) =>
    send('DELETE', `/account/sessions/${id}`, emptyResponse),
  revokeOtherSessions: () =>
    send('POST', '/account/sessions/revoke-others', emptyResponse),
  exportData: () => get('/account/export', z.unknown()),
}
