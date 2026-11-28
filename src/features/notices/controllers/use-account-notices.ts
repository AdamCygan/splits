import { useQuery } from '@tanstack/react-query'
import { accountApi } from '#/features/account/data/api'
import type { User } from '#/features/auth/data/dto'
import { useBillingPortal } from '#/features/billing/controllers/use-billing'
import { billingQuery } from '#/features/billing/data/queries'
import { useDataMutation } from '#/shared/data/mutations'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'
import { accountNotices } from '../domain/notices'

/**
 * ViewModel komunikatów o koncie: które pokazać i akcje (nowy link potwierdzający,
 * przejście do Stripe po aktualizację karty).
 */
export function useAccountNoticesViewModel(user: User) {
  const messages = useMessages(panelMessages).notices
  const billing = useQuery({ ...billingQuery, enabled: !user.isDemo }).data
  const resend = useDataMutation(() => accountApi.resendVerification(), {
    invalidate: [],
    success: fmt(messages.resent, { email: user.email }),
  })
  const portal = useBillingPortal()

  return {
    email: user.email,
    notices: accountNotices({
      user,
      subscriptionStatus: billing?.subscription?.status ?? null,
    }),
    resending: resend.isPending,
    resent: resend.isSuccess,
    opening: portal.opening,
    resend: () => resend.mutate(undefined),
    updatePayment: portal.open,
  }
}

export type AccountNoticesViewModel = ReturnType<
  typeof useAccountNoticesViewModel
>
