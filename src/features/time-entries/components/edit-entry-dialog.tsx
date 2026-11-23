import { Button } from '#/components/ui/button'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import type { TimeEntry } from '#/data/types'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { EntryForm } from './entry-form'

/**
 * Edycja wpisu w oknie: z listy dnia i z paska działającego timera (wtedy wpis dalej
 * trwa — zmienia się tytuł, typ, link, SP czy notatka, a licznik biegnie dalej).
 */
export function EditEntryDialog({
  entry,
  focusNotes = false,
  onClose,
}: {
  entry: TimeEntry
  focusNotes?: boolean
  onClose: () => void
}) {
  const t = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="lg"
        title={t.form.editTitle}
        description={entry.title}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button type="submit" form="edit-entry-form">
              {app.actions.save}
            </Button>
          </>
        }
      >
        <EntryForm
          formId="edit-entry-form"
          hideSubmit
          workDate={entry.workDate}
          entry={entry}
          focusNotes={focusNotes}
          onSaved={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
