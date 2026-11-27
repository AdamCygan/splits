import { Suspense } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { EntryFormDemo } from '#/features/marketing/components/entry-form-demo'
import { Faq } from '#/features/marketing/components/faq'
import {
  Checks,
  IntervalsVisual,
  SprintSplit,
  TimesheetVisual,
} from '#/features/marketing/components/home-visuals'
import { PricingSection } from '#/features/marketing/components/pricing-section'
import { VideoSection } from '#/features/marketing/components/video-section'
import { landingJsonLd } from '#/features/marketing/structured-data'
import { useI18n, useMessages } from '#/i18n/context'
import { getLocale } from '#/i18n/locale'
import { commonMessages } from '#/i18n/messages/common'
import { homeMessages } from '#/i18n/messages/home'
import { marketingMessages } from '#/i18n/messages/marketing'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/_marketing/')({
  head: () => {
    const locale = getLocale()
    return seo({
      title: commonMessages[locale].seo.title,
      path: '/',
      jsonLd: landingJsonLd(locale),
    })
  },
  component: LandingPage,
})

const painColors = [
  'var(--wt-review)',
  'var(--wt-extra)',
  'var(--wt-pair)',
] as const

const h2 = 'type-heading text-[clamp(2rem,4.5vw,3.25rem)]'
const cta = 'h-12 px-6 text-base'
/** Główne wezwanie na jasnym tle: kolor typu „Task” (styles.css → --brand). */
const brandCta = `${cta} bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]`
const visuals = [EntryFormDemo, IntervalsVisual, TimesheetVisual] as const
/** Pasek nad końcowym wezwaniem: sprint podzielony na typy pracy (szerokość w %, kolor). */
const finalStrip = [
  [38, 'var(--wt-task)'],
  [17, 'var(--wt-review)'],
  [14, 'var(--wt-pair)'],
  [11, 'var(--wt-meeting)'],
  [20, 'var(--wt-extra)'],
] as const

interface DemoLinkProps {
  label: string
  dark?: boolean
}

/** Przyciski „załóż konto” i „demo”: te same w hero, pod cennikiem i na końcu strony. */
function DemoLink({ label, dark }: DemoLinkProps) {
  return (
    <Button
      size="lg"
      variant="outline"
      asChild
      className={
        dark
          ? `${cta} border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white`
          : cta
      }
    >
      {/* Zwykły odnośnik: /demo zakłada konto demo, więc nie chcemy go pobierać z wyprzedzeniem. */}
      <Link to="/demo" preload={false}>
        {label}
      </Link>
    </Button>
  )
}

/**
 * Strona główna: obietnica i jedna animacja w hero, trzy rzeczy, które robi produkt,
 * film, cennik, pytania. Każda sekcja poniżej hero w osobnej granicy <Suspense>,
 * żeby hydratacja nie blokowała przeglądarki jednym długim zadaniem.
 */
const productSizes = '(min-width: 1200px) 1152px, calc(100vw - 2rem)'
const productSrcSet = (locale: string, format: 'avif' | 'webp') =>
  [640, 960, 1440]
    .map((w) => `/product-timeblame-${locale}-${w}.${format} ${w}w`)
    .join(', ')

function LandingPage() {
  const { locale } = useI18n()
  const t = useMessages(homeMessages)
  const m = useMessages(marketingMessages)

  return (
    <>
      {/* HERO */}
      <section
        aria-labelledby="hero-title"
        className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:pb-28"
      >
        <div>
          <h1
            id="hero-title"
            className="type-display text-[clamp(2.75rem,6.6vw,5rem)]"
          >
            {t.hero.title}
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg text-ink-soft sm:text-xl">
            {t.hero.lead}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild className={brandCta}>
              <Link to="/register">{t.hero.primary}</Link>
            </Button>
            <DemoLink label={t.hero.demo} />
          </div>
          <p className="mt-4 text-sm text-ink-soft">{t.hero.note}</p>
        </div>
        <SprintSplit />
      </section>

      {/* PRODUKT: prawdziwy ekran Dziś, wchodzi na ciemny pas z problemami poniżej */}
      <div className="bg-[linear-gradient(to_bottom,transparent_58%,var(--ink-fixed)_58%)] px-4 sm:px-6">
        <picture>
          <source
            type="image/avif"
            srcSet={productSrcSet(locale, 'avif')}
            sizes={productSizes}
          />
          <img
            src={`/product-timeblame-${locale}-1440.webp`}
            srcSet={productSrcSet(locale, 'webp')}
            sizes={productSizes}
            width={1440}
            height={900}
            loading="lazy"
            decoding="async"
            alt={t.product.alt}
            className="mx-auto block h-auto w-full max-w-6xl rounded-2xl border border-line bg-surface shadow-[0_32px_80px_-32px_rgba(20,22,43,0.45)]"
          />
        </picture>
      </div>

      {/* PROBLEM */}
      <Suspense>
        <section
          aria-labelledby="pains-title"
          className="below-fold bg-[var(--ink-fixed)] text-white"
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="pains-title" className={`${h2} max-w-3xl`}>
              {m.pains.title}
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-white/15">
              {m.pains.items.map((pain, i) => (
                <div
                  key={pain.title}
                  className="md:px-8 md:first:pl-0 md:last:pr-0"
                >
                  <span
                    aria-hidden
                    className="fill-on-view block h-1.5 w-12 rounded-full"
                    style={{
                      background: painColors[i],
                      ['--fill-step' as string]: i,
                    }}
                  />
                  <h3 className="mt-5 text-xl font-semibold">{pain.title}</h3>
                  <p className="mt-2 text-white/75">{pain.problem}</p>
                  <p className="mt-4 text-white">{pain.fix}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Suspense>

      {/* CO ROBI PRODUKT */}
      <Suspense>
        <section
          id="features"
          aria-labelledby="features-title"
          className="below-fold scroll-mt-20"
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <h2 id="features-title" className={`${h2} max-w-2xl`}>
              {t.how.title}
            </h2>
            <div className="mt-14 space-y-20 lg:space-y-28">
              {t.how.steps.map((step, i) => {
                const Visual = visuals[i]!
                return (
                  <div
                    key={step.title}
                    className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
                  >
                    <div className={i % 2 ? 'lg:order-2' : undefined}>
                      <h3 className="type-heading text-3xl sm:text-4xl">
                        {step.title}
                      </h3>
                      <p className="mt-4 max-w-[52ch] text-lg text-ink-soft">
                        {step.text}
                      </p>
                      <Checks items={step.points} />
                    </div>
                    <Visual />
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </Suspense>

      {/* FILM */}
      <Suspense>
        <section
          id="video"
          aria-labelledby="video-title"
          className="below-fold scroll-mt-20 border-t border-line bg-surface/60"
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <h2 id="video-title" className={`${h2} max-w-2xl`}>
                {m.video.title}
              </h2>
              <p className="max-w-[40ch] text-ink-soft">{m.video.lead}</p>
            </div>
            <VideoSection />
          </div>
        </section>
      </Suspense>

      {/* CENNIK */}
      <Suspense>
        <section
          id="pricing"
          aria-labelledby="pricing-title"
          className="below-fold scroll-mt-20 border-t border-line"
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2
              id="pricing-title"
              className={`${h2} mx-auto max-w-3xl text-center`}
            >
              {t.pricing.title}
            </h2>
            <p className="mx-auto mt-4 mb-10 max-w-[56ch] text-center text-ink-soft">
              {t.pricing.lead}
            </p>
            <PricingSection />
            <p className="mt-8 text-center">
              <Link
                to="/demo"
                preload={false}
                className="inline-flex min-h-6 items-center rounded-sm font-semibold underline underline-offset-4"
              >
                {t.pricing.demo}
              </Link>
            </p>
          </div>
        </section>
      </Suspense>

      {/* FAQ */}
      <Suspense>
        <section
          id="faq"
          aria-labelledby="faq-title"
          className="below-fold scroll-mt-20 border-t border-line bg-surface/60"
        >
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <h2 id="faq-title" className={h2}>
              {m.faq.title}
            </h2>
            <Faq />
          </div>
        </section>
      </Suspense>

      {/* KOŃCOWE CTA */}
      <Suspense>
        <section
          aria-labelledby="final-title"
          className="below-fold bg-[var(--ink-fixed)] text-white"
        >
          <div aria-hidden className="flex h-2">
            {finalStrip.map(([width, color], i) => (
              <span
                key={color}
                className="fill-on-view"
                style={{
                  width: `${width}%`,
                  background: color,
                  ['--fill-step' as string]: i,
                }}
              />
            ))}
          </div>
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2
              id="final-title"
              className="type-display max-w-[18ch] text-[clamp(2.5rem,6vw,4.5rem)]"
            >
              {t.final.title}
            </h2>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className={`${cta} bg-white text-[var(--ink-fixed)] hover:bg-white/90`}
              >
                <Link to="/register">{t.final.primary}</Link>
              </Button>
              <DemoLink label={t.final.demo} dark />
            </div>
            <p className="mt-5 text-white/70">{t.final.note}</p>
          </div>
        </section>
      </Suspense>
    </>
  )
}
