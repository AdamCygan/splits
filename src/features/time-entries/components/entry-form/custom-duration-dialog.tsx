import { useId, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import type { TaskType } from '#/data/types'
import { ENTRY_LIMITS, parseDuration } from '#/domain/entries'
import { useFormat, useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { cn } from '#/lib/utils'

export interface CustomDurationDialogProps {
  type: TaskType
  onClose: () => void
  onApply: (minutes: number) => void
}

/** Własny czas z menu kontekstowego typu: jedno pole, te same formaty co w formularzu. */
export function CustomDurationDialog({
  type,
  onClose,
  onApply,
}: CustomDurationDialogProps) {
  const t = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const format = useFormat()
  const id = useId()
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const minutes = parseDuration(value)
  const valid =
    minutes !== null && minutes >= 1 && minutes <= ENTRY_LIMITS.maxMinutes
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="sm"
        title={`${t.form.custom.title}: ${type.name}`}
        description={t.form.custom.description}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button type="submit" form={`${id}-form`}>
              {t.form.custom.apply}
            </Button>
          </>
        }
      >
        <form
          id={`${id}-form`}
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setSubmitted(true)
            if (valid) onApply(minutes)
          }}
        >
          <label htmlFor={`${id}-input`} className="block text-sm font-medium">
            {t.form.custom.label}
          </label>
          <Input
            id={`${id}-input`}
            autoFocus
            autoComplete="off"
            className="mt-2"
            placeholder="1h 20m"
            aria-invalid={submitted && !valid ? true : undefined}
            aria-describedby={`${id}-status`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p
            id={`${id}-status`}
            aria-live="polite"
            className={cn(
              'mt-1.5 text-sm',
              submitted && !valid ? 'text-destructive' : 'text-ink-soft',
            )}
          >
            {submitted && !valid
              ? t.form.custom.error
              : valid
                ? `= ${format.minutes(minutes)}`
                : ''}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
