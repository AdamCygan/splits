import { Panel } from '#/components/ui/panel'
import { useMessages } from '#/i18n/context'
import { adminMessages } from '#/i18n/messages/admin'
import { ActionsTable } from '../actions-table'
import { Pagination } from '../pagination'
import type { SectionProps } from './account-section'

/** Historia działań administratorów na tym koncie (od najnowszych). */
export function HistorySection({ vm }: SectionProps) {
  const messages = useMessages(adminMessages)
  const t = messages.user.history
  return (
    <Panel title={t.title}>
      {vm.history.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.empty}</p>
      ) : (
        <div className="-mx-5 sm:-mx-6">
          <ActionsTable
            actions={vm.history}
            showTarget={false}
            caption={messages.log.title}
          />
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Pagination
          page={vm.historyPage}
          pages={vm.historyPages}
          onPage={vm.setHistoryPage}
        />
      </div>
    </Panel>
  )
}
