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
  const t = useMessages(settingsMessages)
  return (
    <div className="space-y-6">
      <SectionHeader title={t.plan.title} lead={t.sections.plan.text} />
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
  const t = useMessages(billingMessages).plan
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
          <h2 className="type-heading text-xl">{t.thanksTitle}</h2>
          <p className="mt-1 text-ink-soft">{t.thanksText}</p>
        </>
      ) : (
        <p>{t.pending}</p>
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
  const t = useMessages(settingsMessages).plan
  const b = useMessages(billingMessages).plan
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
  const sub = billing?.subscription
  const day = (iso: string) =>
    formatDate(locale, iso.slice(0, 10), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

  return (
    <>
      <SettingsCard
        title={t.current}
        actions={<Badge tone={isFree ? 'muted' : 'success'}>{name}</Badge>}
      >
        {sub && planId === 'pro' && (
          <p
            className={cn(
              'mb-4 text-sm font-medium',
              sub.status === 'past_due' && 'text-destructive',
            )}
          >
            {sub.interval && sub.status !== 'past_due' && (
              <span className="block text-ink-soft">
                {sub.interval === 'month' ? b.billedMonthly : b.billedYearly}
              </span>
            )}
            {sub.status === 'past_due'
              ? b.pastDue
              : sub.currentPeriodEnd
                ? fmt(sub.cancelAtPeriodEnd ? b.endsOn : b.renewsOn, {
                    date: day(sub.currentPeriodEnd),
                  })
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
            {admin ? b.adminNote : b.lifetimeNote}
          </p>
        )}
      </SettingsCard>

      {isFree && <FreeUsageCard />}

      {isFree && (
        <SettingsCard title={t.upgradeTitle} lead={t.upgradeLead}>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/app/checkout"
              search={{ interval: 'year' }}
              className={buttonVariants()}
            >
              {fmt(b.buyPro.year, { price: formatPrice(PRO_PRICES.year, tag) })}
            </Link>
            <Link
              to="/app/checkout"
              search={{ interval: 'month' }}
              className={buttonVariants({ variant: 'outline' })}
            >
              {fmt(b.buyPro.month, {
                price: formatPrice(PRO_PRICES.month, tag),
              })}
            </Link>
          </div>
          <p className="mt-2 text-sm text-ink-soft">{b.buyProHint}</p>
        </SettingsCard>
      )}

      {sub && (
        <SettingsCard title={b.manage} lead={b.manageHint}>
          <Button
            variant="outline"
            disabled={portal.opening}
            aria-busy={portal.opening}
            onClick={portal.open}
          >
            <ExternalLink aria-hidden className="size-4" />
            {portal.opening ? b.opening : b.manage}
          </Button>
        </SettingsCard>
      )}

      <Link
        to="/pricing"
        className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4"
      >
        {t.comparePlans}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </>
  )
}

/** Ile z limitów Free jest już zajęte; wyczerpane limity wyróżnione. */
function FreeUsageCard() {
  const u = useMessages(billingMessages).usage
  const rows = useFreeUsage()
  return (
    <SettingsCard title={u.title} lead={u.lead}>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows?.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[1fr_auto] items-baseline gap-x-3"
          >
            <dt className="text-sm">{u.rows[row.key]}</dt>
            <dd
              className={cn(
                'text-sm font-medium tabular-nums',
                row.full && 'font-semibold',
              )}
            >
              {row.limit === 0
                ? u.none
                : fmt(u.count, { used: row.used, limit: row.limit })}
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
          [u.history, fmt(u.historyValue, { days: FREE_LIMITS.historyDays })],
          [u.reminders, u.proOnly],
          [u.csv, u.proOnly],
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
