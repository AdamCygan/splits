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
  const t = useMessages(entriesMessages)
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
    ? t.issues.extension.required
    : minutes === null || minutes < 1 || minutes > max
      ? t.issues.extension.invalid
      : null
  const reasonError = !reason.trim()
    ? t.issues.extensionNote.required
    : reason.length > ENTRY_LIMITS.extensionNote
      ? t.issues.extensionNote.too_long
      : null

  const save = useSaveExtension({ entryId: entry.id, onSaved: onClose })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (amountError || reasonError || minutes === null) return
    save.mutate(withExtension(entry, minutes, reason.trim()))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="sm"
        title={fmt(t.extension.title, { name: entry.title })}
        description={fmt(t.extension.lead, {
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
                {t.extension.remove}
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
              {save.isPending ? t.form.saving : t.extension.save}
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
            label={t.extension.amount}
            hint={
              minutes && !amountError
                ? `${fmt(t.extension.total, {
                    time: format.minutes(planned + minutes),
                  })} ${t.extension.amountHint}`
                : t.extension.amountHint
            }
            error={submitted ? amountError : null}
          >
            {(a) => (
              <div className="space-y-2">
                <Input
                  {...a}
                  autoFocus
                  inputMode="text"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK.map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant={minutes === m ? 'default' : 'outline'}
                      size="sm"
                      aria-pressed={minutes === m}
                      onClick={() => setAmount(String(m))}
                    >
                      +{format.minutes(m)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Field>
          <Field
            label={t.extension.reason}
            error={submitted ? reasonError : null}
          >
            {(a) => (
              <Textarea
                {...a}
                rows={3}
                maxLength={ENTRY_LIMITS.extensionNote}
                placeholder={t.extension.reasonPlaceholder}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  )
}
