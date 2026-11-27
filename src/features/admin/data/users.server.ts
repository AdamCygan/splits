import { eq } from 'drizzle-orm'

import { z } from 'zod'

import { cutAccess, restoreAccess } from '#/features/auth/data/access.server'

import { billingEnabled } from '#/features/billing/data/stripe.server'

import { db } from '#/server/db/client'

import { users } from '#/server/db/schema'

import {
  cancelSubscriptionsFor,
  stripeCustomerUrl,
} from '#/features/billing/data/repository.server'

import {
  securityStatus,
  sessionsOf,
} from '#/features/account/data/notifications.server'

import { PAGE_SIZE, log, revokeAllSessions } from './shared.server'

import type { UserRow, findUser } from './shared.server'

import { describeOne, findUsers, userFilterInput } from './users-query.server'

export const listInput = userFilterInput.extend({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export const patchInput = z
  .object({
    plan: z.enum(['free', 'pro', 'lifetime']),
    role: z.enum(['client', 'admin']),
    disabled: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0)

/** Usunięcie konta tylko po przepisaniu jego adresu e-mail (ochrona przed pomyłką). */
export const deleteInput = z.object({
  confirmEmail: z.string().trim().max(320),
})

/** Krótki opis filtrów eksportu do dziennika (bez wartości pustych). */
export const describeFilter = (filter: Record<string, unknown>) =>
  Object.entries(filter)
    .filter(([key, value]) => value !== undefined && key !== 'dir')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ')

export async function listUsers(
  page: number,
  filter: Omit<z.infer<typeof listInput>, 'page'>,
) {
  const result = await findUsers(filter, { size: PAGE_SIZE, number: page })
  return { ...result, page, pageSize: PAGE_SIZE }
}

/** Wszystkie konta z filtrami (do CSV w przeglądarce); eksport trafia do dziennika. */
export async function exportUsers(
  admin: UserRow,
  filter: z.infer<typeof userFilterInput>,
) {
  const result = await findUsers(filter, null)
  await db.transaction((tx) =>
    log(
      tx,
      admin,
      null,
      'users.exported',
      `${result.items.length}; ${describeFilter(filter)}`,
    ),
  )
  return result.items
}

/** Szczegóły konta: dane, bezpieczeństwo, zalogowane urządzenia i płatności. */
export async function getUserDetail(
  user: Awaited<ReturnType<typeof findUser>>,
) {
  const [row, security, sessions] = await Promise.all([
    describeOne(user),
    securityStatus(user),
    sessionsOf(user.id, null),
  ])
  return {
    ...row,
    security,
    sessions,
    billing: {
      enabled: billingEnabled(),
      stripeCustomerId: user.stripeCustomerId,
      stripeUrl: stripeCustomerUrl(user.stripeCustomerId),
    },
  }
}

/** Zmiana planu, roli albo blokada. Każda zmiana osobno w dzienniku. */
export async function changeUser(
  admin: UserRow,
  user: Awaited<ReturnType<typeof findUser>>,
  input: z.infer<typeof patchInput>,
) {
  const updated = await db.transaction(async (tx) => {
    const set: Partial<UserRow> = {}
    if (input.plan !== undefined && input.plan !== user.plan) {
      set.plan = input.plan
      await log(tx, admin, user, 'plan.changed', `${user.plan} → ${input.plan}`)
    }
    if (input.role !== undefined && input.role !== user.role) {
      set.role = input.role
      await log(tx, admin, user, 'role.changed', `${user.role} → ${input.role}`)
    }
    if (input.disabled !== undefined && input.disabled !== !!user.disabledAt) {
      set.disabledAt = input.disabled ? new Date() : null
      if (input.disabled) await revokeAllSessions(tx, user.id)
      await log(
        tx,
        admin,
        user,
        input.disabled ? 'user.blocked' : 'user.unblocked',
      )
    }
    if (Object.keys(set).length === 0) return user
    const [row] = await tx
      .update(users)
      .set(set)
      .where(eq(users.id, user.id))
      .returning()
    return row!
  })
  if (input.disabled === true) cutAccess(user.id)
  if (input.disabled === false) restoreAccess(user.id)
  return await describeOne(updated)
}

/** Wylogowanie ze wszystkich urządzeń (np. po zgłoszeniu przejęcia konta). */
export async function revokeUserSessions(
  admin: UserRow,
  user: Awaited<ReturnType<typeof findUser>>,
) {
  await db.transaction(async (tx) => {
    await revokeAllSessions(tx, user.id)
    await log(tx, admin, user, 'sessions.revoked')
  })
  return
}

/**
 * Usunięcie konta z danymi: najpierw koniec subskrypcji w Stripe, potem ON DELETE CASCADE.
 * Wymaga przepisania adresu konta.
 */
export async function deleteUser(
  admin: UserRow,
  user: Awaited<ReturnType<typeof findUser>>,
) {
  if (billingEnabled()) await cancelSubscriptionsFor(user.id)
  await db.transaction(async (tx) => {
    await log(tx, admin, user, 'user.deleted', `plan ${user.plan}`)
    await tx.delete(users).where(eq(users.id, user.id))
  })
  cutAccess(user.id)
  return
}
