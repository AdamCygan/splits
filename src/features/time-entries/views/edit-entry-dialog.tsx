import { Button } from '#/components/ui/button'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { EntryForm } from './entry-form'

export interface EditEntryDialogProps {
  entry: TimeEntry
  focusNotes?: boolean
  duplicate?: boolean
  onClose: () => void
}

/**
 * Edycja wpisu w oknie: z listy dnia i z paska działającego timera (wtedy wpis dalej
 * trwa — zmienia się tytuł, typ, link, SP czy notatka, a licznik biegnie dalej).
 * `duplicate`: ten sam formularz z danymi wpisu, ale zapis tworzy nowy wpis.
 */
export function EditEntryDialog({
  entry,
  focusNotes = false,
  duplicate = false,
  onClose,
}: EditEntryDialogProps) {
  const messages = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="lg"
        title={
          duplicate ? messages.form.duplicateTitle : messages.form.editTitle
        }
        description={duplicate ? messages.form.duplicateLead : entry.title}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button type="submit" form="edit-entry-form">
              {duplicate ? messages.form.duplicateSave : app.actions.save}
            </Button>
          </>
        }
      >
        <EntryForm
          formId="edit-entry-form"
          hideSubmit
          workDate={entry.workDate}
          entry={duplicate ? null : entry}
          copyOf={duplicate ? entry : null}
          focusNotes={focusNotes}
          onSaved={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
