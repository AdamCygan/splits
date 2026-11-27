import type { scheduleErrors, ScheduleDraft } from '../domain/schedule-draft'
import { CheckboxGroup, Switch } from '#/components/ui/controls'
import { TimeInput } from '#/components/ui/time-input'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt, weekdayNames } from '#/i18n/format'
import { settingsMessages } from '#/i18n/messages/settings'
import { cn } from '#/lib/utils'
import { useId } from 'react'

export interface ScheduleFieldsProps {
  value: ScheduleDraft
  onChange: (next: ScheduleDraft) => void
  weekStartsOn: number
  errors: ReturnType<typeof scheduleErrors> | null
  durationMissing: string | null
}

/**
 * Powtarzanie szablonu (np. daily w poniedziałki o 10:00, w pozostałe dni o 9:30):
 * dni tygodnia od początku tygodnia z ustawień, ta sama godzina albo inna na każdy dzień.
 */
export function ScheduleFields({
  value,
  onChange,
  weekStartsOn,
  errors,
  durationMissing,
}: ScheduleFieldsProps) {
  const t = useMessages(settingsMessages).templates.schedule
  const { locale } = useI18n()
  const id = useId()
  const short = weekdayNames(locale, 'short')
  const long = weekdayNames(locale, 'long')
  const order = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7)
  const selected = order.filter((d) => value.days.includes(d))

  return (
    <fieldset className="space-y-4 rounded-xl border border-line px-4 py-4">
      <legend className="px-1 text-sm font-medium">{t.legend}</legend>
      <Switch
        label={t.enable}
        description={t.hint}
        checked={value.enabled}
        onCheckedChange={(enabled) => onChange({ ...value, enabled })}
      />
      {value.enabled && (
        <>
          {durationMissing && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {durationMissing}
            </p>
          )}
          <CheckboxGroup
            legend={t.days}
            error={errors?.days}
            value={value.days}
            onChange={(days) => onChange({ ...value, days })}
            options={order.map((d) => ({ value: d, label: short[d]! }))}
          />
          <div role="radiogroup" aria-labelledby={`${id}-mode`}>
            <p id={`${id}-mode`} className="sr-only">
              {t.legend}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['same', 'each'] as const).map((mode) => (
                <label
                  key={mode}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                    value.mode === mode
                      ? 'border-ink bg-surface shadow-sm'
                      : 'border-line hover:border-ink/40',
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-mode`}
                    checked={value.mode === mode}
                    onChange={() =>
                      onChange({
                        ...value,
                        mode,
                        // Przy przejściu na osobne godziny każdy dzień startuje od wspólnej.
                        times:
                          mode === 'each'
                            ? Object.fromEntries(
                                value.days.map((d) => [
                                  d,
                                  value.times[d] ?? value.time,
                                ]),
                              )
                            : value.times,
                      })
                    }
                    className="size-4 accent-ink"
                  />
                  {mode === 'same' ? t.same : t.each}
                </label>
              ))}
            </div>
          </div>
          {value.mode === 'same' ? (
            <TimeField
              id={`${id}-time`}
              label={t.time}
              value={value.time}
              error={errors?.time ?? null}
              onChange={(time) => onChange({ ...value, time })}
            />
          ) : (
            <ul className="grid gap-2.5">
              {selected.map((day) => (
                <li key={day}>
                  <TimeField
                    id={`${id}-time-${day}`}
                    label={long[day]!}
                    ariaLabel={fmt(t.dayTime, { day: long[day]! })}
                    value={value.times[day] ?? value.time}
                    error={errors?.dayTimes[day] ?? null}
                    onChange={(time) =>
                      onChange({
                        ...value,
                        times: { ...value.times, [day]: time },
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </fieldset>
  )
}

interface TimeFieldProps {
  id: string
  label: string
  ariaLabel?: string
  value: string
  error: string | null
  onChange: (value: string) => void
}

function TimeField({
  id,
  label,
  ariaLabel,
  value,
  error,
  onChange,
}: TimeFieldProps) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="min-w-24 text-sm font-medium">
        {label}
      </label>
      <TimeInput
        id={id}
        className="w-40 shrink-0"
        value={value}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={onChange}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
