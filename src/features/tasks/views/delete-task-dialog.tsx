import { ConfirmDialog } from '#/components/ui/dialog'
import type { TaskRef } from '#/features/time-entries/data/dto'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { useDeleteTask } from '../controllers/use-delete-task'

export interface DeleteTaskDialogProps {
  task: TaskRef | null
  date: string | null
  sessions: number
  minutes: number
  onClose: () => void
  onDeleted?: () => void
}

/**
 * Ostrzeżenie przed usunięciem całego zadania: z jednego dnia (`date`) albo z całej historii.
 * Mówi, ile sesji i czasu zniknie, bo tego nie da się cofnąć.
 */
export function DeleteTaskDialog({
  task,
  date,
  sessions,
  minutes,
  onClose,
  onDeleted,
}: DeleteTaskDialogProps) {
  const t = useMessages(entriesMessages).deleteTask
  const app = useMessages(appMessages)
  const format = useFormat()
  const remove = useDeleteTask({
    date,
    title: task?.title ?? '',
    onDeleted: () => {
      onClose()
      onDeleted?.()
    },
  })
  return (
    <ConfirmDialog
      open={task !== null}
      onOpenChange={(open) => !open && onClose()}
      title={fmt(date ? t.titleDay : t.titleAll, { name: task?.title ?? '' })}
      description={format
        .plural(date ? t.textDay : t.textAll, sessions)
        .replace('{time}', format.minutes(minutes))}
      confirmLabel={t.confirm}
      cancelLabel={app.actions.cancel}
      destructive
      busy={remove.isPending}
      onConfirm={() => task && remove.mutate(task)}
    />
  )
}
