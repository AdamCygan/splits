import { Switch, Textarea } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import {
  ENTRY_LIMITS,
  parseDuration,
} from '#/features/time-entries/domain/entries'
import { fmt } from '#/i18n/format'
import { FieldError, FieldLabel, chipClass, fieldA11y } from './fields'
import type { EntryFormViewModel } from '../../controllers/use-entry-form'

export interface OvertimeSectionProps {
  viewModel: EntryFormViewModel
}

/** Nadgodziny: ile z czasu wpisu było po godzinach i co wtedy zostało zrobione. */
export function OvertimeSection({ viewModel }: OvertimeSectionProps) {
  const { messages, format, draft, minutes, overtimeMinutes } = viewModel
  const timer = draft.mode === 'timer'
  const open = draft.overtime && !timer
  const hintId = `${viewModel.fieldId('overtime')}-hint`
  return (
    <div className="rounded-xl border border-line p-4 sm:col-span-2">
      <Switch
        label={messages.form.overtime.label}
        description={
          timer ? messages.form.overtime.timerHint : messages.form.overtime.hint
        }
        checked={open}
        disabled={timer}
        onCheckedChange={(overtime) => viewModel.update({ overtime })}
      />
      {open && (
        <div className="overtime-in mt-4 grid grid-cols-1 gap-4">
          <div>
            <FieldLabel htmlFor={viewModel.fieldId('overtime')}>
              {messages.form.overtime.time}
            </FieldLabel>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                {...fieldA11y(viewModel, 'overtime', true)}
                inputMode="text"
                autoComplete="off"
                className="w-36"
                placeholder={minutes ? format.minutes(minutes) : '1h 30m'}
                value={draft.overtimeDuration}
                onChange={(event) =>
                  viewModel.update({ overtimeDuration: event.target.value })
                }
              />
              {minutes ? (
                <button
                  type="button"
                  aria-pressed={
                    !draft.overtimeDuration.trim() ||
                    parseDuration(draft.overtimeDuration) === minutes
                  }
                  onClick={() =>
                    viewModel.update({ overtimeDuration: String(minutes) })
                  }
                  className={chipClass}
                >
                  {fmt(messages.form.overtime.whole, {
                    time: format.minutes(minutes),
                  })}
                </button>
              ) : null}
            </div>
            <p
              id={hintId}
              className="mt-1.5 text-sm text-ink-soft"
              aria-live="polite"
            >
              {overtimeMinutes && overtimeMinutes > 0 && minutes ? (
                <span className="font-medium text-ink">
                  {fmt(messages.form.overtime.share, {
                    overtime: format.minutes(overtimeMinutes),
                    total: format.minutes(minutes),
                  })}{' '}
                </span>
              ) : null}
              {messages.form.overtime.timeHint}
            </p>
            <FieldError viewModel={viewModel} field="overtime" />
          </div>
          <div>
            <FieldLabel
              htmlFor={viewModel.fieldId('overtimeNote')}
              note={messages.form.required}
            >
              {messages.form.overtime.note}
            </FieldLabel>
            <Textarea
              {...fieldA11y(viewModel, 'overtimeNote')}
              rows={3}
              maxLength={ENTRY_LIMITS.overtimeNote}
              placeholder={messages.form.overtime.notePlaceholder}
              className="mt-2 resize-y leading-relaxed"
              value={draft.overtimeNote}
              onChange={(event) =>
                viewModel.update({ overtimeNote: event.target.value })
              }
            />
            <FieldError viewModel={viewModel} field="overtimeNote" />
          </div>
        </div>
      )}
    </div>
  )
}
