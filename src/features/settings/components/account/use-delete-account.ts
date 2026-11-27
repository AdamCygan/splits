import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { accountApi } from '#/features/account/data/api'
import type { User } from '#/features/auth/data/dto'
import { clearSession } from '#/features/auth/session'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { settingsMessages } from '#/i18n/messages/settings'
import { mutationFieldError, useDataMutation } from '../../queries'
import { isDeleteCode, normalizeDeleteCode } from './model'

/**
 * ViewModel usuwania konta w dwóch krokach: kod na adres konta, potem ten kod w oknie.
 * Działa tak samo dla kont z hasłem i z samym Google.
 */
export function useDeleteAccountViewModel(user: User) {
  const t = useMessages(settingsMessages).account
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const send = useDataMutation(() => accountApi.sendDeleteCode(), {
    invalidate: [],
    success: () =>
      fmt(codeSent ? t.codeResent : t.codeSent, { email: user.email }),
    onSuccess: () => setCodeSent(true),
  })
  const remove = useDataMutation(
    (value: string) => accountApi.deleteAccount(value),
    {
      invalidate: [],
      onSuccess: () => {
        clearSession()
        void navigate({ to: '/' })
      },
    },
  )
  const valid = isDeleteCode(code)

  const close = () => {
    setOpen(false)
    setCodeSent(false)
    setCode('')
    setSubmitted(false)
    send.reset()
    remove.reset()
  }

  return {
    email: user.email,
    open,
    codeSent,
    code,
    sending: send.isPending,
    deleting: remove.isPending,
    codeError: submitted
      ? valid
        ? mutationFieldError(remove.error, 'code')
        : t.codeError
      : null,
    // akcje
    openDialog: () => setOpen(true),
    close,
    sendCode: () => send.mutate(undefined),
    setCode: (raw: string) => setCode(normalizeDeleteCode(raw)),
    submit: (e: FormEvent) => {
      e.preventDefault()
      setSubmitted(true)
      if (valid) remove.mutate(code)
    },
  }
}

export type DeleteAccountViewModel = ReturnType<
  typeof useDeleteAccountViewModel
>
