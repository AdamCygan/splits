import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { accountApi } from '#/features/account/data/api'
import type { User } from '#/features/auth/data/dto'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { settingsMessages } from '#/i18n/messages/settings'
import { keys } from '#/shared/data/query-keys'
import { mutationFieldError, useDataMutation } from '#/shared/data/mutations'
import { securityQuery } from '../data/queries'
import {
  EMPTY_EMAIL_CHANGE,
  emailChangeInput,
  isEmail,
} from '../domain/account-forms'
import type { EmailChangeDraft } from '../domain/account-forms'

/**
 * ViewModel adresu e-mail: stan potwierdzenia, oczekująca zmiana (z anulowaniem),
 * ponowne wysłanie linku i okno zmiany adresu (hasło i kod 2FA, jeśli konto je ma).
 */
export function useEmailViewModel(user: User) {
  const t = useMessages(settingsMessages).security
  const security = useQuery(securityQuery).data
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<EmailChangeDraft>(EMPTY_EMAIL_CHANGE)
  const [submitted, setSubmitted] = useState(false)

  const resend = useDataMutation(() => accountApi.resendVerification(), {
    invalidate: [],
    success: fmt(t.resent, { email: user.email }),
  })
  const cancel = useDataMutation(() => accountApi.cancelEmailChange(), {
    invalidate: [keys.security],
    success: t.pendingCanceled,
  })
  const change = useDataMutation(
    (input: EmailChangeDraft) =>
      accountApi.changeEmail(emailChangeInput(input)),
    {
      invalidate: [keys.security],
      success: (_r, input) => fmt(t.emailSent, { email: input.email.trim() }),
      onSuccess: () => close(),
    },
  )
  const emailValid = isEmail(draft.email)

  function close() {
    setOpen(false)
    setDraft(EMPTY_EMAIL_CHANGE)
    setSubmitted(false)
    change.reset()
  }

  return {
    email: user.email,
    verified: security?.emailVerified ?? user.emailVerified,
    pendingEmail: security?.pendingEmail ?? null,
    needsPassword: security?.hasPassword ?? user.hasPassword,
    needsCode: security?.twoFactor ?? false,
    open,
    draft,
    sending: change.isPending,
    resending: resend.isPending,
    canceling: cancel.isPending,
    errors: {
      email: submitted
        ? emailValid
          ? mutationFieldError(change.error, 'email')
          : t.emailError
        : null,
      password: mutationFieldError(change.error, 'password'),
      code: mutationFieldError(change.error, 'code'),
    },
    // akcje
    openChange: () => setOpen(true),
    close,
    update: (patch: Partial<EmailChangeDraft>) =>
      setDraft((d) => ({ ...d, ...patch })),
    submit: (e: FormEvent) => {
      e.preventDefault()
      setSubmitted(true)
      if (emailValid) change.mutate(draft)
    },
    resend: () => resend.mutate(undefined),
    cancelPending: () => cancel.mutate(undefined),
  }
}

export type EmailViewModel = ReturnType<typeof useEmailViewModel>
