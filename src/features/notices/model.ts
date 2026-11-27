import type { User } from '#/data/types'

export type AccountNotice = 'unverified' | 'pastDue'

/** Statusy Stripe, przy których płatność się nie udała, a subskrypcja jeszcze trwa. */
const FAILED_PAYMENT = new Set(['past_due', 'unpaid'])

export interface AccountNoticesInput {
  user: Pick<User, 'emailVerified' | 'isDemo'>
  /** Status subskrypcji ze Stripe; null = brak subskrypcji. */
  subscriptionStatus: string | null
}

/**
 * Komunikaty nad stroną panelu, od najważniejszego: nieudana płatność (Pro się wyłączy),
 * potem niepotwierdzony e-mail. Konto demo nie dostaje żadnego.
 */
export function accountNotices({
  user,
  subscriptionStatus,
}: AccountNoticesInput): Array<AccountNotice> {
  if (user.isDemo) return []
  return [
    ...(subscriptionStatus && FAILED_PAYMENT.has(subscriptionStatus)
      ? (['pastDue'] as const)
      : []),
    ...(user.emailVerified ? [] : (['unverified'] as const)),
  ]
}
