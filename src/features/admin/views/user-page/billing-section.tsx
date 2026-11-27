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
export function BillingSection({ vm }: SectionProps) {
  const t = useMessages(adminMessages).user.billing
  const { locale } = useI18n()
  const u = vm.user
  if (!u || u.isDemo) return null
  const sub = u.subscription
  const day = (value: string) => formatDate(locale, new Date(value))
  return (
    <Panel title={t.title}>
      {!u.billing.enabled ? (
        <p className="text-sm text-ink-soft">{t.off}</p>
      ) : (
        <>
          <dl className="text-[0.9375rem]">
            <dt className="text-sm text-ink-soft">{t.subscription}</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium">
              {sub ? (
                <>
                  <Badge
                    tone={
                      isPaymentProblem(sub.status)
                        ? 'warning'
                        : sub.active
                          ? 'success'
                          : 'muted'
                    }
                  >
                    {t.status[sub.status] ?? sub.status}
                  </Badge>
                  {sub.currentPeriodEnd &&
                    fmt(sub.cancelAtPeriodEnd ? t.ends : t.renews, {
                      date: day(sub.currentPeriodEnd),
                    })}
                </>
              ) : (
                t.none
              )}
            </dd>
          </dl>
          {u.billing.stripeUrl && u.billing.stripeCustomerId ? (
            <a
              href={u.billing.stripeUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
            >
              <ExternalLink aria-hidden className="size-4" />
              {t.stripe}
              <span className="sr-only"> ({u.billing.stripeCustomerId})</span>
            </a>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">{t.noCustomer}</p>
          )}
          {u.billing.stripeCustomerId && (
            <div className="mt-5 border-t border-line pt-5">
              <h3 className="font-semibold">{t.invoices}</h3>
              {vm.showInvoices ? (
                vm.invoicesPending ? (
                  <div
                    aria-hidden
                    className="mt-3 h-20 animate-pulse rounded-lg bg-muted"
                  />
                ) : (
                  <div className="mt-3">
                    <InvoicesTable
                      invoices={vm.invoices}
                      caption={t.invoices}
                    />
                  </div>
                )
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Button size="sm" variant="outline" onClick={vm.loadInvoices}>
                    {t.showInvoices}
                  </Button>
                  <p className="text-sm text-ink-soft">{t.invoicesHint}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
