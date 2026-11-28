/**
 * Plany: jedno źródło dla landing page, cennika, koszyka i strony planu.
 * Free i Pro. Pro ma dwie płatności o tych samych funkcjach: co miesiąc albo raz w roku
 * (taniej). Kwoty zawierają VAT, jeśli dotyczy (ceny w Stripe mają tax_behavior=inclusive).
 * Ceny w Stripe tworzy `pnpm stripe:setup`.
 */
export type PlanId = 'free' | 'pro'

export const BILLING_INTERVALS = ['month', 'year'] as const
export type BillingInterval = (typeof BILLING_INTERVALS)[number]

/** Ceny Pro w USD (z VAT). Roczna = 10 miesięcy, czyli 2 miesiące gratis. */
export const PRO_PRICES: Readonly<Record<BillingInterval, number>> = {
  month: 6,
  year: 60,
}

/** Ile miesięcy gratis daje płatność roczna względem miesięcznej. */
export const yearlyFreeMonths = () =>
  Math.round((PRO_PRICES.month * 12 - PRO_PRICES.year) / PRO_PRICES.month)

export const isBillingInterval = (value: unknown): value is BillingInterval =>
  value === 'month' || value === 'year'

export interface Plan {
  id: PlanId
  name: string
}

export const plans: ReadonlyArray<Plan> = [
  { id: 'free', name: 'Free' },
  { id: 'pro', name: 'Pro' },
]

export const planById = (id: PlanId) => plans.find((p) => p.id === id)!

/**
 * Pełny dostęp do funkcji Pro: płatny plan (Pro, Lifetime) albo konto administratora.
 * Administrator nie płaci za własną aplikację, a jego plan w bazie zostaje bez zmian.
 */
export const hasProAccess = (
  user: { plan: string; role: string } | null | undefined,
) => !!user && (user.plan !== 'free' || user.role === 'admin')

/**
 * Limity planu Free (egzekwowane też przez API). Free pokazuje wszystkie ekrany, ale na krótkim
 * oknie: tydzień historii, wbudowane typy pracy i statusy, jedna przestrzeń, jeden projekt,
 * dwa szablony.
 * Eksport CSV i przypomnienia e-mail są tylko w Pro.
 */
export const FREE_LIMITS = {
  historyDays: 7,
  customWorkTypes: 0,
  workspaces: 1,
  projects: 1,
  quickTemplates: 2,
  /** Domyślne statusy nowego konta (Do zrobienia, W trakcie, Do review, Gotowe). */
  statuses: 4,
} as const

/** Dzień, w którym kończy się okres opłacony dziś. */
export function renewalDate(interval: BillingInterval, from = new Date()) {
  const months = interval === 'year' ? 12 : 1
  const date = new Date(from)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  // Jak Stripe: 31 stycznia + miesiąc to ostatni dzień lutego, nie 3 marca.
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return date
}

export function formatPrice(amount: number, tag: string) {
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}

/** Ile czego konto Free ma teraz (aktywne projekty, szablony, statusy, własne rodzaje pracy). */
export interface FreeUsageCounts {
  projects: number
  quickTemplates: number
  statuses: number
  customWorkTypes: number
}

export type FreeUsageKey = keyof FreeUsageCounts

export interface FreeUsageRow {
  key: FreeUsageKey
  used: number
  limit: number
  /** Limit wyczerpany: dodanie kolejnego wymaga Pro. */
  full: boolean
}

const USAGE_KEYS: ReadonlyArray<FreeUsageKey> = [
  'projects',
  'quickTemplates',
  'statuses',
  'customWorkTypes',
]

/** Wykorzystanie limitów planu Free, w stałej kolejności (do paska na stronie planu). */
export const freeUsage = (counts: FreeUsageCounts): Array<FreeUsageRow> =>
  USAGE_KEYS.map((key) => ({
    key,
    used: counts[key],
    limit: FREE_LIMITS[key],
    full: counts[key] >= FREE_LIMITS[key],
  }))
