import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from '#/lib/zod'
import {
  FormAlert,
  TextField,
  errorMessages,
} from '#/components/form/form-field'
import { Button } from '#/components/ui/button'
import { data } from '#/data'
import { passwordSchema } from '#/features/auth/schemas'
import { useMessages } from '#/i18n/context'
import { getLocale } from '#/i18n/locale'
import { authMessages } from '#/i18n/messages/auth'
import { seo } from '#/lib/seo'
import { useErrorText } from '#/lib/use-error-text'

interface ResetSearch {
  token?: string
}

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: (search: Record<string, unknown>): ResetSearch =>
    typeof search.token === 'string' && /^[\w-]{10,200}$/.test(search.token)
      ? { token: search.token }
      : {},
  head: () =>
    seo({
      title: authMessages[getLocale()].reset.seoTitle,
      path: '/reset-password',
      noindex: true,
    }),
  component: ResetPasswordPage,
})

/** Strona z linku w e-mailu: nowe hasło dla tokenu z adresu (ważny 60 minut, jednorazowy). */
function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const t = useMessages(authMessages)
  const errorText = useErrorText()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { password: '', confirm: '' },
    validators: {
      onSubmit: z
        .object({ password: passwordSchema(t.validation), confirm: z.string() })
        .refine((v) => v.password === v.confirm, {
          path: ['confirm'],
          message: t.reset.confirmError,
        }),
    },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const result = await data.auth.resetPassword(token ?? '', value.password)
      if (!result.ok) {
        setFormError(errorText(result.error))
        return
      }
      await navigate({ to: '/login', search: { reset: true } })
    },
  })

  if (!token) {
    return (
      <div>
        <h1 className="type-display text-5xl">{t.reset.title}</h1>
        <div className="mt-6">
          <FormAlert>{t.reset.missing}</FormAlert>
        </div>
        <Link
          to="/forgot-password"
          className="mt-6 inline-block rounded-sm font-medium underline underline-offset-4"
        >
          {t.reset.again}
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="type-display text-5xl">{t.reset.title}</h1>
      <p className="mt-3 mb-8 text-ink-soft">{t.reset.lead}</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
        className="space-y-5"
      >
        {formError && (
          <FormAlert>
            {formError}{' '}
            <Link to="/forgot-password" className="font-medium underline">
              {t.reset.again}
            </Link>
          </FormAlert>
        )}
        <form.Field name="password">
          {(field) => (
            <TextField
              label={t.reset.password}
              type="password"
              name={field.name}
              autoComplete="new-password"
              hint={t.register.passwordHint}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              errors={errorMessages(field.state.meta.errors)}
            />
          )}
        </form.Field>
        <form.Field name="confirm">
          {(field) => (
            <TextField
              label={t.reset.confirm}
              type="password"
              name={field.name}
              autoComplete="new-password"
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
              {isSubmitting ? t.reset.submitting : t.reset.submit}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  )
}
