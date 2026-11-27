import { useState } from 'react'
import type { FormEvent } from 'react'
import { accountApi } from '#/features/account/data/api'
import { passwordSchema } from '#/features/auth/domain/validation'
import { useMessages } from '#/i18n/context'
import { authMessages } from '#/i18n/messages/auth'
import { settingsMessages } from '#/i18n/messages/settings'
import { mutationFieldError, useDataMutation } from '#/shared/data/mutations'

const EMPTY = { current: '', next: '', confirm: '' }

/**
 * ViewModel zmiany hasła. Konto założone przez Google nie ma hasła: pierwsze hasło
 * ustawia się bez podawania obecnego.
 */
export function usePasswordViewModel(hasPassword: boolean) {
  const t = useMessages(settingsMessages).account
  const v = useMessages(authMessages).validation
  const [draft, setDraft] = useState(EMPTY)
  const [submitted, setSubmitted] = useState(false)
  const save = useDataMutation(accountApi.changePassword, {
    invalidate: [],
    success: t.passwordSaved,
    onSuccess: () => {
      setDraft(EMPTY)
      setSubmitted(false)
    },
  })
  const errors = {
    current:
      draft.current || !hasPassword
        ? mutationFieldError(save.error, 'currentPassword')
        : v.passwordRequired,
    next:
      passwordSchema(v).safeParse(draft.next).error?.issues[0]?.message ?? null,
    confirm: draft.confirm === draft.next ? null : t.confirmError,
  }
  const shown = (error: string | null) => (submitted ? error : null)

  return {
    hasPassword,
    draft,
    saving: save.isPending,
    errors: {
      current: shown(errors.current),
      next: shown(errors.next),
      confirm: shown(errors.confirm),
    },
    update: (patch: Partial<typeof EMPTY>) =>
      setDraft((d) => ({ ...d, ...patch })),
    submit: (e: FormEvent) => {
      e.preventDefault()
      setSubmitted(true)
      if ((draft.current || !hasPassword) && !errors.next && !errors.confirm)
        save.mutate({ currentPassword: draft.current, newPassword: draft.next })
    },
  }
}
