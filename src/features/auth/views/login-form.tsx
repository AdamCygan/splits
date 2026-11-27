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
import { useMessages } from '#/i18n/context'
import { authMessages } from '#/i18n/messages/auth'
import { useErrorText } from '#/lib/use-error-text'
import { loginSchema } from '../domain/validation'
import { startSession } from '../data/session'
import type { LoginForm as LoginValues } from '../domain/validation'

const defaultValues: LoginValues = { login: '', password: '' }

export interface LoginFormProps {
  redirectTo?: string
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const navigate = useNavigate()
  const t = useMessages(authMessages)
  const errorText = useErrorText()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues,
    validators: { onSubmit: loginSchema(t.validation) },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const result = await authApi.login(value)
      if (!result.ok) {
        setFormError(errorText(result.error))
        return
      }
      // Drugi krok (kod 2FA) dojdzie razem z ustawieniami bezpieczeństwa.
      if ('mfaRequired' in result.value) {
        setFormError(t.login.twoFactorUnavailable)
        return
      }
      startSession(result.value)
      await navigate({ to: redirectTo ?? '/app' })
    },
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

      <form.Field name="login">
        {(field) => (
          <TextField
            label={t.login.loginLabel}
            name={field.name}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            errors={errorMessages(field.state.meta.errors)}
          />
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <TextField
            label={t.login.password}
            type="password"
            name={field.name}
            autoComplete="current-password"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            errors={errorMessages(field.state.meta.errors)}
            labelAction={
              <Link
                to="/forgot-password"
                className="rounded-sm text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                {t.login.forgot}
              </Link>
            }
          />
        )}
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
            {isSubmitting ? t.login.submitting : t.login.submit}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
