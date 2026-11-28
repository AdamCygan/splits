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
import { forgotPasswordSchema } from '#/features/auth/domain/validation'
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
  const messages = useMessages(authMessages)
  const errorText = useErrorText()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '' },
    validators: { onSubmit: forgotPasswordSchema(messages.validation) },
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
        <h1 className="type-display text-5xl">{messages.forgot.sentTitle}</h1>
        <p className="mt-4 text-ink-soft">
          {fmt(messages.forgot.sentText, { email: sentTo })}
        </p>
        <Link
          to="/login"
          className="mt-8 inline-block rounded-sm font-medium underline underline-offset-4"
        >
          {messages.forgot.back}
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="type-display text-5xl">{messages.forgot.title}</h1>
      <p className="mt-3 mb-8 text-ink-soft">{messages.forgot.lead}</p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
        className="space-y-5"
      >
        {formError && <FormAlert>{formError}</FormAlert>}
        <form.Field name="email">
          {(field) => (
            <TextField
              label={messages.forgot.email}
              type="email"
              name={field.name}
              autoComplete="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              errors={errorMessages(field.state.meta.errors)}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(formState) => formState.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              size="lg"
              className="h-11 w-full text-base"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting
                ? messages.forgot.submitting
                : messages.forgot.submit}
            </Button>
          )}
        </form.Subscribe>
        <Link
          to="/login"
          className="block rounded-sm text-center text-sm text-ink-soft hover:text-ink"
        >
          {messages.forgot.back}
        </Link>
      </form>
    </div>
  )
}
