import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import type { BillingInterval } from '#/features/billing/domain/plans'
import { useI18n, useMessages } from '#/i18n/context'
import { authMessages } from '#/i18n/messages/auth'
import { track } from '#/integrations/posthog/analytics'
import { fieldErrorsOf, useErrorText } from '#/lib/use-error-text'
import { authApi } from '../data/api'
import { startSession } from '../data/session'
import { registerSchema } from '../domain/validation'
import type { RegisterForm as RegisterValues } from '../domain/validation'

export type RegisterServerErrors = Partial<
  Record<keyof RegisterValues, Array<string>>
>

const defaultValues: RegisterValues = {
  username: '',
  email: '',
  password: '',
  acceptTerms: false,
}

export interface RegisterOptions {
  /** Dokąd po założeniu konta: konfiguracja albo koszyk planu Pro. */
  next: 'setup' | 'checkout'
  interval: BillingInterval
}

/** Rejestracja: walidacja, konto w API, sesja, zdarzenie analityki i dalszy krok. */
export function useRegister({ next, interval }: RegisterOptions) {
  const navigate = useNavigate()
  const messages = useMessages(authMessages)
  const { locale } = useI18n()
  const errorText = useErrorText()
  const [formError, setFormError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<RegisterServerErrors>({})

  const form = useForm({
    defaultValues,
    validators: { onSubmit: registerSchema(messages.validation) },
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

  return { form, formError, serverErrors, clearServerError }
}
