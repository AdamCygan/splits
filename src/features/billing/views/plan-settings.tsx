import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, ExternalLink } from 'lucide-react'
import { Button, buttonVariants } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import { InvoicesCard } from '#/features/billing/views/invoices'
import {
  FREE_LIMITS,
  PRO_PRICES,
  formatPrice,
  planById,
} from '#/features/billing/domain/plans'
import { ProgressBar } from '#/components/ui/progress-bar'
import { useFreeUsage } from '../controllers/use-free-usage'
import { billingQuery } from '#/features/billing/data/queries'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { billingMessages } from '#/i18n/messages/billing'
import { marketingMessages } from '#/i18n/messages/marketing'
import { settingsMessages } from '#/i18n/messages/settings'
import { cn } from '#/lib/utils'
import { meQuery } from '#/features/account/data/queries'
import { useBillingPortal, useCheckoutReturn } from '../controllers/use-billing'
import {
  DemoNotice,
  QueryView,
  SectionHeader,
  SettingsCard,
} from '#/features/settings/views/ui'

export interface PlanSettingsProps {
  checkoutSession: string | null
}

export function PlanSettings({ checkoutSession }: PlanSettingsProps) {
  const messages = useMessages(settingsMessages)
  return (
    <div className="space-y-6">
      <SectionHeader
        title={messages.plan.title}
        lead={messages.sections.plan.text}
      />
      {checkoutSession && <CheckoutReturn sessionId={checkoutSession} />}
      <QueryView query={meQuery} skeletonRows={3}>
        {(user) => (
          <>
            {user.isDemo && <DemoNotice />}
            <PlanDetails
              planId={user.role === 'admin' ? 'lifetime' : user.plan}
              admin={user.role === 'admin'}
            />
            <InvoicesCard isDemo={user.isDemo} />
          </>
        )}
      </QueryView>
    </div>
  )
}

interface CheckoutReturnProps {
  sessionId: string
}

/**
 * Powrót z płatności: od razu pytamy serwer o sesję (webhook bywa wolniejszy),
 * odświeżamy plan i czyścimy adres, żeby odświeżenie strony nie powtarzało tego kroku.
 */
function CheckoutReturn({ sessionId }: CheckoutReturnProps) {
  const messages = useMessages(billingMessages).plan
  const { pending, paid } = useCheckoutReturn(sessionId)
  if (pending) return null
  return (
    <section
      role="status"
      className={cn(
        'rounded-2xl border p-5',
        paid
          ? 'border-[color-mix(in_oklab,var(--success,#16794a)_35%,transparent)] bg-[color-mix(in_oklab,var(--success,#16794a)_8%,var(--surface))]'
          : 'border-line bg-muted/50',
      )}
    >
      {paid ? (
        <>
          <h2 className="type-heading text-xl">{messages.thanksTitle}</h2>
          <p className="mt-1 text-ink-soft">{messages.thanksText}</p>
        </>
      ) : (
        <p>{messages.pending}</p>
      )}
    </section>
  )
}

type PlanCode = 'free' | 'pro' | 'lifetime'

interface PlanDetailsProps {
  planId: PlanCode
  admin?: boolean
}

function PlanDetails({ planId, admin = false }: PlanDetailsProps) {
  const messages = useMessages(settingsMessages).plan
  const copy = useMessages(billingMessages).plan
  const pricing = useMessages(marketingMessages).pricing
  const { tag, locale } = useI18n()
  const billing = useQuery(billingQuery).data
  const portal = useBillingPortal()
  const isFree = planId === 'free'
  const name = admin
    ? 'Admin'
    : planId === 'lifetime'
      ? 'Lifetime'
      : planById(planId).name
  const featureList = pricing.features[planId === 'free' ? 'free' : 'pro']
  const subscription = billing?.subscription
  const day = (isoDate: string) =>
    formatDate(locale, isoDate.slice(0, 10), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

  return (
    <>
      <SettingsCard
        title={messages.current}
        actions={<Badge tone={isFree ? 'muted' : 'success'}>{name}</Badge>}
      >
        {subscription && planId === 'pro' && (
          <p
            className={cn(
              'mb-4 text-sm font-medium',
              subscription.status === 'past_due' && 'text-destructive',
            )}
          >
            {subscription.interval && subscription.status !== 'past_due' && (
              <span className="block text-ink-soft">
                {subscription.interval === 'month'
                  ? copy.billedMonthly
                  : copy.billedYearly}
              </span>
            )}
            {subscription.status === 'past_due'
              ? copy.pastDue
              : subscription.currentPeriodEnd
                ? fmt(
                    subscription.cancelAtPeriodEnd
                      ? copy.endsOn
                      : copy.renewsOn,
                    {
                      date: day(subscription.currentPeriodEnd),
                    },
                  )
                : null}
          </p>
        )}
        <ul className="space-y-2">
          {featureList.map((feature) => (
            <li key={feature} className="flex gap-2">
              <Check
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-[var(--success,#16794a)]"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        {planId === 'lifetime' && (
          <p className="mt-6 border-t border-line pt-5 text-ink-soft">
            {admin ? copy.adminNote : copy.lifetimeNote}
          </p>
        )}
      </SettingsCard>

      {isFree && <FreeUsageCard />}

      {isFree && (
        <SettingsCard title={messages.upgradeTitle} lead={messages.upgradeLead}>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/app/checkout"
              search={{ interval: 'year' }}
              className={buttonVariants()}
            >
              {fmt(copy.buyPro.year, {
                price: formatPrice(PRO_PRICES.year, tag),
              })}
            </Link>
            <Link
              to="/app/checkout"
              search={{ interval: 'month' }}
              className={buttonVariants({ variant: 'outline' })}
            >
              {fmt(copy.buyPro.month, {
                price: formatPrice(PRO_PRICES.month, tag),
              })}
            </Link>
          </div>
          <p className="mt-2 text-sm text-ink-soft">{copy.buyProHint}</p>
        </SettingsCard>
      )}

      {subscription && (
        <SettingsCard title={copy.manage} lead={copy.manageHint}>
          <Button
            variant="outline"
            disabled={portal.opening}
            aria-busy={portal.opening}
            onClick={portal.open}
          >
            <ExternalLink aria-hidden className="size-4" />
            {portal.opening ? copy.opening : copy.manage}
          </Button>
        </SettingsCard>
      )}

      <Link
        to="/pricing"
        className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4"
      >
        {messages.comparePlans}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </>
  )
}

/** Ile z limitów Free jest już zajęte; wyczerpane limity wyróżnione. */
function FreeUsageCard() {
  const messages = useMessages(billingMessages).usage
  const rows = useFreeUsage()
  return (
    <SettingsCard title={messages.title} lead={messages.lead}>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows?.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[1fr_auto] items-baseline gap-x-3"
          >
            <dt className="text-sm">{messages.rows[row.key]}</dt>
            <dd
              className={cn(
                'text-sm font-medium tabular-nums',
                row.full && 'font-semibold',
              )}
            >
              {row.limit === 0
                ? messages.none
                : fmt(messages.count, { used: row.used, limit: row.limit })}
            </dd>
            {row.limit > 0 && (
              <dd className="col-span-2 mt-2">
                <ProgressBar
                  value={(row.used / row.limit) * 100}
                  tone={row.full ? 'warn' : 'ink'}
                />
              </dd>
            )}
          </div>
        ))}
        {[
          [
            messages.history,
            fmt(messages.historyValue, { days: FREE_LIMITS.historyDays }),
          ],
          [messages.reminders, messages.proOnly],
          [messages.csv, messages.proOnly],
        ].map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[1fr_auto] items-baseline gap-x-3"
          >
            <dt className="text-sm">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </SettingsCard>
  )
}
