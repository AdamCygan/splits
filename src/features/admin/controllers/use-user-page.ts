import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { adminApi } from '../data/api'
import type { AdminUserChange } from '#/features/admin/data/dto'
import type { PlanCode } from '#/features/auth/data/dto'
import { useCurrentUser } from '#/features/auth/data/session'
import { mutationFieldError, useDataMutation } from '#/shared/data/mutations'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'
import { describeDevice } from '#/lib/user-agent'
import { pageCount } from '../domain/filters'
import {
  adminActionsQuery,
  adminInvoicesQuery,
  adminKeys,
  adminUserQuery,
} from '../data/queries'

/** Okno potwierdzenia na stronie konta (jedno naraz). */
export type UserDialog = 'block' | 'delete' | 'twoFactor' | null

/** Najmniejsza długość powodu wyłączenia 2FA (jak na serwerze). */
const REASON_MIN = 10

/**
 * ViewModel strony konta w panelu admina: dane, bezpieczeństwo, urządzenia, płatności
 * i historia zmian, z akcjami obsługi klienta. Każda akcja odświeża konto i dziennik.
 */
export function useUserPageViewModel(id: string) {
  const messages = useMessages(adminMessages)
  const navigate = useNavigate()
  const me = useCurrentUser()
  const user = useQuery(adminUserQuery(id))
  const [historyPage, setHistoryPage] = useState(1)
  const history = useQuery(
    adminActionsQuery({ targetId: id, page: historyPage }),
  )
  const [showInvoices, setShowInvoices] = useState(false)
  const invoices = useQuery({
    ...adminInvoicesQuery(id),
    enabled: showInvoices,
  })
  const [plan, setPlan] = useState<PlanCode | null>(null)
  const [dialog, setDialog] = useState<UserDialog>(null)
  const [reason, setReason] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const data = user.data
  const name = data?.displayName ?? ''
  const refresh = [adminKeys.user(id), adminKeys.all]
  const closeDialog = () => {
    setDialog(null)
    setReason('')
    setConfirmEmail('')
    setSubmitted(false)
  }

  const update = useDataMutation(
    (change: AdminUserChange) => adminApi.updateUser(id, change),
    {
      invalidate: refresh,
      success: (_unused, change) =>
        change.plan
          ? fmt(messages.toast.plan, { plan: messages.plans[change.plan] })
          : change.role
            ? fmt(
                change.role === 'admin'
                  ? messages.toast.roleOn
                  : messages.toast.roleOff,
                {
                  name,
                },
              )
            : fmt(
                change.disabled
                  ? messages.toast.blocked
                  : messages.toast.unblocked,
                {
                  name,
                },
              ),
      onSuccess: () => {
        setPlan(null)
        closeDialog()
      },
    },
  )
  const revokeAll = useDataMutation(() => adminApi.revokeSessions(id), {
    invalidate: refresh,
    success: fmt(messages.toast.revoked, { name }),
  })
  const revokeOne = useDataMutation(
    ({ sessionId }: SessionTarget) => adminApi.revokeSession(id, sessionId),
    {
      invalidate: refresh,
      success: (_unused, sessionTarget) =>
        fmt(messages.user.security.signedOut, { device: sessionTarget.label }),
    },
  )
  const resend = useDataMutation(() => adminApi.resendVerification(id), {
    invalidate: refresh,
    success: fmt(messages.user.security.resent, { email: data?.email ?? '' }),
  })
  const cancelPending = useDataMutation(() => adminApi.cancelEmailChange(id), {
    invalidate: refresh,
    success: messages.user.security.pendingCanceled,
  })
  const disable2fa = useDataMutation(
    (value: string) => adminApi.disableTwoFactor(id, value),
    {
      invalidate: refresh,
      success: fmt(messages.user.security.disabled2fa, { name }),
      onSuccess: closeDialog,
    },
  )
  const remove = useDataMutation(
    (value: string) => adminApi.deleteUser(id, value),
    {
      invalidate: [adminKeys.all],
      success: fmt(messages.toast.deleted, { name }),
      onSuccess: () => void navigate({ to: '/app/admin' }),
    },
  )

  const self = data?.id === me?.id
  const reasonValid = reason.trim().length >= REASON_MIN
  const busy =
    update.isPending ||
    revokeAll.isPending ||
    revokeOne.isPending ||
    remove.isPending ||
    disable2fa.isPending

  return {
    user: data,
    pending: user.isPending,
    missing: user.isError,
    self,
    // Własne konto i konto właściciela: bez zmiany roli, blokady, 2FA i usuwania.
    locked: self || Boolean(data?.isOwner),
    plan: plan ?? data?.plan ?? 'free',
    planChanged: plan !== null && plan !== data?.plan,
    busy,
    dialog,
    reason,
    confirmEmail,
    reasonError:
      submitted && !reasonValid ? messages.user.security.reasonError : null,
    confirmError: mutationFieldError(remove.error, 'confirmEmail'),
    blocking: update.isPending,
    deleting: remove.isPending,
    disabling: disable2fa.isPending,
    resending: resend.isPending,
    canceling: cancelPending.isPending,
    sessions: (data?.sessions ?? []).map((session) => {
      const device = describeDevice(session.userAgent)
      return {
        ...session,
        label: device
          ? `${device.browser}, ${device.operatingSystem}`
          : messages.user.security.unknownDevice,
      }
    }),
    showInvoices,
    invoices: invoices.data ?? [],
    invoicesPending: showInvoices && invoices.isPending,
    history: history.data?.items ?? [],
    historyPage,
    historyPages: history.data
      ? pageCount(history.data.total, history.data.pageSize)
      : 1,
    // akcje
    setPlan,
    savePlan: () => plan && update.mutate({ plan }),
    setRole: (admin: boolean) =>
      update.mutate({ role: admin ? 'admin' : 'client' }),
    unblock: () => update.mutate({ disabled: false }),
    block: () => update.mutate({ disabled: true }),
    revokeAll: () => revokeAll.mutate(undefined),
    revokeSession: (session: SessionTarget) => revokeOne.mutate(session),
    resend: () => resend.mutate(undefined),
    cancelPending: () => cancelPending.mutate(undefined),
    loadInvoices: () => setShowInvoices(true),
    setHistoryPage,
    openDialog: setDialog,
    closeDialog,
    setReason,
    setConfirmEmail,
    submitTwoFactor: (formEvent: FormEvent) => {
      formEvent.preventDefault()
      setSubmitted(true)
      if (reasonValid) disable2fa.mutate(reason.trim())
    },
    submitDelete: (formEvent: FormEvent) => {
      formEvent.preventDefault()
      remove.mutate(confirmEmail.trim())
    },
  }
}

export interface SessionTarget {
  sessionId: string
  label: string
}

export type UserPageViewModel = ReturnType<typeof useUserPageViewModel>
