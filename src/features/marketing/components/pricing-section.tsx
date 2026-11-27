import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { PRO_PRICES, formatPrice } from '#/features/billing/plans'
import { fmt } from '#/i18n/format'
import { useI18n, useMessages } from '#/i18n/context'
import { marketingMessages } from '#/i18n/messages/marketing'
import { cn } from '#/lib/utils'

export interface PricingSectionProps {
  headingLevel?: 2 | 3
}

type TileId = 'free' | 'month' | 'year'

const TILES: ReadonlyArray<TileId> = ['free', 'month', 'year']

const AMOUNTS: Readonly<Record<TileId, number>> = {
  free: 0,
  month: PRO_PRICES.month,
  year: PRO_PRICES.year,
}

/**
 * Trzy kafelki: Free, Pro miesięcznie i Pro rocznie. Oba warianty Pro mają te same
 * funkcje, różnią się tylko płatnością; roczny jest wyróżniony (2 miesiące gratis).
 * headingLevel: 3 pod nagłówkiem sekcji (landing), 2 gdy cennik jest całą stroną.
 */
export function PricingSection({ headingLevel = 3 }: PricingSectionProps) {
  const PlanHeading = headingLevel === 2 ? 'h2' : 'h3'
  const t = useMessages(marketingMessages).pricing
  const { tag } = useI18n()
  const yearlyPerMonth = formatPrice(
    Math.round((PRO_PRICES.year / 12) * 100) / 100,
    tag,
  )

  return (
    <div>
      <div className="grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-3">
        {TILES.map((id) => {
          const tile = t.tiles[id]
          const featured = id === 'year'
          const badge = id === 'year' ? t.tiles.year.badge : null
          const hint =
            id === 'year'
              ? fmt(tile.hint, { price: yearlyPerMonth })
              : tile.hint
          const features = t.features[id === 'free' ? 'free' : 'pro']

          return (
            <div
              key={id}
              data-plan={id}
              className={cn(
                'flex flex-col p-6 sm:p-8',
                featured
                  ? 'bg-[var(--ink-fixed)] text-white'
                  : 'border-line not-last:border-b md:not-last:border-r md:not-last:border-b-0',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <PlanHeading className="type-heading text-2xl">
                  {tile.name}
                </PlanHeading>
                {badge && (
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">
                    {badge}
                  </span>
                )}
              </div>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="type-display text-5xl">
                  {formatPrice(AMOUNTS[id], tag)}
                </span>
                <span className={featured ? 'text-white/75' : 'text-ink-soft'}>
                  {tile.period}
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
                {features.map((feature) => (
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
                variant={id === 'free' ? 'outline' : 'secondary'}
                className={cn(
                  'mt-8 w-full',
                  featured &&
                    'bg-white text-[var(--ink-fixed)] hover:bg-white/90',
                )}
              >
                <Link
                  to="/register"
                  search={id === 'free' ? {} : { plan: 'pro', interval: id }}
                >
                  {t.cta[id]}
                </Link>
              </Button>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-center text-sm text-ink-soft">{t.note}</p>
    </div>
  )
}
