import { useState } from 'react'
import type { FormEvent } from 'react'
import { accountApi } from '#/features/account/data/api'
import type { ProfileInput } from '#/features/account/data/dto'
import type { User } from '#/features/auth/data/dto'
import { setCurrentUser } from '#/features/auth/data/session'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'
import { keys } from '#/shared/data/query-keys'
import { mutationFieldError, useDataMutation } from '#/shared/data/mutations'
import { useUnsavedWarning } from '#/features/settings/views/ui'
import { isDisplayName } from '../domain/account-forms'

/** ViewModel profilu: wyświetlana nazwa z paskiem zapisu (login i e-mail tylko do odczytu). */
export function useProfileViewModel(user: User) {
  const t = useMessages(settingsMessages).account
  const [displayName, setDisplayName] = useState(user.displayName)
  const [submitted, setSubmitted] = useState(false)
  const save = useDataMutation(
    (input: ProfileInput) => accountApi.updateProfile(input),
    {
      invalidate: [keys.me],
      success: t.profileSaved,
      onSuccess: (updated) => {
        setCurrentUser(updated)
        setSubmitted(false)
      },
    },
  )
  const valid = isDisplayName(displayName)
  const dirty = displayName !== user.displayName
  useUnsavedWarning(dirty)

  return {
    user,
    displayName,
    dirty,
    saving: save.isPending,
    nameError: submitted
      ? valid
        ? mutationFieldError(save.error, 'displayName')
        : t.nameError
      : null,
    setDisplayName,
    submit: (e: FormEvent) => {
      e.preventDefault()
      setSubmitted(true)
      if (valid) save.mutate({ displayName: displayName.trim() })
    },
    discard: () => {
      setDisplayName(user.displayName)
      setSubmitted(false)
    },
  }
}

export type ProfileViewModel = ReturnType<typeof useProfileViewModel>
