import { Link, createFileRoute } from '@tanstack/react-router'
import { GoogleSignIn } from '#/features/auth/components/google-sign-in'
import { RegisterForm } from '#/features/auth/components/register-form'
import type { PlanId } from '#/features/billing/plans'
import { useMessages } from '#/i18n/context'
import { getLocale } from '#/i18n/locale'
import { authMessages } from '#/i18n/messages/auth'
import { seo } from '#/lib/seo'

const PLANS: ReadonlyArray<PlanId> = ['free', 'pro']

/** Plan wybrany na stronie cennika; płatność proponujemy po założeniu konta. */
const validateSearch = (search: Record<string, unknown>): { plan?: PlanId } =>
  PLANS.includes(search.plan as PlanId) ? { plan: search.plan as PlanId } : {}

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
  const { plan } = Route.useSearch()
  const t = useMessages(authMessages)
  const note = plan === 'pro' ? t.register.planNote.pro : null

  return (
    <div>
      <h1 className="type-display text-5xl">{t.register.title}</h1>
      <p className="mt-3 mb-8 text-ink-soft">
        {t.register.haveAccount}{' '}
        <Link
          to="/login"
          search={plan === 'pro' ? { redirect: '/app/checkout?plan=pro' } : {}}
          className="rounded-sm font-medium text-ink underline underline-offset-4"
        >
          {t.register.logIn}
        </Link>
      </p>
      {note && (
        <p className="mb-6 rounded-lg bg-muted px-3.5 py-3 text-sm">{note}</p>
      )}
      <RegisterForm next={plan === 'pro' ? 'checkout' : 'setup'} />
      <div className="mt-8">
        <GoogleSignIn
          redirectTo={plan === 'pro' ? '/app/checkout?plan=pro' : undefined}
        />
      </div>
    </div>
  )
}
