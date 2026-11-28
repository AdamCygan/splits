import { ConfirmDialog } from '#/components/ui/dialog'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { DeleteTaskDialog } from '#/features/tasks/views/delete-task-dialog'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { EditEntryDialog } from '../edit-entry-dialog'
import { ExtendDialog } from '../extend-dialog'
import { SummaryDialog } from '../summary-dialog'
import { TaskCard } from './task-card'
import { useEntryListViewModel } from '../../controllers/use-entry-list'

export interface EntryListProps {
  entries: ReadonlyArray<TimeEntry>
}

/** Wpisy dnia jako karty zadań i okna otwierane z nich (jedno naraz). */
export function EntryList({ entries }: EntryListProps) {
  const messages = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const viewModel = useEntryListViewModel(entries)
  const { dialog } = viewModel
  const deleting = dialog?.kind === 'delete' ? dialog.entry : null
  const deletingTask = dialog?.kind === 'deleteTask' ? dialog.group : null
  return (
    <>
      <ul className="divide-y divide-line">
        {viewModel.tasks.map((task) => (
          <TaskCard key={task.key} task={task} viewModel={viewModel} />
        ))}
      </ul>

      {dialog?.kind === 'edit' && (
        <EditEntryDialog
          entry={dialog.entry}
          focusNotes={dialog.notes}
          onClose={viewModel.close}
        />
      )}
      {dialog?.kind === 'duplicate' && (
        <EditEntryDialog
          entry={dialog.entry}
          duplicate
          onClose={viewModel.close}
        />
      )}
      {dialog?.kind === 'extend' && (
        <ExtendDialog entry={dialog.entry} onClose={viewModel.close} />
      )}
      {dialog?.kind === 'summary' && (
        <SummaryDialog
          entry={dialog.entry}
          type={viewModel.typeOf(dialog.entry.taskTypeId)}
          onClose={viewModel.close}
        />
      )}
      <DeleteTaskDialog
        task={deletingTask?.latest ?? null}
        date={deletingTask?.latest.workDate ?? null}
        sessions={deletingTask?.sessions.length ?? 0}
        minutes={deletingTask?.doneMinutes ?? 0}
        onClose={viewModel.close}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && viewModel.close()}
        title={fmt(messages.list.deleteTitle, { name: deleting?.title ?? '' })}
        description={messages.list.deleteText}
        confirmLabel={app.actions.delete}
        cancelLabel={app.actions.cancel}
        destructive
        busy={viewModel.removing}
        onConfirm={() => deleting && viewModel.removeEntry(deleting)}
      />
    </>
  )
}
