import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCurrentUser } from '#/features/auth/data/session'
import { track } from '#/integrations/posthog/analytics'
import { ApiError, unwrap } from '#/lib/api-client'
import { useErrorText } from '#/lib/use-error-text'
import type { R } from '#/shared/data/http'
import { keys } from '#/shared/data/query-keys'
import { billingApi } from '../data/api'
import type { BillingStatus } from '../data/dto'
import { billingKeys, billingQuery, checkoutSyncQuery } from '../data/queries'
import type { BillingInterval } from '../domain/plans'

/**
 * Przejście do Stripe (Checkout albo Customer Portal): pełne przekierowanie,
 * więc przycisk zostaje zablokowany aż do opuszczenia strony.
 */
function useStripeRedirect<T>(open: (argument: T) => R<{ url: string }>) {
  const errorText = useErrorText()
  return useMutation({
    mutationFn: async (argument: T) => {
      const { url } = await unwrap(open(argument))
      window.location.assign(url)
      // Czekamy na nawigację, żeby przycisk nie odblokował się tuż przed przejściem.
      await new Promise(() => undefined)
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? errorText(error.details) : String(error),
      ),
  })
}

/** Czy konto już ma Pro (albo więcej): wtedy koszyk odsyła do ustawień planu. */
export const ownsPro = (status: BillingStatus | undefined, isAdmin: boolean) =>
  isAdmin ||
  status?.plan === 'lifetime' ||
  status?.plan === 'pro' ||
  (status?.subscription?.active === true && status.subscription.plan === 'pro')

/** Koszyk: stan płatności, czy Pro już jest, i przejście do Stripe Checkout. */
export function useCheckout() {
  const billing = useQuery(billingQuery)
  const isAdmin = useCurrentUser()?.role === 'admin'
  const checkout = useStripeRedirect((interval: BillingInterval) =>
    billingApi.checkout(interval),
  )
  return {
    status: billing.data,
    owned: ownsPro(billing.data, isAdmin),
    pay: (interval: BillingInterval) => checkout.mutate(interval),
    redirecting: checkout.isPending,
  }
}

/** Stripe Customer Portal: faktury, karta, zmiana okresu i wyłączenie odnowienia. */
export function useBillingPortal() {
  const portal = useStripeRedirect(() => billingApi.portal())
  return { open: () => portal.mutate(undefined), opening: portal.isPending }
}

/**
 * Powrót z płatności: od razu pytamy serwer o sesję (webhook bywa wolniejszy),
 * odświeżamy plan i czyścimy adres, żeby odświeżenie strony nie powtarzało tego kroku.
 */
export function useCheckoutReturn(sessionId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const sync = useQuery(checkoutSyncQuery(sessionId))
  useEffect(() => {
    if (!sync.data) return
    void queryClient.invalidateQueries({ queryKey: keys.me })
    void queryClient.invalidateQueries({ queryKey: billingKeys.status })
    track('checkout_completed', { plan: sync.data.plan })
    void navigate({ to: '/app/settings/plan', search: {}, replace: true })
  }, [sync.data, queryClient, navigate])
  return {
    pending: sync.isPending,
    paid: sync.data?.plan === 'pro' || sync.data?.plan === 'lifetime',
  }
}
