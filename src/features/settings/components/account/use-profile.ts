import { useState } from 'react'
import type { FormEvent } from 'react'
import { data } from '#/data'
import type { ProfileInput, User } from '#/data/types'
import { setCurrentUser } from '#/features/auth/session'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'
import { keys, mutationFieldError, useDataMutation } from '../../queries'
import { useUnsavedWarning } from '../ui'
import { isDisplayName } from './model'

/** ViewModel profilu: wyświetlana nazwa z paskiem zapisu (login i e-mail tylko do odczytu). */
export function useProfileViewModel(user: User) {
  const t = useMessages(settingsMessages).account
  const [displayName, setDisplayName] = useState(user.displayName)
  const [submitted, setSubmitted] = useState(false)
  const save = useDataMutation(
    (input: ProfileInput) => data.account.updateProfile(input),
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
