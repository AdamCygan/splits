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
  const messages = useMessages(settingsMessages).account
  const copy = useMessages(authMessages).validation
  const [draft, setDraft] = useState(EMPTY)
  const [submitted, setSubmitted] = useState(false)
  const save = useDataMutation(accountApi.changePassword, {
    invalidate: [],
    success: messages.passwordSaved,
    onSuccess: () => {
      setDraft(EMPTY)
      setSubmitted(false)
    },
  })
  const errors = {
    current:
      draft.current || !hasPassword
        ? mutationFieldError(save.error, 'currentPassword')
        : copy.passwordRequired,
    next:
      passwordSchema(copy).safeParse(draft.next).error?.issues[0]?.message ??
      null,
    confirm: draft.confirm === draft.next ? null : messages.confirmError,
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
      setDraft((previousDraft) => ({ ...previousDraft, ...patch })),
    submit: (formEvent: FormEvent) => {
      formEvent.preventDefault()
      setSubmitted(true)
      const canSubmit =
        (draft.current || !hasPassword) && !errors.next && !errors.confirm
      if (canSubmit)
        save.mutate({ currentPassword: draft.current, newPassword: draft.next })
    },
  }
}
