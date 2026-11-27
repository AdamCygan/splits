import { billingSchema, invoiceSchema } from './dto'
import type { BillingStatus, Invoice } from './dto'
import { planSchema } from '#/features/auth/data/dto'
import type { PlanCode } from '#/features/auth/data/dto'
import type { BillingInterval } from '#/features/billing/domain/plans'
import { z } from '#/lib/zod'
import { get, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

export interface BillingApi {
  status: () => R<BillingStatus>
  /** Adres Stripe Checkout dla Pro (miesięcznie albo rocznie). */
  checkout: (interval: BillingInterval) => R<{ url: string }>
  /** Po powrocie z płatności: plan od razu, bez czekania na webhook. */
  sync: (sessionId: string) => R<{ plan: PlanCode; paid: boolean }>
  /** Adres Stripe Customer Portal (faktury, karta, anulowanie). */
  portal: () => R<{ url: string }>
  invoices: () => R<Array<Invoice>>
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const billingApi: BillingApi = {
  status: () => get('/billing', billingSchema),
  checkout: (interval) =>
    send('POST', '/billing/checkout', z.object({ url: z.url() }), {
      plan: 'pro',
      interval,
    }),
  sync: (sessionId) =>
    send(
      'POST',
      '/billing/sync',
      z.object({ plan: planSchema, paid: z.boolean() }),
      { sessionId },
    ),
  portal: () => send('POST', '/billing/portal', z.object({ url: z.url() })),
  invoices: () => get('/billing/invoices', z.array(invoiceSchema)),
}
