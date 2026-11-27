import {
  resendUserVerification,
  cancelUserEmailChange,
  revokeUserSession,
  disableUserTwoFactor,
  listUserInvoices,
  twoFactorInput,
} from './../data/support.server'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { ApiError, invalid, notFound } from '#/server/http/errors'
import { body } from '#/server/http/inputs'
import { findUser } from '../data/shared.server'

/**
 * Obsługa klienta: link potwierdzający, oczekująca zmiana e-maila, pojedyncze urządzenia,
 * 2FA po utracie telefonu i faktury. Każda akcja trafia do dziennika zmian.
 */
export const supportRoutes = new Hono<AppEnv>()
  .post('/users/:id/email/verify', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    if (user.isDemo) throw invalid()
    if (user.emailVerifiedAt) throw new ApiError('auth.already_verified', 409)
    await resendUserVerification(admin, user)
    return c.body(null, 204)
  })

  .delete('/users/:id/email/pending', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    await cancelUserEmailChange(admin, user)
    return c.body(null, 204)
  })

  /** Wylogowanie jednego urządzenia (rodziny refresh tokenów). */
  .delete('/users/:id/sessions/:sessionId', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    const sessionId = c.req.param('sessionId')
    await revokeUserSession(admin, user, sessionId)
    return c.body(null, 204)
  })

  /**
   * Wyłączenie 2FA po utracie telefonu: tylko po sprawdzeniu tożsamości (powód w dzienniku).
   * Konto jest wylogowane wszędzie, a właściciel dostaje e-mail. Nie na własnym koncie.
   */
  .post('/users/:id/2fa/disable', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    const input = await body(c, twoFactorInput)
    if (user.id === admin.id) throw new ApiError('admin.self', 400)
    if (!user.totpEnabledAt) throw notFound()
    await disableUserTwoFactor(admin, user, input)
    return c.body(null, 204)
  })

  /** Faktury klienta ze Stripe; samo obejrzenie też trafia do dziennika (dane rozliczeniowe). */
  .get('/users/:id/invoices', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    return c.json(await listUserInvoices(admin, user))
  })
