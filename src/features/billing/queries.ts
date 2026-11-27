import { queryOptions, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { billingApi } from './data/api'
import { ApiError, unwrap } from '#/lib/api-client'
import { useErrorText } from '#/lib/use-error-text'

export const billingKeys = { status: ['billing', 'status'] as const }

export const billingQuery = queryOptions({
  queryKey: billingKeys.status,
  queryFn: () => unwrap(billingApi.status()),
})

/**
 * Przejście do Stripe (Checkout albo Customer Portal): pełne przekierowanie,
 * więc przycisk zostaje zablokowany aż do opuszczenia strony.
 */
export function useStripeRedirect<T>(
  open: (arg: T) => ReturnType<typeof billingApi.portal>,
) {
  const errorText = useErrorText()
  return useMutation({
    mutationFn: async (arg: T) => {
      const { url } = await unwrap(open(arg))
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
