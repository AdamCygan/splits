import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { encryptSecret, newTotpSecret } from '../auth/totp'
import { db } from '../db/client'
import { subscriptions, users } from '../db/schema'
import { outbox } from '../email'
import type { AppEnv } from '../http/context'
import { body, timezone } from '../http/inputs'
import { createAccount, sessionFor } from './auth'

const sampleInput = z.object({
  locale: z.enum(['en', 'pl']).default('en'),
  timezone: timezone.optional(),
  /** Domyślnie potwierdzony adres, jak u większości użytkowników. */
  emailVerified: z.boolean().default(true),
  /** Subskrypcja Pro w danym stanie Stripe (np. past_due = nieudana płatność). */
  subscription: z.enum(['active', 'past_due']).optional(),
  /** Konto administratora (panel admina w testach e2e). */
  role: z.enum(['client', 'admin']).default('client'),
  /** Włączone logowanie dwuetapowe (bez ekranu włączania). */
  twoFactor: z.boolean().default(false),
})

/**
 * Trasy tylko dla testów e2e (montowane przy ENABLE_TEST_ROUTES=1 poza produkcją):
 * konto z przykładowymi danymi i podgląd e-maili, które wysłałby serwer.
 */
export const testRoutes = new Hono<AppEnv>()
  .post('/sample-account', async (c) => {
    const input = await body(c, sampleInput)
    const id = randomUUID().slice(0, 8)
    const session = await db.transaction(async (tx) => {
      const user = await createAccount(tx, {
        username: `sample-${id}`,
        email: `sample-${id}@example.com`,
        displayName: input.locale === 'pl' ? 'Konto testowe' : 'Sample account',
        passwordHash: null,
        emailVerified: input.emailVerified,
        locale: input.locale,
        timezone: input.timezone ?? 'UTC',
        withSamples: true,
      })
      if (input.role === 'admin' || input.twoFactor)
        await tx
          .update(users)
          .set({
            role: input.role,
            ...(input.twoFactor
              ? {
                  totpSecret: encryptSecret(newTotpSecret()),
                  totpEnabledAt: new Date(),
                  recoveryCodes: [],
                }
              : {}),
          })
          .where(eq(users.id, user.id))
      if (input.subscription) {
        await tx.update(users).set({ plan: 'pro' }).where(eq(users.id, user.id))
        await tx.insert(subscriptions).values({
          id: `sub_test_${id}`,
          userId: user.id,
          stripeCustomerId: `cus_test_${id}`,
          status: input.subscription,
          plan: 'pro',
          priceId: 'price_test',
          currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        })
      }
      return sessionFor(c, tx, {
        ...user,
        role: input.role,
        plan: input.subscription ? 'pro' : user.plan,
      })
    })
    return c.json(session, 201)
  })

  /** E-maile wysłane na adres (od najstarszego): test „klika” link albo przepisuje kod. */
  .get('/outbox', (c) => {
    const to = c.req.query('to') ?? ''
    return c.json(
      outbox
        .filter((m) => m.to.toLowerCase() === to.toLowerCase())
        .map(({ subject, text }) => ({ subject, text })),
    )
  })
