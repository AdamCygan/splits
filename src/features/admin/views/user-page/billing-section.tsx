import { ExternalLink } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import { isPaymentProblem } from '#/features/admin/domain/admin'
import { InvoicesTable } from '#/features/billing/views/invoices'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'
import type { SectionProps } from './account-section'

/** Subskrypcja, link do klienta w Stripe i faktury (ładowane na żądanie, z wpisem w dzienniku). */
export function BillingSection({ viewModel }: SectionProps) {
  const messages = useMessages(adminMessages).user.billing
  const { locale } = useI18n()
  const user = viewModel.user
  if (!user || user.isDemo) return null
  const subscription = user.subscription
  const day = (value: string) => formatDate(locale, new Date(value))
  return (
    <Panel title={messages.title}>
      {!user.billing.enabled ? (
        <p className="text-sm text-ink-soft">{messages.off}</p>
      ) : (
        <>
          <dl className="text-[0.9375rem]">
            <dt className="text-sm text-ink-soft">{messages.subscription}</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium">
              {subscription ? (
                <>
                  <Badge
                    tone={
                      isPaymentProblem(subscription.status)
                        ? 'warning'
                        : subscription.active
                          ? 'success'
                          : 'muted'
                    }
                  >
                    {messages.status[subscription.status] ??
                      subscription.status}
                  </Badge>
                  {subscription.currentPeriodEnd &&
                    fmt(
                      subscription.cancelAtPeriodEnd
                        ? messages.ends
                        : messages.renews,
                      {
                        date: day(subscription.currentPeriodEnd),
                      },
                    )}
                </>
              ) : (
                messages.none
              )}
            </dd>
          </dl>
          {user.billing.stripeUrl && user.billing.stripeCustomerId ? (
            <a
              href={user.billing.stripeUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
            >
              <ExternalLink aria-hidden className="size-4" />
              {messages.stripe}
              <span className="sr-only">
                {' '}
                ({user.billing.stripeCustomerId})
              </span>
            </a>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">{messages.noCustomer}</p>
          )}
          {user.billing.stripeCustomerId && (
            <div className="mt-5 border-t border-line pt-5">
              <h3 className="font-semibold">{messages.invoices}</h3>
              {viewModel.showInvoices ? (
                viewModel.invoicesPending ? (
                  <div
                    aria-hidden
                    className="mt-3 h-20 animate-pulse rounded-lg bg-muted"
                  />
                ) : (
                  <div className="mt-3">
                    <InvoicesTable
                      invoices={viewModel.invoices}
                      caption={messages.invoices}
                    />
                  </div>
                )
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={viewModel.loadInvoices}
                  >
                    {messages.showInvoices}
                  </Button>
                  <p className="text-sm text-ink-soft">
                    {messages.invoicesHint}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
