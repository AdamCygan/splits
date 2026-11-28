import type { UserRow, findUser } from './shared.server'

import { z } from 'zod'

import { describeDevice } from '#/lib/user-agent'

import { database } from '#/server/db/client'

import { notFound } from '#/server/http/errors'

import { listInvoices } from '#/features/billing/data/repository.server'

import {
  cancelPendingEmail,
  disableTwoFactor,
  notify,
  revokeSession,
  sendEmailConfirmation,
  sessionsOf,
} from '#/features/account/data/notifications.server'

import { log, revokeAllSessions } from './shared.server'

/** Powód wyłączenia 2FA trafia do dziennika: jak potwierdzono, że prosi właściciel konta. */
export const twoFactorInput = z.object({
  reason: z.string().trim().min(10).max(300),
})

export async function resendUserVerification(
  admin: UserRow,
  user: Awaited<ReturnType<typeof findUser>>,
) {
  await database.transaction(async (transaction) => {
    await sendEmailConfirmation(transaction, user, null)
    await log(transaction, admin, user, 'email.verification_sent')
  })
  return
}

export async function cancelUserEmailChange(
  admin: UserRow,
  user: Awaited<ReturnType<typeof findUser>>,
) {
  await database.transaction(async (transaction) => {
    const pending = await cancelPendingEmail(transaction, user.id)
    if (!pending) throw notFound()
    await log(transaction, admin, user, 'email.change_canceled', pending)
  })
  return
}

/** Wylogowanie jednego urządzenia (rodziny refresh tokenów). */
export async function revokeUserSession(
  admin: UserRow,
  user: Awaited<ReturnType<typeof findUser>>,
  sessionId: string,
) {
  const session = (await sessionsOf(user.id, null)).find(
    (activeSession) => activeSession.id === sessionId,
  )
  if (!session) throw notFound()
  const device = describeDevice(session.userAgent)
  await database.transaction(async (transaction) => {
    await revokeSession(transaction, user.id, sessionId)
    await log(
      transaction,
      admin,
      user,
      'session.revoked',
      [
        device ? `${device.browser}, ${device.operatingSystem}` : null,
        session.ip,
      ]
        .filter(Boolean)
        .join(' · ') || null,
    )
  })
  return
}

/**
 * Wyłączenie 2FA po utracie telefonu: tylko po sprawdzeniu tożsamości (powód w dzienniku).
 * Konto jest wylogowane wszędzie, a właściciel dostaje e-mail. Nie na własnym koncie.
 */
export async function disableUserTwoFactor(
  admin: UserRow,
  user: Awaited<ReturnType<typeof findUser>>,
  input: z.infer<typeof twoFactorInput>,
) {
  await database.transaction(async (transaction) => {
    await disableTwoFactor(transaction, user.id)
    await revokeAllSessions(transaction, user.id)
    await log(transaction, admin, user, 'two_factor.disabled', input.reason)
  })
  await notify(user, 'twoFactorOff')
  return
}

/** Faktury klienta ze Stripe; samo obejrzenie też trafia do dziennika (dane rozliczeniowe). */
export async function listUserInvoices(
  admin: UserRow,
  user: Awaited<ReturnType<typeof findUser>>,
) {
  const invoices = await listInvoices(user.stripeCustomerId)
  if (user.stripeCustomerId)
    await database.transaction((transaction) =>
      log(transaction, admin, user, 'invoices.viewed'),
    )
  return invoices
}
