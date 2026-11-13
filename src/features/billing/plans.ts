/**
 * Plany — jedno źródło dla landing page, cennika, koszyka i strony planu.
 * Wszystkie płatne plany są roczne, płatne z góry. Kwoty zawierają VAT, jeśli dotyczy
 * (cena w Stripe ma tax_behavior=inclusive). Ceny w Stripe tworzy `pnpm stripe:setup`.
 */
export type PlanId = 'free' | 'pro' | 'team'

export type Plan = {
  id: PlanId
  name: string
  /** Cena za rok w USD (Team: za osobę); null = darmowy. */
  yearly: number | null
  perSeat?: boolean
  highlight?: boolean
  /** false = jeszcze nie w sprzedaży (pokazujemy „wkrótce”). */
  available: boolean
}

export const plans: ReadonlyArray<Plan> = [
  { id: 'free', name: 'Free', yearly: null, available: true },
  { id: 'pro', name: 'Pro', yearly: 24, highlight: true, available: true },
  { id: 'team', name: 'Team', yearly: 48, perSeat: true, available: false },
]

export const planById = (id: PlanId) => plans.find((p) => p.id === id)!

/** Limity planu Free (egzekwowane też przez API). */
export const FREE_LIMITS = { customWorkTypes: 3, historyDays: 30 } as const

/** Dzień, w którym kończy się roczny okres opłacony dziś. */
export function renewalDate(from = new Date()) {
  const date = new Date(from)
  date.setFullYear(date.getFullYear() + 1)
  return date
}

export function formatPrice(amount: number, tag: string) {
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}
