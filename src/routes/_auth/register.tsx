import { Link, createFileRoute } from '@tanstack/react-router'
import { GoogleSignIn } from '#/features/auth/components/google-sign-in'
import { RegisterForm } from '#/features/auth/components/register-form'
import { isBillingInterval } from '#/features/billing/plans'
import type { BillingInterval } from '#/features/billing/plans'
import { useMessages } from '#/i18n/context'
import { getLocale } from '#/i18n/locale'
import { authMessages } from '#/i18n/messages/auth'
import { seo } from '#/lib/seo'

interface RegisterSearch {
  plan?: 'pro'
  interval?: BillingInterval
}

/** Plan Pro wybrany na stronie cennika (miesięczny albo roczny); koszyk po założeniu konta. */
const validateSearch = (search: Record<string, unknown>): RegisterSearch =>
  search.plan === 'pro'
    ? {
        plan: 'pro',
        interval: isBillingInterval(search.interval) ? search.interval : 'year',
      }
    : {}

export const Route = createFileRoute('/_auth/register')({
  validateSearch,
  head: () => {
    const t = authMessages[getLocale()].register
    return seo({
      title: t.seoTitle,
      description: t.seoDescription,
      path: '/register',
    })
  },
  component: RegisterPage,
})

function RegisterPage() {
  const { plan, interval = 'year' } = Route.useSearch()
  const t = useMessages(authMessages)
  const pro = plan === 'pro'
  const note = pro ? t.register.planNote[interval] : null
  const checkoutUrl = `/app/checkout?interval=${interval}`

  return (
    <div>
      <h1 className="type-display text-5xl">{t.register.title}</h1>
      <p className="mt-3 mb-8 text-ink-soft">
        {t.register.haveAccount}{' '}
        <Link
          to="/login"
          search={pro ? { redirect: checkoutUrl } : {}}
          className="rounded-sm font-medium text-ink underline underline-offset-4"
        >
          {t.register.logIn}
        </Link>
      </p>
      {note && (
        <p className="mb-6 rounded-lg bg-muted px-3.5 py-3 text-sm">{note}</p>
      )}
      <RegisterForm next={pro ? 'checkout' : 'setup'} interval={interval} />
      <div className="mt-8">
        <GoogleSignIn redirectTo={pro ? checkoutUrl : undefined} />
      </div>
    </div>
  )
}
