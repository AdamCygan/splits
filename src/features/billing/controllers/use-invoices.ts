import { useQuery } from '@tanstack/react-query'
import { invoicesQuery } from '#/features/billing/data/queries'
import { billingQuery } from '../data/queries'

/**
 * ViewModel faktur na stronie planu. Lista jest tylko przy włączonych płatnościach
 * (Stripe); konto demo nie ma faktur.
 */
export function useInvoicesViewModel(isDemo: boolean) {
  const enabled = useQuery({ ...billingQuery, enabled: !isDemo }).data?.enabled
  const invoices = useQuery({ ...invoicesQuery, enabled: enabled === true })
  return {
    visible: enabled === true && !isDemo,
    pending: invoices.isPending,
    failed: invoices.isError,
    invoices: invoices.data ?? [],
  }
}

export type InvoicesViewModel = ReturnType<typeof useInvoicesViewModel>
