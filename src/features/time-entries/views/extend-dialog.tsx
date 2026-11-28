import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '#/components/ui/button'
import { Field, Textarea } from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import {
  ENTRY_LIMITS,
  parseDuration,
  withExtension,
} from '#/features/time-entries/domain/entries'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { useSaveExtension } from '../controllers/use-task-editing'

const QUICK = [15, 30, 45, 60]

export interface ExtendDialogProps {
  entry: TimeEntry
  onClose: () => void
}

/** „Przedłużyło się”: spotkanie trwało dłużej niż plan; dopisujemy ile i dlaczego. */
export function ExtendDialog({ entry, onClose }: ExtendDialogProps) {
  const messages = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const format = useFormat()
  const planned = entry.durationMinutes - (entry.extensionMinutes ?? 0)
  const [amount, setAmount] = useState(
    entry.extensionMinutes === null ? '' : String(entry.extensionMinutes),
  )
  const [reason, setReason] = useState(entry.extensionNote ?? '')
  const [submitted, setSubmitted] = useState(false)

  const minutes = parseDuration(amount)
  const max = ENTRY_LIMITS.maxMinutes - planned
  const amountError = !amount.trim()
    ? messages.issues.extension.required
    : minutes === null || minutes < 1 || minutes > max
      ? messages.issues.extension.invalid
      : null
  const reasonError = !reason.trim()
    ? messages.issues.extensionNote.required
    : reason.length > ENTRY_LIMITS.extensionNote
      ? messages.issues.extensionNote.too_long
      : null

  const save = useSaveExtension({ entryId: entry.id, onSaved: onClose })

  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    setSubmitted(true)
    if (amountError || reasonError || minutes === null) return
    save.mutate(withExtension(entry, minutes, reason.trim()))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="sm"
        title={fmt(messages.extension.title, { name: entry.title })}
        description={fmt(messages.extension.lead, {
          planned: format.minutes(planned),
        })}
        closeLabel={app.actions.close}
        footer={
          <>
            {entry.extensionMinutes !== null && (
              <Button
                variant="ghost"
                className="mr-auto"
                disabled={save.isPending}
                onClick={() => save.mutate(withExtension(entry, null, null))}
              >
                {messages.extension.remove}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="extend-form"
              disabled={save.isPending}
              aria-busy={save.isPending}
            >
              {save.isPending ? messages.form.saving : messages.extension.save}
            </Button>
          </>
        }
      >
        <form
          id="extend-form"
          noValidate
          onSubmit={submit}
          className="space-y-5"
        >
          <Field
            label={messages.extension.amount}
            hint={
              minutes && !amountError
                ? `${fmt(messages.extension.total, {
                    time: format.minutes(planned + minutes),
                  })} ${messages.extension.amountHint}`
                : messages.extension.amountHint
            }
            error={submitted ? amountError : null}
          >
            {(fieldProps) => (
              <div className="space-y-2">
                <Input
                  {...fieldProps}
                  autoFocus
                  inputMode="text"
                  autoComplete="off"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK.map((presetMinutes) => (
                    <Button
                      key={presetMinutes}
                      type="button"
                      variant={
                        minutes === presetMinutes ? 'default' : 'outline'
                      }
                      size="sm"
                      aria-pressed={minutes === presetMinutes}
                      onClick={() => setAmount(String(presetMinutes))}
                    >
                      +{format.minutes(presetMinutes)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Field>
          <Field
            label={messages.extension.reason}
            error={submitted ? reasonError : null}
          >
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                rows={3}
                maxLength={ENTRY_LIMITS.extensionNote}
                placeholder={messages.extension.reasonPlaceholder}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  )
}
