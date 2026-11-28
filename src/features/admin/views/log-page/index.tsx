import { Field, Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import type { AdminActionKind } from '#/features/admin/domain/admin'
import { ADMIN_ACTION_KINDS } from '#/features/admin/domain/admin'
import { SectionHeader } from '#/features/settings/views/ui'
import { useFormat, useMessages } from '#/i18n/context'
import { adminMessages } from '#/i18n/messages/admin'
import { ActionsTable } from '../actions-table'
import { Pagination } from '../pagination'
import { useLogPageViewModel } from '../../controllers/use-log-page'
import type { LogPageOptions } from '../../controllers/use-log-page'

export type AdminLogPageProps = LogPageOptions

/** Panel admina → Dziennik zmian (MVVM): filtry w adresie strony, wpisy od najnowszych. */
export function AdminLogPage(props: AdminLogPageProps) {
  const messages = useMessages(adminMessages).log
  const format = useFormat()
  const viewModel = useLogPageViewModel(props)
  return (
    <>
      <SectionHeader title={messages.title} lead={messages.lead} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={messages.action}>
          {(control) => (
            <Select
              {...control}
              value={viewModel.filter.action ?? ''}
              onChange={(event) =>
                viewModel.setAction(
                  (event.target.value || undefined) as
                    AdminActionKind | undefined,
                )
              }
            >
              <option value="">{messages.allActions}</option>
              {ADMIN_ACTION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {messages.actions[kind]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={messages.targetFilter}>
          {(control) => (
            <Input
              {...control}
              type="search"
              value={viewModel.target}
              onChange={(event) => viewModel.setTarget(event.target.value)}
            />
          )}
        </Field>
        <Field label={messages.adminFilter}>
          {(control) => (
            <Input
              {...control}
              type="search"
              value={viewModel.admin}
              onChange={(event) => viewModel.setAdmin(event.target.value)}
            />
          )}
        </Field>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {viewModel.pending ? (
          <div
            aria-hidden
            className="m-5 h-32 animate-pulse rounded-lg bg-muted"
          />
        ) : viewModel.items.length === 0 ? (
          <p className="px-5 py-8 text-ink-soft sm:px-6">{messages.empty}</p>
        ) : (
          <ActionsTable actions={viewModel.items} caption={messages.title} />
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm sm:px-6">
          <p role="status" className="text-ink-soft">
            {format.plural(messages.total, viewModel.total)}
          </p>
          <Pagination
            page={viewModel.page}
            pages={viewModel.pages}
            onPage={viewModel.setPage}
          />
        </footer>
      </div>
    </>
  )
}
