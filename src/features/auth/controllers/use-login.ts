import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { useMessages } from '#/i18n/context'
import { authMessages } from '#/i18n/messages/auth'
import { useErrorText } from '#/lib/use-error-text'
import { authApi } from '../data/api'
import { startSession } from '../data/session'
import { loginSchema } from '../domain/validation'
import type { LoginForm as LoginValues } from '../domain/validation'

const defaultValues: LoginValues = { login: '', password: '' }

/** Logowanie: walidacja, wywołanie API, sesja i przejście do panelu (albo `redirectTo`). */
export function useLogin(redirectTo?: string) {
  const navigate = useNavigate()
  const messages = useMessages(authMessages)
  const errorText = useErrorText()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues,
    validators: { onSubmit: loginSchema(messages.validation) },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const result = await authApi.login(value)
      if (!result.ok) {
        setFormError(errorText(result.error))
        return
      }
      // Drugi krok (kod 2FA) dojdzie razem z ustawieniami bezpieczeństwa.
      if ('mfaRequired' in result.value) {
        setFormError(messages.login.twoFactorUnavailable)
        return
      }
      startSession(result.value)
      await navigate({ to: redirectTo ?? '/app' })
    },
  })
  return { form, formError }
}
