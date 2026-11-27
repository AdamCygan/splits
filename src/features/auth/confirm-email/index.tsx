import { Link } from '@tanstack/react-router'
import { CircleCheck } from 'lucide-react'
import { FormAlert } from '#/components/form/form-field'
import { buttonVariants } from '#/components/ui/button'
import { useMessages } from '#/i18n/context'
import { authMessages } from '#/i18n/messages/auth'
import { cn } from '#/lib/utils'
import { useConfirmEmailViewModel } from './use-confirm-email'
import type { ConfirmEmailViewModel } from './use-confirm-email'

export interface ConfirmEmailPageProps {
  token: string | undefined
}

/**
 * Strona z linku w e-mailu: potwierdzenie adresu po rejestracji albo nowego adresu po
 * zmianie w ustawieniach. Działa też bez logowania (link otwarty na innym urządzeniu).
 */
export function ConfirmEmailPage({ token }: ConfirmEmailPageProps) {
  const t = useMessages(authMessages).confirmEmail
  const vm = useConfirmEmailViewModel(token)
  const { state } = vm

  if (state.status === 'checking')
    return (
      <div role="status" aria-live="polite">
        <h1 className="type-display text-5xl">{t.checking}</h1>
      </div>
    )

  if (state.status === 'verified' || state.status === 'changed')
    return (
      <div role="status">
        <CircleCheck aria-hidden className="mb-4 size-10 text-ok" />
        <h1 className="type-display text-5xl">
          {state.status === 'verified' ? t.verifiedTitle : t.changedTitle}
        </h1>
        <p className="mt-3 text-ink-soft">
          {state.status === 'verified' ? t.verifiedText : t.changedText}
        </p>
        <NextStep vm={vm} />
      </div>
    )

  return (
    <div>
      <h1 className="type-display text-5xl">{t.failedTitle}</h1>
      <div className="mt-6">
        <FormAlert>{vm.errorText ?? t.missing}</FormAlert>
      </div>
      <NextStep vm={vm} failed />
    </div>
  )
}

interface NextStepProps {
  vm: ConfirmEmailViewModel
  failed?: boolean
}

/** Dalej: do aplikacji (albo do ustawień po nowy link), a bez sesji do logowania. */
function NextStep({ vm, failed = false }: NextStepProps) {
  const t = useMessages(authMessages).confirmEmail
  const className = cn(buttonVariants({ size: 'lg' }), 'mt-8 h-11 text-base')
  if (!vm.signedIn)
    return (
      <Link to="/login" className={className}>
        {t.logIn}
      </Link>
    )
  return failed ? (
    <Link to="/app/settings/account" className={className}>
      {t.toAccount}
    </Link>
  ) : (
    <Link to="/app" className={className}>
      {t.openApp}
    </Link>
  )
}
