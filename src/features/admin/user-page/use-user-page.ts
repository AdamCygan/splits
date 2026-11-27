import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { adminApi } from '../data/api'
import type { AdminUserChange } from '#/features/admin/data/dto'
import type { PlanCode } from '#/features/auth/data/dto'
import { useCurrentUser } from '#/features/auth/session'
import {
  mutationFieldError,
  useDataMutation,
} from '#/features/settings/queries'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'
import { describeDevice } from '#/lib/user-agent'
import { pageCount } from '../model'
import {
  adminActionsQuery,
  adminInvoicesQuery,
  adminKeys,
  adminUserQuery,
} from '../queries'

/** Okno potwierdzenia na stronie konta (jedno naraz). */
export type UserDialog = 'block' | 'delete' | 'twoFactor' | null

/** Najmniejsza długość powodu wyłączenia 2FA (jak na serwerze). */
const REASON_MIN = 10

/**
 * ViewModel strony konta w panelu admina: dane, bezpieczeństwo, urządzenia, płatności
 * i historia zmian, z akcjami obsługi klienta. Każda akcja odświeża konto i dziennik.
 */
export function useUserPageViewModel(id: string) {
  const t = useMessages(adminMessages)
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

  const u = user.data
  const name = u?.displayName ?? ''
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
      success: (_, change) =>
        change.plan
          ? fmt(t.toast.plan, { plan: t.plans[change.plan] })
          : change.role
            ? fmt(change.role === 'admin' ? t.toast.roleOn : t.toast.roleOff, {
                name,
              })
            : fmt(change.disabled ? t.toast.blocked : t.toast.unblocked, {
                name,
              }),
      onSuccess: () => {
        setPlan(null)
        closeDialog()
      },
    },
  )
  const revokeAll = useDataMutation(() => adminApi.revokeSessions(id), {
    invalidate: refresh,
    success: fmt(t.toast.revoked, { name }),
  })
  const revokeOne = useDataMutation(
    ({ sessionId }: SessionTarget) => adminApi.revokeSession(id, sessionId),
    {
      invalidate: refresh,
      success: (_, v) => fmt(t.user.security.signedOut, { device: v.label }),
    },
  )
  const resend = useDataMutation(() => adminApi.resendVerification(id), {
    invalidate: refresh,
    success: fmt(t.user.security.resent, { email: u?.email ?? '' }),
  })
  const cancelPending = useDataMutation(() => adminApi.cancelEmailChange(id), {
    invalidate: refresh,
    success: t.user.security.pendingCanceled,
  })
  const disable2fa = useDataMutation(
    (value: string) => adminApi.disableTwoFactor(id, value),
    {
      invalidate: refresh,
      success: fmt(t.user.security.disabled2fa, { name }),
      onSuccess: closeDialog,
    },
  )
  const remove = useDataMutation(
    (value: string) => adminApi.deleteUser(id, value),
    {
      invalidate: [adminKeys.all],
      success: fmt(t.toast.deleted, { name }),
      onSuccess: () => void navigate({ to: '/app/admin' }),
    },
  )

  const self = u?.id === me?.id
  const reasonValid = reason.trim().length >= REASON_MIN
  const busy =
    update.isPending ||
    revokeAll.isPending ||
    revokeOne.isPending ||
    remove.isPending ||
    disable2fa.isPending

  return {
    user: u,
    pending: user.isPending,
    missing: user.isError,
    self,
    // Własne konto i konto właściciela: bez zmiany roli, blokady, 2FA i usuwania.
    locked: self || Boolean(u?.isOwner),
    plan: plan ?? u?.plan ?? 'free',
    planChanged: plan !== null && plan !== u?.plan,
    busy,
    dialog,
    reason,
    confirmEmail,
    reasonError: submitted && !reasonValid ? t.user.security.reasonError : null,
    confirmError: mutationFieldError(remove.error, 'confirmEmail'),
    blocking: update.isPending,
    deleting: remove.isPending,
    disabling: disable2fa.isPending,
    resending: resend.isPending,
    canceling: cancelPending.isPending,
    sessions: (u?.sessions ?? []).map((s) => {
      const device = describeDevice(s.userAgent)
      return {
        ...s,
        label: device
          ? `${device.browser}, ${device.os}`
          : t.user.security.unknownDevice,
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
    submitTwoFactor: (e: FormEvent) => {
      e.preventDefault()
      setSubmitted(true)
      if (reasonValid) disable2fa.mutate(reason.trim())
    },
    submitDelete: (e: FormEvent) => {
      e.preventDefault()
      remove.mutate(confirmEmail.trim())
    },
  }
}

export interface SessionTarget {
  sessionId: string
  label: string
}

export type UserPageViewModel = ReturnType<typeof useUserPageViewModel>
