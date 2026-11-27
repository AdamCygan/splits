import { absoluteUrl, site } from '#/config/site'
import { BILLING_INTERVALS, PRO_PRICES } from '#/features/billing/plans'
import type { BillingInterval } from '#/features/billing/plans'
import type { Locale } from '#/i18n/config'
import { commonMessages } from '#/i18n/messages/common'
import { marketingMessages } from '#/i18n/messages/marketing'
import { promoVideoFiles, promoVideoMeta } from './video'

const BILLING_DURATION: Readonly<Record<BillingInterval, string>> = {
  month: 'P1M',
  year: 'P1Y',
}

/** Trzy oferty z cennika: Free, Pro miesięczne i Pro roczne. */
function pricingOffers(): Array<Record<string, unknown>> {
  const pro = BILLING_INTERVALS.map((interval) => ({
    '@type': 'Offer',
    name: interval === 'month' ? 'Pro (monthly)' : 'Pro (yearly)',
    price: PRO_PRICES[interval],
    priceCurrency: 'USD',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: PRO_PRICES[interval],
      priceCurrency: 'USD',
      billingDuration: BILLING_DURATION[interval],
      valueAddedTaxIncluded: true,
    },
    url: absoluteUrl(`/register?plan=pro&interval=${interval}`),
  }))
  return [
    {
      '@type': 'Offer',
      name: 'Free',
      price: 0,
      priceCurrency: 'USD',
      url: absoluteUrl('/register'),
    },
    ...pro,
  ]
}

/**
 * Dane strukturalne schema.org dla strony głównej. Google używa ich do wyników
 * rozszerzonych (FAQ, wideo, cena aplikacji). Sprawdzisz je w:
 * https://search.google.com/test/rich-results
 */
export function landingJsonLd(locale: Locale): Array<Record<string, unknown>> {
  const common = commonMessages[locale]
  const m = marketingMessages[locale]
  const video = promoVideoFiles(locale)

  return [
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': absoluteUrl('/#organization'),
          name: site.name,
          url: site.url,
          logo: absoluteUrl('/icon-512.png'),
          email: site.supportEmail,
        },
        {
          '@type': 'WebSite',
          '@id': absoluteUrl('/#website'),
          url: site.url,
          name: site.name,
          inLanguage: locale,
          publisher: { '@id': absoluteUrl('/#organization') },
        },
        {
          '@type': 'SoftwareApplication',
          name: site.name,
          url: site.url,
          description: common.seo.description,
          applicationCategory: 'BusinessApplication',
          applicationSubCategory: 'Time tracking',
          operatingSystem: 'Web',
          inLanguage: locale,
          image: absoluteUrl(site.ogImage),
          publisher: { '@id': absoluteUrl('/#organization') },
          offers: pricingOffers(),
        },
        {
          '@type': 'VideoObject',
          name: m.video.name,
          description: m.video.description,
          thumbnailUrl: [absoluteUrl(video.poster.webp)],
          contentUrl: absoluteUrl(video.src),
          uploadDate: promoVideoMeta.uploadDate,
          duration: promoVideoMeta.durationIso,
          inLanguage: locale,
        },
        {
          '@type': 'FAQPage',
          mainEntity: m.faq.items.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
          })),
        },
      ],
    },
  ]
}
