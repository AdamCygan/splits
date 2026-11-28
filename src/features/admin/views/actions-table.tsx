import { isKind } from '../domain/actions'
import { Link } from '@tanstack/react-router'
import {
  Fact,
  Facts,
  RecordCard,
  RecordList,
} from '#/components/ui/record-cards'
import type { AdminAction } from '#/features/admin/data/dto'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'

export interface ActionsTableProps {
  actions: ReadonlyArray<AdminAction>
  /** Kolumna „Konto” (ukryta w historii jednego konta). */
  showTarget?: boolean
  caption: string
}

/** Wpisy dziennika zmian: kiedy, co, którego konta dotyczyło i kto to zrobił. */
export function ActionsTable({
  actions,
  showTarget = true,
  caption,
}: ActionsTableProps) {
  const messages = useMessages(adminMessages).log
  const { tag } = useI18n()
  const stamp = (value: string) =>
    new Date(value).toLocaleString(tag, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  return (
    <>
      <RecordList label={caption}>
        {actions.map((action) => (
          <RecordCard key={action.id}>
            <p className="text-sm text-ink-soft">{stamp(action.createdAt)}</p>
            <p className="mt-1 font-medium">
              <ActionLabel action={action} />
            </p>
            <Facts className="text-sm">
              {showTarget && (
                <Fact label={messages.target} className="col-span-2">
                  <span className="block truncate">
                    <ActionTarget action={action} />
                  </span>
                </Fact>
              )}
              <Fact label={messages.admin} className="col-span-2">
                <span className="block truncate font-normal text-ink-soft">
                  {action.adminEmail}
                </span>
              </Fact>
            </Facts>
          </RecordCard>
        ))}
      </RecordList>
      <div
        className="relative hidden overflow-x-auto sm:block"
        role="region"
        tabIndex={0}
        aria-label={caption}
      >
        <table className="w-full min-w-[40rem] text-[0.9375rem]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-left text-sm text-ink-soft">
              <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                {messages.when}
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                {messages.action}
              </th>
              {showTarget && (
                <th scope="col" className="px-3 py-3 font-medium">
                  {messages.target}
                </th>
              )}
              <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                {messages.admin}
              </th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action.id} className="border-t border-line align-top">
                <td className="px-5 py-2.5 whitespace-nowrap text-ink-soft sm:px-6">
                  {stamp(action.createdAt)}
                </td>
                <td className="px-3 py-2.5">
                  <ActionLabel action={action} />
                </td>
                {showTarget && (
                  <td className="max-w-[16rem] truncate px-3 py-2.5">
                    <ActionTarget action={action} />
                  </td>
                )}
                <td className="max-w-[16rem] truncate px-5 py-2.5 text-ink-soft sm:px-6">
                  {action.adminEmail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

interface ActionLabelProps {
  action: AdminAction
}

/** Co się stało (nazwa akcji) i szczegóły zmiany. */
function ActionLabel({ action }: ActionLabelProps) {
  const messages = useMessages(adminMessages).log
  return (
    <>
      {isKind(action.action) ? messages.actions[action.action] : action.action}
      {action.detail && (
        <span className="block text-sm font-normal break-words text-ink-soft">
          {action.detail}
        </span>
      )}
    </>
  )
}

interface ActionTargetProps {
  action: AdminAction
}

/** Konto jako link do jego strony; usunięte konto i akcje na wielu kontach bez linku. */
function ActionTarget({ action }: ActionTargetProps) {
  const messages = useMessages(adminMessages).log
  if (!action.targetEmail) return <>{messages.manyAccounts}</>
  const { targetUserId } = action
  const hasNoUserLink = !targetUserId || action.action === 'user.deleted'
  if (hasNoUserLink)
    return <>{fmt(messages.deletedAccount, { email: action.targetEmail })}</>
  return (
    <Link
      to="/app/admin/users/$id"
      params={{ id: targetUserId }}
      className="underline-offset-4 hover:underline"
    >
      {action.targetEmail}
    </Link>
  )
}
