import { Link, createFileRoute } from '@tanstack/react-router'
import { FormAlert } from '#/components/form/form-field'
import { GoogleSignIn } from '#/features/auth/views/google-sign-in'
import { LoginForm } from '#/features/auth/views/login-form'
import { useMessages } from '#/i18n/context'
import { getLocale } from '#/i18n/locale'
import { authMessages } from '#/i18n/messages/auth'
import { errorMessages } from '#/i18n/messages/errors'
import { seo } from '#/lib/seo'

interface LoginSearch {
  redirect?: string
  error?: 'google' | 'google_unavailable' | 'disabled'
  /** Po ustawieniu nowego hasła z linku w e-mailu. */
  reset?: boolean
  /** Sesja wygasła w trakcie pracy w panelu. */
  expired?: boolean
}

/**
 * Dokąd wrócić po zalogowaniu — tylko ścieżki wewnątrz /app (ochrona przed open redirect).
 * Bez Zod: walidacja search params trafia do głównego bundla, a ten ma być lekki.
 */
const validateSearch = (search: Record<string, unknown>): LoginSearch => {
  const value = search.redirect
  const error =
    search.error === 'google' ||
    search.error === 'google_unavailable' ||
    search.error === 'disabled'
      ? search.error
      : undefined
  return {
    ...(typeof value === 'string' && /^\/app(\/|$|\?)/.test(value)
      ? { redirect: value }
      : {}),
    ...(error ? { error } : {}),
    ...(search.reset === true || search.reset === 'true'
      ? { reset: true }
      : {}),
    ...(search.expired === true || search.expired === 'true'
      ? { expired: true }
      : {}),
  }
}

export const Route = createFileRoute('/_auth/login')({
  validateSearch,
  head: () =>
    seo({
      title: authMessages[getLocale()].login.seoTitle,
      path: '/login',
      noindex: true,
    }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect, error, reset, expired } = Route.useSearch()
  const t = useMessages(authMessages)
  const errors = useMessages(errorMessages)

  return (
    <div>
      <h1 className="type-display text-5xl">{t.login.title}</h1>
      <p className="mt-3 mb-8 text-ink-soft">
        {t.login.noAccount}{' '}
        <Link
          to="/register"
          className="rounded-sm font-medium text-ink underline underline-offset-4"
        >
          {t.login.createOne}
        </Link>
      </p>
      {expired && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-line bg-surface px-3.5 py-3 text-sm"
        >
          {t.login.expired}
        </p>
      )}
      {reset && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-line bg-surface px-3.5 py-3 text-sm"
        >
          {t.reset.done}
        </p>
      )}
      {error && (
        <div className="mb-6">
          <FormAlert>
            {error === 'disabled'
              ? errors['auth.account_disabled']
              : error === 'google'
                ? t.googleError
                : t.googleUnavailable}
          </FormAlert>
        </div>
      )}
      <LoginForm redirectTo={redirect} />
      <div className="mt-8">
        <GoogleSignIn redirectTo={redirect} />
      </div>
    </div>
  )
}
