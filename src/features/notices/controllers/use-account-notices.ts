import { useQuery } from '@tanstack/react-query'
import { accountApi } from '#/features/account/data/api'
import { billingApi } from '#/features/billing/data/api'
import type { User } from '#/features/auth/data/dto'
import {
  billingQuery,
  useStripeRedirect,
} from '#/features/billing/data/queries'
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
  const t = useMessages(panelMessages).notices
  const billing = useQuery({ ...billingQuery, enabled: !user.isDemo }).data
  const resend = useDataMutation(() => accountApi.resendVerification(), {
    invalidate: [],
    success: fmt(t.resent, { email: user.email }),
  })
  const portal = useStripeRedirect(() => billingApi.portal())

  return {
    email: user.email,
    notices: accountNotices({
      user,
      subscriptionStatus: billing?.subscription?.status ?? null,
    }),
    resending: resend.isPending,
    resent: resend.isSuccess,
    opening: portal.isPending,
    resend: () => resend.mutate(undefined),
    updatePayment: () => portal.mutate(undefined),
  }
}

export type AccountNoticesViewModel = ReturnType<
  typeof useAccountNoticesViewModel
>
