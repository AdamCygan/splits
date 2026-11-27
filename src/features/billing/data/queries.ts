import { billingApi } from './api'
import { queryOptions } from '@tanstack/react-query'
import { unwrap } from '#/lib/api-client'
import { keys } from '#/shared/data/query-keys'

export const billingKeys = { status: ['billing', 'status'] as const }

export const billingQuery = queryOptions({
  queryKey: billingKeys.status,
  queryFn: () => unwrap(billingApi.status()),
})

export const invoicesQuery = queryOptions({
  queryKey: keys.invoices,
  queryFn: () => unwrap(billingApi.invoices()),
})

/** Potwierdzenie płatności po powrocie ze Stripe (raz na sesję Checkout). */
export const checkoutSyncQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ['billing', 'sync', sessionId],
    queryFn: () => unwrap(billingApi.sync(sessionId)),
    retry: 2,
    staleTime: Infinity,
  })
