import type { User } from '#/data/types'
import { isPaymentProblem } from '#/domain/admin'

export type AccountNotice = 'unverified' | 'pastDue'

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
    ...(isPaymentProblem(subscriptionStatus) ? (['pastDue'] as const) : []),
    ...(user.emailVerified ? [] : (['unverified'] as const)),
  ]
}
