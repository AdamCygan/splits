import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { site } from '#/config/site'
import { formatPrice, plans } from '#/features/billing/plans'
import { fmt } from '#/i18n/format'
import { useI18n, useMessages } from '#/i18n/context'
import { marketingMessages } from '#/i18n/messages/marketing'
import { cn } from '#/lib/utils'

export interface PricingSectionProps {
  headingLevel?: 2 | 3
}

/** headingLevel: 3 pod nagłówkiem sekcji (landing), 2 gdy cennik jest całą stroną. */
export function PricingSection({ headingLevel = 3 }: PricingSectionProps) {
  const PlanHeading = headingLevel === 2 ? 'h2' : 'h3'
  const t = useMessages(marketingMessages).pricing
  const { tag } = useI18n()

  return (
    <div>
      <div className="grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-3">
        {plans.map((plan) => {
          const featured = plan.highlight === true
          // Wszystkie płatne plany są roczne, płatne z góry.
          const amount = formatPrice(plan.yearly ?? 0, tag)
          const period = plan.yearly
            ? plan.perSeat
              ? t.perSeat
              : t.period.year
            : t.period.forever
          const hint =
            plan.yearly && !plan.perSeat
              ? fmt(t.perMonthYearly, {
                  price: formatPrice(
                    Math.round((plan.yearly / 12) * 100) / 100,
                    tag,
                  ),
                })
              : null
          const badge =
            plan.id === 'pro' || plan.id === 'team' ? t.badges[plan.id] : null

          return (
            <div
              key={plan.id}
              className={cn(
                'flex flex-col p-6 sm:p-8',
                featured
                  ? 'bg-[var(--ink-fixed)] text-white'
                  : 'border-line not-last:border-b md:not-last:border-r md:not-last:border-b-0',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <PlanHeading className="type-heading text-2xl">
                  {plan.name}
                </PlanHeading>
                {badge && (
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-semibold',
                      featured
                        ? 'bg-white/15 text-white'
                        : 'bg-[color-mix(in_oklab,var(--wt-review)_22%,white)] text-[#6b4405]',
                    )}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="type-display text-5xl">{amount}</span>
                <span className={featured ? 'text-white/75' : 'text-ink-soft'}>
                  {period}
                </span>
              </p>
              <p
                className={cn(
                  'mt-1 min-h-5 text-sm',
                  featured ? 'text-white/75' : 'text-ink-soft',
                )}
              >
                {hint}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {t.features[plan.id].map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-[0.9375rem]">
                    <Check
                      aria-hidden
                      className={cn(
                        'mt-1 size-4 shrink-0',
                        featured ? 'text-white' : 'text-wt-pair',
                      )}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                size="lg"
                variant={featured ? 'secondary' : 'outline'}
                className={cn(
                  'mt-8 w-full',
                  featured &&
                    'bg-white text-[var(--ink-fixed)] hover:bg-white/90',
                )}
              >
                {plan.available ? (
                  <Link
                    to="/register"
                    search={plan.id === 'pro' ? { plan: 'pro' } : {}}
                  >
                    {t.cta[plan.id]}
                  </Link>
                ) : (
                  <a
                    href={`mailto:${site.supportEmail}?subject=${encodeURIComponent(t.teamMail)}`}
                  >
                    {t.cta[plan.id]}
                  </a>
                )}
              </Button>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-center text-sm text-ink-soft">{t.note}</p>
    </div>
  )
}
