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
  const t = useMessages(adminMessages).log
  const format = useFormat()
  const vm = useLogPageViewModel(props)
  return (
    <>
      <SectionHeader title={t.title} lead={t.lead} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t.action}>
          {(control) => (
            <Select
              {...control}
              value={vm.filter.action ?? ''}
              onChange={(e) =>
                vm.setAction(
                  (e.target.value || undefined) as AdminActionKind | undefined,
                )
              }
            >
              <option value="">{t.allActions}</option>
              {ADMIN_ACTION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t.actions[kind]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.targetFilter}>
          {(control) => (
            <Input
              {...control}
              type="search"
              value={vm.target}
              onChange={(e) => vm.setTarget(e.target.value)}
            />
          )}
        </Field>
        <Field label={t.adminFilter}>
          {(control) => (
            <Input
              {...control}
              type="search"
              value={vm.admin}
              onChange={(e) => vm.setAdmin(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {vm.pending ? (
          <div
            aria-hidden
            className="m-5 h-32 animate-pulse rounded-lg bg-muted"
          />
        ) : vm.items.length === 0 ? (
          <p className="px-5 py-8 text-ink-soft sm:px-6">{t.empty}</p>
        ) : (
          <ActionsTable actions={vm.items} caption={t.title} />
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm sm:px-6">
          <p role="status" className="text-ink-soft">
            {format.plural(t.total, vm.total)}
          </p>
          <Pagination page={vm.page} pages={vm.pages} onPage={vm.setPage} />
        </footer>
      </div>
    </>
  )
}
