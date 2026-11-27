import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { cutAccess, restoreAccess } from '#/features/auth/data/access.server'
import { billingEnabled } from '#/features/billing/data/stripe.server'
import { db } from '#/server/db/client'
import { users } from '#/server/db/schema'
import type { AppEnv } from '#/server/http/context'
import { ApiError, invalid } from '#/server/http/errors'
import { body, parse } from '#/server/http/inputs'
import { isOwner } from '#/features/auth/controllers/routes.server'
import {
  cancelSubscriptionsFor,
  stripeCustomerUrl,
} from '#/features/billing/controllers/routes.server'
import {
  securityStatus,
  sessionsOf,
} from '#/features/account/data/notifications.server'
import {
  PAGE_SIZE,
  findUser,
  log,
  revokeAllSessions,
} from '../data/shared.server'
import type { UserRow } from '../data/shared.server'
import {
  describeOne,
  findUsers,
  userFilterInput,
} from '../data/users-query.server'

const listInput = userFilterInput.extend({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

const patchInput = z
  .object({
    plan: z.enum(['free', 'pro', 'lifetime']),
    role: z.enum(['client', 'admin']),
    disabled: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0)

/** Usunięcie konta tylko po przepisaniu jego adresu e-mail (ochrona przed pomyłką). */
const deleteInput = z.object({ confirmEmail: z.string().trim().max(320) })

/** Krótki opis filtrów eksportu do dziennika (bez wartości pustych). */
const describeFilter = (filter: Record<string, unknown>) =>
  Object.entries(filter)
    .filter(([key, value]) => value !== undefined && key !== 'dir')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ')

export const userRoutes = new Hono<AppEnv>()
  .get('/users', async (c) => {
    const input = parse(listInput, c.req.query())
    const { page, ...filter } = input
    const result = await findUsers(filter, { size: PAGE_SIZE, number: page })
    return c.json({ ...result, page, pageSize: PAGE_SIZE })
  })

  /** Wszystkie konta z filtrami (do CSV w przeglądarce); eksport trafia do dziennika. */
  .get('/users/export', async (c) => {
    const admin = c.get('admin')!
    const filter = parse(userFilterInput, c.req.query())
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
    return c.json(result.items)
  })

  /** Szczegóły konta: dane, bezpieczeństwo, zalogowane urządzenia i płatności. */
  .get('/users/:id', async (c) => {
    const user = await findUser(c.req.param('id'))
    const [row, security, sessions] = await Promise.all([
      describeOne(user),
      securityStatus(user),
      sessionsOf(user.id, null),
    ])
    return c.json({
      ...row,
      security,
      sessions,
      billing: {
        enabled: billingEnabled(),
        stripeCustomerId: user.stripeCustomerId,
        stripeUrl: stripeCustomerUrl(user.stripeCustomerId),
      },
    })
  })

  /** Zmiana planu, roli albo blokada. Każda zmiana osobno w dzienniku. */
  .patch('/users/:id', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    const input = await body(c, patchInput)
    const self = user.id === admin.id
    if (self && (input.role !== undefined || input.disabled !== undefined))
      throw new ApiError('admin.self', 400)
    if (user.isDemo && (input.plan !== undefined || input.role !== undefined))
      throw invalid()
    // Właściciela (ADMIN_EMAILS) nie da się zdegradować ani zablokować z panelu.
    if (isOwner(user) && (input.role === 'client' || input.disabled === true))
      throw new ApiError('admin.owner', 400)

    const updated = await db.transaction(async (tx) => {
      const set: Partial<UserRow> = {}
      if (input.plan !== undefined && input.plan !== user.plan) {
        set.plan = input.plan
        await log(
          tx,
          admin,
          user,
          'plan.changed',
          `${user.plan} → ${input.plan}`,
        )
      }
      if (input.role !== undefined && input.role !== user.role) {
        set.role = input.role
        await log(
          tx,
          admin,
          user,
          'role.changed',
          `${user.role} → ${input.role}`,
        )
      }
      if (
        input.disabled !== undefined &&
        input.disabled !== !!user.disabledAt
      ) {
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
    return c.json(await describeOne(updated))
  })

  /** Wylogowanie ze wszystkich urządzeń (np. po zgłoszeniu przejęcia konta). */
  .post('/users/:id/revoke-sessions', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    await db.transaction(async (tx) => {
      await revokeAllSessions(tx, user.id)
      await log(tx, admin, user, 'sessions.revoked')
    })
    return c.body(null, 204)
  })

  /**
   * Usunięcie konta z danymi: najpierw koniec subskrypcji w Stripe, potem ON DELETE CASCADE.
   * Wymaga przepisania adresu konta.
   */
  .delete('/users/:id', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    if (user.id === admin.id) throw new ApiError('admin.self', 400)
    if (isOwner(user)) throw new ApiError('admin.owner', 400)
    const input = await body(c, deleteInput)
    if (input.confirmEmail.toLowerCase() !== user.email.toLowerCase())
      throw new ApiError('admin.confirm_email', 400, 'confirmEmail')
    if (billingEnabled()) await cancelSubscriptionsFor(user.id)
    await db.transaction(async (tx) => {
      await log(tx, admin, user, 'user.deleted', `plan ${user.plan}`)
      await tx.delete(users).where(eq(users.id, user.id))
    })
    cutAccess(user.id)
    return c.body(null, 204)
  })
