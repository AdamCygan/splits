import { Link } from '@tanstack/react-router'
import { useLogin } from '../controllers/use-login'
import {
  FormAlert,
  TextField,
  errorMessages,
} from '#/components/form/form-field'
import { Button } from '#/components/ui/button'
import { useMessages } from '#/i18n/context'
import { authMessages } from '#/i18n/messages/auth'

export interface LoginFormProps {
  redirectTo?: string
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const messages = useMessages(authMessages)
  const { form, formError } = useLogin(redirectTo)

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="space-y-5"
    >
      {formError && <FormAlert>{formError}</FormAlert>}

      <form.Field name="login">
        {(field) => (
          <TextField
            label={messages.login.loginLabel}
            name={field.name}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            errors={errorMessages(field.state.meta.errors)}
          />
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <TextField
            label={messages.login.password}
            type="password"
            name={field.name}
            autoComplete="current-password"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            errors={errorMessages(field.state.meta.errors)}
            labelAction={
              <Link
                to="/forgot-password"
                className="rounded-sm text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                {messages.login.forgot}
              </Link>
            }
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
            {isSubmitting ? messages.login.submitting : messages.login.submit}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
