import { Clock } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Segmented } from '#/components/ui/segmented'
import { TimeInput } from '#/components/ui/time-input'
import { fmt } from '#/i18n/format'
import { FieldError, chipClass, fieldA11y } from './fields'
import { QUICK_DURATIONS } from './model'
import type { DraftMode } from './model'
import type { EntryFormViewModel } from './use-entry-form'

export interface TimeSectionProps {
  vm: EntryFormViewModel
}

/** Czas wpisu: timer od teraz, godziny od–do albo czas trwania z szybkimi wartościami. */
export function TimeSection({ vm }: TimeSectionProps) {
  const { t, format, draft, minutes } = vm
  const timeId = vm.fieldId('time')
  return (
    <div className="sm:col-span-2">
      <Segmented<DraftMode>
        label={t.form.time}
        size="sm"
        value={draft.mode}
        onChange={vm.setMode}
        options={vm.timeOptions}
      />
      <div className="mt-3">
        {draft.mode === 'timer' ? (
          <div>
            <label htmlFor={timeId} className="block text-sm text-ink-soft">
              {t.form.startedAt}
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <TimeInput
                {...fieldA11y(vm, 'time', true)}
                className="w-40"
                value={draft.start}
                onChange={(start) => vm.update({ start })}
              />
              <Button type="button" variant="outline" onClick={vm.startNow}>
                <Clock aria-hidden className="size-4" />
                {t.form.now}
              </Button>
            </div>
            <p id={`${timeId}-hint`} className="mt-1.5 text-sm text-ink-soft">
              {t.form.timerHint}
            </p>
          </div>
        ) : draft.mode === 'range' ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor={timeId} className="block text-sm text-ink-soft">
                {t.form.start}
              </label>
              <TimeInput
                {...fieldA11y(vm, 'time')}
                className="mt-1 w-40"
                value={draft.start}
                onChange={(start) => vm.update({ start })}
              />
            </div>
            <div>
              <label
                htmlFor={vm.fieldId('end')}
                className="block text-sm text-ink-soft"
              >
                {t.form.end}
              </label>
              <TimeInput
                {...fieldA11y(vm, 'time')}
                id={vm.fieldId('end')}
                className="mt-1 w-40"
                value={draft.end}
                onChange={(end) => vm.update({ end })}
              />
            </div>
            <p
              className="pb-3 text-sm font-medium tabular-nums"
              aria-live="polite"
            >
              {minutes ? format.minutes(minutes) : ''}
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor={timeId} className="sr-only">
              {t.form.duration}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                {...fieldA11y(vm, 'time', true)}
                inputMode="text"
                autoComplete="off"
                className="w-36"
                placeholder="1h 15m"
                value={draft.duration}
                onChange={(e) => vm.update({ duration: e.target.value })}
              />
              <div
                role="group"
                aria-label={t.form.quick}
                className="flex flex-wrap gap-1.5"
              >
                {QUICK_DURATIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={minutes === m}
                    onClick={() => vm.update({ duration: String(m) })}
                    className={chipClass}
                  >
                    {format.minutes(m)}
                  </button>
                ))}
              </div>
            </div>
            <p id={`${timeId}-hint`} className="mt-1.5 text-sm text-ink-soft">
              {minutes ? (
                <span className="font-medium text-ink">
                  = {format.minutes(minutes)}.{' '}
                </span>
              ) : null}
              {t.form.durationHint}
            </p>
          </div>
        )}
        <FieldError vm={vm} field="time" />
        <FieldError vm={vm} field="extension" />
        {draft.extensionMinutes !== null && !vm.issueText('extension') && (
          <p className="mt-1.5 text-sm text-ink-soft">
            {fmt(t.extension.inForm, {
              time: format.minutes(draft.extensionMinutes),
              reason: draft.extensionNote ?? '',
            })}
          </p>
        )}
      </div>
    </div>
  )
}
