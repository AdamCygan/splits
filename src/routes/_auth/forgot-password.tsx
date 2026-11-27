import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  FormAlert,
  TextField,
  errorMessages,
} from '#/components/form/form-field'
import { Button } from '#/components/ui/button'
import { authApi } from '#/features/auth/data/api'
import { forgotPasswordSchema } from '#/features/auth/schemas'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { getLocale } from '#/i18n/locale'
import { authMessages } from '#/i18n/messages/auth'
import { seo } from '#/lib/seo'
import { useErrorText } from '#/lib/use-error-text'

export const Route = createFileRoute('/_auth/forgot-password')({
  head: () =>
    seo({
      title: authMessages[getLocale()].forgot.seoTitle,
      path: '/forgot-password',
      noindex: true,
    }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const t = useMessages(authMessages)
  const errorText = useErrorText()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '' },
    validators: { onSubmit: forgotPasswordSchema(t.validation) },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const result = await authApi.forgotPassword(value.email)
      if (!result.ok) {
        setFormError(errorText(result.error))
        return
      }
      setSentTo(value.email)
    },
  })

  if (sentTo) {
    return (
      <div role="status">
        <h1 className="type-display text-5xl">{t.forgot.sentTitle}</h1>
        <p className="mt-4 text-ink-soft">
          {fmt(t.forgot.sentText, { email: sentTo })}
        </p>
        <Link
          to="/login"
          className="mt-8 inline-block rounded-sm font-medium underline underline-offset-4"
        >
          {t.forgot.back}
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="type-display text-5xl">{t.forgot.title}</h1>
      <p className="mt-3 mb-8 text-ink-soft">{t.forgot.lead}</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
        className="space-y-5"
      >
        {formError && <FormAlert>{formError}</FormAlert>}
        <form.Field name="email">
          {(field) => (
            <TextField
              label={t.forgot.email}
              type="email"
              name={field.name}
              autoComplete="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              errors={errorMessages(field.state.meta.errors)}
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
              {isSubmitting ? t.forgot.submitting : t.forgot.submit}
            </Button>
          )}
        </form.Subscribe>
        <Link
          to="/login"
          className="block rounded-sm text-center text-sm text-ink-soft hover:text-ink"
        >
          {t.forgot.back}
        </Link>
      </form>
    </div>
  )
}
