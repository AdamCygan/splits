import { Panel } from '#/components/ui/panel'
import { useMessages } from '#/i18n/context'
import { adminMessages } from '#/i18n/messages/admin'
import { ActionsTable } from '../actions-table'
import { Pagination } from '../pagination'
import type { SectionProps } from './account-section'

/** Historia działań administratorów na tym koncie (od najnowszych). */
export function HistorySection({ viewModel }: SectionProps) {
  const messages = useMessages(adminMessages)
  const copy = messages.user.history
  return (
    <Panel title={copy.title}>
      {viewModel.history.length === 0 ? (
        <p className="text-sm text-ink-soft">{copy.empty}</p>
      ) : (
        <div className="-mx-5 sm:-mx-6">
          <ActionsTable
            actions={viewModel.history}
            showTarget={false}
            caption={messages.log.title}
          />
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Pagination
          page={viewModel.historyPage}
          pages={viewModel.historyPages}
          onPage={viewModel.setHistoryPage}
        />
      </div>
    </Panel>
  )
}
