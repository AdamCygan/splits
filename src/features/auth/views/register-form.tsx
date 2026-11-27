import { Link } from '@tanstack/react-router'
import { useRegister } from '../controllers/use-register'
import {
  FormAlert,
  TextField,
  errorMessages,
} from '#/components/form/form-field'
import { Button } from '#/components/ui/button'
import { useMessages } from '#/i18n/context'
import { authMessages } from '#/i18n/messages/auth'
import type { BillingInterval } from '#/features/billing/domain/plans'

export interface RegisterFormProps {
  next?: 'setup' | 'checkout'
  /** Płatność wybrana na cenniku (dla next=checkout). */
  interval?: BillingInterval
}

/** next: dokąd po założeniu konta — konfiguracja (domyślnie) albo koszyk planu Pro. */
export function RegisterForm({
  next = 'setup',
  interval = 'year',
}: RegisterFormProps) {
  const t = useMessages(authMessages)
  const { form, formError, serverErrors, clearServerError } = useRegister({
    next,
    interval,
  })

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="space-y-5"
    >
      {formError && <FormAlert>{formError}</FormAlert>}

      <form.Field name="username">
        {(field) => (
          <TextField
            label={t.register.username}
            name={field.name}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => {
              clearServerError('username')
              field.handleChange(e.target.value)
            }}
            hint={t.register.usernameHint}
            errors={errorMessages([
              ...field.state.meta.errors,
              ...(serverErrors.username ?? []),
            ])}
          />
        )}
      </form.Field>

      <form.Field name="email">
        {(field) => (
          <TextField
            label={t.register.email}
            type="email"
            name={field.name}
            autoComplete="email"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => {
              clearServerError('email')
              field.handleChange(e.target.value)
            }}
            errors={errorMessages([
              ...field.state.meta.errors,
              ...(serverErrors.email ?? []),
            ])}
          />
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <TextField
            label={t.register.password}
            type="password"
            name={field.name}
            autoComplete="new-password"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => {
              clearServerError('password')
              field.handleChange(e.target.value)
            }}
            hint={t.register.passwordHint}
            errors={errorMessages([
              ...field.state.meta.errors,
              ...(serverErrors.password ?? []),
            ])}
          />
        )}
      </form.Field>

      <form.Field name="acceptTerms">
        {(field) => {
          const errors = errorMessages(field.state.meta.errors)
          return (
            <div className="space-y-1.5">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name={field.name}
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                  aria-invalid={errors.length > 0 || undefined}
                  aria-describedby={errors.length ? 'terms-error' : undefined}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--ink)]"
                />
                <span className="text-ink-soft">
                  <TermsText
                    template={t.register.terms}
                    terms={t.register.termsLink}
                    privacy={t.register.privacyLink}
                  />
                </span>
              </label>
              {errors.length > 0 && (
                <p id="terms-error" className="text-sm text-destructive">
                  {errors[0]}
                </p>
              )}
            </div>
          )
        }}
      </form.Field>

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full text-base"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? t.register.submitting : t.register.submit}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}

interface TermsTextProps {
  template: string
  terms: string
  privacy: string
}

/** Zdanie zgody z linkami do regulaminu i polityki prywatności (otwierane w nowej karcie, formularz zostaje). */
function TermsText({ template, terms, privacy }: TermsTextProps) {
  const link = (to: '/terms' | '/privacy', label: string) => (
    <Link
      key={to}
      to={to}
      target="_blank"
      className="font-medium text-ink underline underline-offset-4"
    >
      {label}
    </Link>
  )
  return (
    <>
      {template
        .split(/(\{terms\}|\{privacy\})/)
        .map((part, i) =>
          part === '{terms}' ? (
            link('/terms', terms)
          ) : part === '{privacy}' ? (
            link('/privacy', privacy)
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
    </>
  )
}
