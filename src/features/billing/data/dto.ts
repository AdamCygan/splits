import { planSchema } from '#/features/auth/data/dto'
import type { PlanCode } from '#/features/auth/data/dto'
import { z } from '#/lib/zod'

/** Kontrakt API (billing): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

export interface Invoice {
  id: string
  number: string | null
  date: string
  /** W najmniejszej jednostce waluty (centy). */
  total: number
  currency: string
  status: string
  pdfUrl: string | null
  url: string | null
}

/** Stan płatności konta (GET /billing): Pro płatne co miesiąc albo co rok. */
export interface BillingStatus {
  /** false = serwer nie ma klucza Stripe; zakup jest wyłączony. */
  enabled: boolean
  plan: PlanCode
  subscription: {
    status: string
    plan: PlanCode
    /** Okres rozliczenia; null dla starych subskrypcji sprzed migracji. */
    interval: 'month' | 'year' | null
    active: boolean
    /** Koniec opłaconego okresu (odnowienie albo koniec planu). */
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  } | null
}

export const billingSchema = z.object({
  enabled: z.boolean(),
  plan: planSchema,
  subscription: z
    .object({
      status: z.string(),
      plan: planSchema,
      interval: z.enum(['month', 'year']).nullable().default(null),
      active: z.boolean(),
      currentPeriodEnd: z.string().nullable(),
      cancelAtPeriodEnd: z.boolean(),
    })
    .nullable(),
})

export const invoiceSchema = z.object({
  id: z.string(),
  number: z.string().nullable(),
  date: z.string(),
  total: z.number(),
  currency: z.string(),
  status: z.string(),
  pdfUrl: z.string().nullable(),
  url: z.string().nullable(),
})
