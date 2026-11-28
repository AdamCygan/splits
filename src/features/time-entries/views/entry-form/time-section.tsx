import { Clock } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Segmented } from '#/components/ui/segmented'
import { TimeInput } from '#/components/ui/time-input'
import { fmt } from '#/i18n/format'
import { FieldError, chipClass, fieldA11y } from './fields'
import { QUICK_DURATIONS } from '../../domain/entry-form'
import type { DraftMode } from '../../domain/entry-form'
import type { EntryFormViewModel } from '../../controllers/use-entry-form'

export interface TimeSectionProps {
  viewModel: EntryFormViewModel
}

/** Czas wpisu: timer od teraz, godziny od–do albo czas trwania z szybkimi wartościami. */
export function TimeSection({ viewModel }: TimeSectionProps) {
  const { messages, format, draft, minutes } = viewModel
  const timeId = viewModel.fieldId('time')
  return (
    <div className="sm:col-span-2">
      <Segmented<DraftMode>
        label={messages.form.time}
        size="sm"
        value={draft.mode}
        onChange={viewModel.setMode}
        options={viewModel.timeOptions}
      />
      <div className="mt-3">
        {draft.mode === 'timer' ? (
          <div>
            <label htmlFor={timeId} className="block text-sm text-ink-soft">
              {messages.form.startedAt}
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <TimeInput
                {...fieldA11y(viewModel, 'time', true)}
                className="w-40"
                value={draft.start}
                onChange={(start) => viewModel.update({ start })}
              />
              <Button
                type="button"
                variant="outline"
                onClick={viewModel.startNow}
              >
                <Clock aria-hidden className="size-4" />
                {messages.form.now}
              </Button>
            </div>
            <p id={`${timeId}-hint`} className="mt-1.5 text-sm text-ink-soft">
              {messages.form.timerHint}
            </p>
          </div>
        ) : draft.mode === 'range' ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor={timeId} className="block text-sm text-ink-soft">
                {messages.form.start}
              </label>
              <TimeInput
                {...fieldA11y(viewModel, 'time')}
                className="mt-1 w-40"
                value={draft.start}
                onChange={(start) => viewModel.update({ start })}
              />
            </div>
            <div>
              <label
                htmlFor={viewModel.fieldId('end')}
                className="block text-sm text-ink-soft"
              >
                {messages.form.end}
              </label>
              <TimeInput
                {...fieldA11y(viewModel, 'time')}
                id={viewModel.fieldId('end')}
                className="mt-1 w-40"
                value={draft.end}
                onChange={(end) => viewModel.update({ end })}
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
              {messages.form.duration}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                {...fieldA11y(viewModel, 'time', true)}
                inputMode="text"
                autoComplete="off"
                className="w-36"
                placeholder="1h 15m"
                value={draft.duration}
                onChange={(event) =>
                  viewModel.update({ duration: event.target.value })
                }
              />
              <div
                role="group"
                aria-label={messages.form.quick}
                className="flex flex-wrap gap-1.5"
              >
                {QUICK_DURATIONS.map((quickDuration) => (
                  <button
                    key={quickDuration}
                    type="button"
                    aria-pressed={minutes === quickDuration}
                    onClick={() =>
                      viewModel.update({ duration: String(quickDuration) })
                    }
                    className={chipClass}
                  >
                    {format.minutes(quickDuration)}
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
              {messages.form.durationHint}
            </p>
          </div>
        )}
        <FieldError viewModel={viewModel} field="time" />
        <FieldError viewModel={viewModel} field="extension" />
        {draft.extensionMinutes !== null &&
          !viewModel.issueText('extension') && (
            <p className="mt-1.5 text-sm text-ink-soft">
              {fmt(messages.extension.inForm, {
                time: format.minutes(draft.extensionMinutes),
                reason: draft.extensionNote ?? '',
              })}
            </p>
          )}
      </div>
    </div>
  )
}
