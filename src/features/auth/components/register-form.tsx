import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  FormAlert,
  TextField,
  errorMessages,
} from '#/components/form/form-field'
import { Button } from '#/components/ui/button'
import { authApi } from '../data/api'
import { useI18n, useMessages } from '#/i18n/context'
import { authMessages } from '#/i18n/messages/auth'
import { track } from '#/integrations/posthog/analytics'
import { fieldErrorsOf, useErrorText } from '#/lib/use-error-text'
import { registerSchema } from '../schemas'
import { startSession } from '../session'
import type { RegisterForm as RegisterValues } from '../schemas'
import type { BillingInterval } from '#/features/billing/domain/plans'

type ServerErrors = Partial<Record<keyof RegisterValues, Array<string>>>

const defaultValues: RegisterValues = {
  username: '',
  email: '',
  password: '',
  acceptTerms: false,
}

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
  const navigate = useNavigate()
  const t = useMessages(authMessages)
  const { locale } = useI18n()
  const errorText = useErrorText()
  const [formError, setFormError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<ServerErrors>({})

  const form = useForm({
    defaultValues,
    validators: { onSubmit: registerSchema(t.validation) },
    onSubmit: async ({ value }) => {
      setFormError(null)
      setServerErrors({})
      const result = await authApi.register({
        username: value.username,
        email: value.email,
        password: value.password,
        locale,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      })
      if (!result.ok) {
        const fieldErrors = fieldErrorsOf(result.error)
        setServerErrors(fieldErrors)
        if (Object.keys(fieldErrors).length === 0)
          setFormError(errorText(result.error))
        return
      }
      startSession(result.value)
      track('signup_completed', {
        plan: next === 'checkout' ? `pro_${interval}` : 'free',
        locale,
      })
      // Wybrany na cenniku Pro: po założeniu konta od razu koszyk.
      await (next === 'checkout'
        ? navigate({ to: '/app/checkout', search: { interval } })
        : navigate({ to: '/app/settings' }))
    },
  })

  const clearServerError = (name: keyof RegisterValues) =>
    setServerErrors(({ [name]: _removed, ...rest }) => rest)

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
