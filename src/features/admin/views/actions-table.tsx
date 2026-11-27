import { Link } from '@tanstack/react-router'
import type { AdminAction } from '#/features/admin/data/dto'
import { ADMIN_ACTION_KINDS } from '#/features/admin/domain/admin'
import type { AdminActionKind } from '#/features/admin/domain/admin'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'

export interface ActionsTableProps {
  actions: ReadonlyArray<AdminAction>
  /** Kolumna „Konto” (ukryta w historii jednego konta). */
  showTarget?: boolean
  caption: string
}

const isKind = (action: string): action is AdminActionKind =>
  (ADMIN_ACTION_KINDS as ReadonlyArray<string>).includes(action)

/** Wpisy dziennika zmian: kiedy, co, którego konta dotyczyło i kto to zrobił. */
export function ActionsTable({
  actions,
  showTarget = true,
  caption,
}: ActionsTableProps) {
  const t = useMessages(adminMessages).log
  const { tag } = useI18n()
  const stamp = (value: string) =>
    new Date(value).toLocaleString(tag, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  return (
    <div
      className="relative overflow-x-auto"
      role="region"
      tabIndex={0}
      aria-label={caption}
    >
      <table className="w-full min-w-[40rem] text-[0.9375rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-sm text-ink-soft">
            <th scope="col" className="px-5 py-3 font-medium sm:px-6">
              {t.when}
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              {t.action}
            </th>
            {showTarget && (
              <th scope="col" className="px-3 py-3 font-medium">
                {t.target}
              </th>
            )}
            <th scope="col" className="px-5 py-3 font-medium sm:px-6">
              {t.admin}
            </th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a.id} className="border-t border-line align-top">
              <td className="px-5 py-2.5 whitespace-nowrap text-ink-soft sm:px-6">
                {stamp(a.createdAt)}
              </td>
              <td className="px-3 py-2.5">
                {isKind(a.action) ? t.actions[a.action] : a.action}
                {a.detail && (
                  <span className="block text-sm break-words text-ink-soft">
                    {a.detail}
                  </span>
                )}
              </td>
              {showTarget && (
                <td className="max-w-[16rem] truncate px-3 py-2.5">
                  <ActionTarget action={a} />
                </td>
              )}
              <td className="max-w-[16rem] truncate px-5 py-2.5 text-ink-soft sm:px-6">
                {a.adminEmail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ActionTargetProps {
  action: AdminAction
}

/** Konto jako link do jego strony; usunięte konto i akcje na wielu kontach bez linku. */
function ActionTarget({ action }: ActionTargetProps) {
  const t = useMessages(adminMessages).log
  if (!action.targetEmail) return <>{t.manyAccounts}</>
  if (!action.targetUserId || action.action === 'user.deleted')
    return <>{fmt(t.deletedAccount, { email: action.targetEmail })}</>
  return (
    <Link
      to="/app/admin/users/$id"
      params={{ id: action.targetUserId }}
      className="underline-offset-4 hover:underline"
    >
      {action.targetEmail}
    </Link>
  )
}
