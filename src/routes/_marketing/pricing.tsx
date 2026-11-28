import { createFileRoute } from '@tanstack/react-router'
import { Faq } from '#/features/marketing/views/faq'
import { PricingSection } from '#/features/marketing/views/pricing-section'
import { useMessages } from '#/i18n/context'
import { getLocale } from '#/i18n/locale'
import { marketingMessages } from '#/i18n/messages/marketing'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/_marketing/pricing')({
  head: () => {
    const messages = marketingMessages[getLocale()].pricing
    return seo({
      title: messages.pageSeoTitle,
      description: messages.pageSeoDescription,
      path: '/pricing',
    })
  },
  component: PricingPage,
})

function PricingPage() {
  const messages = useMessages(marketingMessages)
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6">
        <h1 className="type-display text-center text-[clamp(2.75rem,7vw,5rem)]">
          {messages.pricing.pageTitle}
        </h1>
        <p className="mx-auto mt-4 mb-10 max-w-[56ch] text-center text-lg text-ink-soft">
          {messages.pricing.lead}
        </p>
        <PricingSection headingLevel={2} />
      </section>
      <section aria-labelledby="faq-title" className="border-t border-line">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <h2
            id="faq-title"
            className="type-heading text-[clamp(2rem,4.5vw,3.25rem)]"
          >
            {messages.faq.title}
          </h2>
          <Faq />
        </div>
      </section>
    </>
  )
}
