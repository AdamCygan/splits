import { Hono } from 'hono'
import { z } from 'zod'
import { describeDevice } from '#/lib/user-agent'
import { db } from '#/server/db/client'
import type { AppEnv } from '#/server/http/context'
import { ApiError, invalid, notFound } from '#/server/http/errors'
import { body } from '#/server/http/inputs'
import { listInvoices } from '#/features/billing/controllers/routes.server'
import {
  cancelPendingEmail,
  disableTwoFactor,
  notify,
  revokeSession,
  sendEmailConfirmation,
  sessionsOf,
} from '#/features/account/data/notifications.server'
import { findUser, log, revokeAllSessions } from '../data/shared.server'

/** Powód wyłączenia 2FA trafia do dziennika: jak potwierdzono, że prosi właściciel konta. */
const twoFactorInput = z.object({ reason: z.string().trim().min(10).max(300) })

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
    await db.transaction(async (tx) => {
      await sendEmailConfirmation(tx, user, null)
      await log(tx, admin, user, 'email.verification_sent')
    })
    return c.body(null, 204)
  })

  .delete('/users/:id/email/pending', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    await db.transaction(async (tx) => {
      const pending = await cancelPendingEmail(tx, user.id)
      if (!pending) throw notFound()
      await log(tx, admin, user, 'email.change_canceled', pending)
    })
    return c.body(null, 204)
  })

  /** Wylogowanie jednego urządzenia (rodziny refresh tokenów). */
  .delete('/users/:id/sessions/:sessionId', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    const sessionId = c.req.param('sessionId')
    const session = (await sessionsOf(user.id, null)).find(
      (s) => s.id === sessionId,
    )
    if (!session) throw notFound()
    const device = describeDevice(session.userAgent)
    await db.transaction(async (tx) => {
      await revokeSession(tx, user.id, sessionId)
      await log(
        tx,
        admin,
        user,
        'session.revoked',
        [device ? `${device.browser}, ${device.os}` : null, session.ip]
          .filter(Boolean)
          .join(' · ') || null,
      )
    })
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
    await db.transaction(async (tx) => {
      await disableTwoFactor(tx, user.id)
      await revokeAllSessions(tx, user.id)
      await log(tx, admin, user, 'two_factor.disabled', input.reason)
    })
    await notify(user, 'twoFactorOff')
    return c.body(null, 204)
  })

  /** Faktury klienta ze Stripe; samo obejrzenie też trafia do dziennika (dane rozliczeniowe). */
  .get('/users/:id/invoices', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    const invoices = await listInvoices(user.stripeCustomerId)
    if (user.stripeCustomerId)
      await db.transaction((tx) => log(tx, admin, user, 'invoices.viewed'))
    return c.json(invoices)
  })
