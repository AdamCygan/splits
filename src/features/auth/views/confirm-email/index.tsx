import { Link } from '@tanstack/react-router'
import { CircleCheck } from 'lucide-react'
import { FormAlert } from '#/components/form/form-field'
import { buttonVariants } from '#/components/ui/button'
import { useMessages } from '#/i18n/context'
import { authMessages } from '#/i18n/messages/auth'
import { cn } from '#/lib/utils'
import { useConfirmEmailViewModel } from '../../controllers/use-confirm-email'
import type { ConfirmEmailViewModel } from '../../controllers/use-confirm-email'

export interface ConfirmEmailPageProps {
  token: string | undefined
}

/**
 * Strona z linku w e-mailu: potwierdzenie adresu po rejestracji albo nowego adresu po
 * zmianie w ustawieniach. Działa też bez logowania (link otwarty na innym urządzeniu).
 */
export function ConfirmEmailPage({ token }: ConfirmEmailPageProps) {
  const messages = useMessages(authMessages).confirmEmail
  const viewModel = useConfirmEmailViewModel(token)
  const { state } = viewModel

  const isChecking = state.status === 'checking'
  if (isChecking)
    return (
      <div role="status" aria-live="polite">
        <h1 className="type-display text-5xl">{messages.checking}</h1>
      </div>
    )

  const isConfirmed = state.status === 'verified' || state.status === 'changed'
  if (isConfirmed)
    return (
      <div role="status">
        <CircleCheck aria-hidden className="mb-4 size-10 text-ok" />
        <h1 className="type-display text-5xl">
          {state.status === 'verified'
            ? messages.verifiedTitle
            : messages.changedTitle}
        </h1>
        <p className="mt-3 text-ink-soft">
          {state.status === 'verified'
            ? messages.verifiedText
            : messages.changedText}
        </p>
        <NextStep viewModel={viewModel} />
      </div>
    )

  return (
    <div>
      <h1 className="type-display text-5xl">{messages.failedTitle}</h1>
      <div className="mt-6">
        <FormAlert>{viewModel.errorText ?? messages.missing}</FormAlert>
      </div>
      <NextStep viewModel={viewModel} failed />
    </div>
  )
}

interface NextStepProps {
  viewModel: ConfirmEmailViewModel
  failed?: boolean
}

/** Dalej: do aplikacji (albo do ustawień po nowy link), a bez sesji do logowania. */
function NextStep({ viewModel, failed = false }: NextStepProps) {
  const messages = useMessages(authMessages).confirmEmail
  const className = cn(buttonVariants({ size: 'lg' }), 'mt-8 h-11 text-base')
  if (!viewModel.signedIn)
    return (
      <Link to="/login" className={className}>
        {messages.logIn}
      </Link>
    )
  return failed ? (
    <Link to="/app/settings/account" className={className}>
      {messages.toAccount}
    </Link>
  ) : (
    <Link to="/app" className={className}>
      {messages.openApp}
    </Link>
  )
}
