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
  vm: EntryFormViewModel
}

/** Nadgodziny: ile z czasu wpisu było po godzinach i co wtedy zostało zrobione. */
export function OvertimeSection({ vm }: OvertimeSectionProps) {
  const { t, format, draft, minutes, overtimeMinutes } = vm
  const timer = draft.mode === 'timer'
  const open = draft.overtime && !timer
  const hintId = `${vm.fieldId('overtime')}-hint`
  return (
    <div className="rounded-xl border border-line p-4 sm:col-span-2">
      <Switch
        label={t.form.overtime.label}
        description={timer ? t.form.overtime.timerHint : t.form.overtime.hint}
        checked={open}
        disabled={timer}
        onCheckedChange={(overtime) => vm.update({ overtime })}
      />
      {open && (
        <div className="overtime-in mt-4 grid grid-cols-1 gap-4">
          <div>
            <FieldLabel htmlFor={vm.fieldId('overtime')}>
              {t.form.overtime.time}
            </FieldLabel>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                {...fieldA11y(vm, 'overtime', true)}
                inputMode="text"
                autoComplete="off"
                className="w-36"
                placeholder={minutes ? format.minutes(minutes) : '1h 30m'}
                value={draft.overtimeDuration}
                onChange={(e) =>
                  vm.update({ overtimeDuration: e.target.value })
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
                    vm.update({ overtimeDuration: String(minutes) })
                  }
                  className={chipClass}
                >
                  {fmt(t.form.overtime.whole, {
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
                  {fmt(t.form.overtime.share, {
                    overtime: format.minutes(overtimeMinutes),
                    total: format.minutes(minutes),
                  })}{' '}
                </span>
              ) : null}
              {t.form.overtime.timeHint}
            </p>
            <FieldError vm={vm} field="overtime" />
          </div>
          <div>
            <FieldLabel
              htmlFor={vm.fieldId('overtimeNote')}
              note={t.form.required}
            >
              {t.form.overtime.note}
            </FieldLabel>
            <Textarea
              {...fieldA11y(vm, 'overtimeNote')}
              rows={3}
              maxLength={ENTRY_LIMITS.overtimeNote}
              placeholder={t.form.overtime.notePlaceholder}
              className="mt-2 resize-y leading-relaxed"
              value={draft.overtimeNote}
              onChange={(e) => vm.update({ overtimeNote: e.target.value })}
            />
            <FieldError vm={vm} field="overtimeNote" />
          </div>
        </div>
      )}
    </div>
  )
}
