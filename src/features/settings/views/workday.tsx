import { useSaveWorkday } from '../controllers/use-save-settings'
import { settingsQuery } from '../data/queries'
import { BREAK_OPTIONS, timeZones, toDraft } from '../domain/workday-draft'
import type { Draft } from '../domain/workday-draft'
import { QueryView, SaveBar, SectionHeader, SettingsCard } from './ui'
import { CheckboxGroup, Field, Select, Switch } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { TimeInput } from '#/components/ui/time-input'
import { useFreePlan } from '#/features/billing/controllers/use-free-plan'
import { PlanLimit } from '#/features/billing/views/plan-limit'
import type {
  RoundingMinutes,
  UserSettings,
} from '#/features/settings/data/dto'
import { ROUNDING_OPTIONS, TIME_RE } from '#/features/task-types/domain/rules'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt, weekdayNames } from '#/i18n/format'
import { billingMessages } from '#/i18n/messages/billing'
import { settingsMessages } from '#/i18n/messages/settings'
import { hourOptions } from '#/lib/clock'
import { useUnsavedWarning } from '#/shared/controllers/use-unsaved-warning'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

export function WorkdaySettings() {
  const messages = useMessages(settingsMessages)
  return (
    <div>
      <SectionHeader
        title={messages.workday.title}
        lead={messages.workday.lead}
      />
      <QueryView query={settingsQuery} skeletonRows={6}>
        {(settings) => <WorkdayForm settings={settings} />}
      </QueryView>
    </div>
  )
}

interface WorkdayFormProps {
  settings: UserSettings
}

function WorkdayForm({ settings }: WorkdayFormProps) {
  const messages = useMessages(settingsMessages).workday
  const limits = useMessages(billingMessages).limits
  const isFree = useFreePlan()
  const { locale, tag } = useI18n()
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings))
  const [submitted, setSubmitted] = useState(false)
  useEffect(() => setDraft(toDraft(settings)), [settings])

  const save = useSaveWorkday()

  const hours = Number(draft.targetHours.replace(',', '.'))
  const errors = {
    target:
      Number.isFinite(hours) &&
      hours >= 0 &&
      hours <= 24 &&
      draft.targetHours.trim() !== ''
        ? null
        : messages.targetError,
    days: draft.workingDays.length > 0 ? null : messages.workingDaysError,
    reminder:
      !draft.reminderOn || TIME_RE.test(draft.reminderTime)
        ? null
        : messages.reminderError,
  }
  const valid = !errors.target && !errors.days && !errors.reminder

  const next: UserSettings = {
    workdayTargetMinutes: Math.round(hours * 60),
    workingDays: [...draft.workingDays].sort(),
    weekStartsOn: draft.weekStartsOn,
    timeRoundingMinutes: draft.timeRoundingMinutes,
    timezone: draft.timezone,
    locale: settings.locale,
    dailyReminderAt: draft.reminderOn ? draft.reminderTime : null,
    summaryTemplate: settings.summaryTemplate,
    breakMinutes: draft.breakMinutes,
  }
  // Porównanie pole po polu: kolejność kluczy w obiekcie z serwera nie może udawać zmian.
  const saved: UserSettings = {
    ...settings,
    workingDays: [...settings.workingDays].sort(),
  }
  const dirty = (Object.keys(next) as Array<keyof UserSettings>).some(
    (part) => JSON.stringify(next[part]) !== JSON.stringify(saved[part]),
  )
  useUnsavedWarning(dirty)

  const days = weekdayNames(locale, 'long')
  const shortDays = weekdayNames(locale, 'short')
  const orderedDays = Array.from(
    { length: 7 },
    (_unused, index) => (draft.weekStartsOn + index) % 7,
  )
  const zones = useMemo(() => timeZones(settings.timezone), [settings.timezone])
  const localTime = useMemo(() => {
    try {
      return new Date().toLocaleTimeString(tag, {
        timeZone: draft.timezone,
        ...hourOptions(tag),
      })
    } catch {
      return '—'
    }
  }, [draft.timezone, tag])

  const onSubmit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    setSubmitted(true)
    if (!valid) return
    save.mutate(next)
  }

  const show = (error: string | null) => (submitted ? error : null)

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      <SettingsCard title={messages.cards.time}>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label={messages.target}
            hint={messages.targetHint}
            error={show(errors.target)}
          >
            {(fieldProps) => (
              <div className="flex items-center gap-2">
                <Input
                  {...fieldProps}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={24}
                  step={0.5}
                  className="max-w-32"
                  value={draft.targetHours}
                  onChange={(event) =>
                    setDraft({ ...draft, targetHours: event.target.value })
                  }
                />
                <span className="text-ink-soft">{messages.hoursUnit}</span>
              </div>
            )}
          </Field>
          <Field label={messages.rounding} hint={messages.roundingHint}>
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={draft.timeRoundingMinutes}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    timeRoundingMinutes: Number(
                      event.target.value,
                    ) as RoundingMinutes,
                  })
                }
              >
                {ROUNDING_OPTIONS.map((roundingOption) => (
                  <option key={roundingOption} value={roundingOption}>
                    {roundingOption === 0
                      ? messages.roundingOff
                      : fmt(messages.roundingValue, { n: roundingOption })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={messages.breakLabel} hint={messages.breakHint}>
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={draft.breakMinutes}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    breakMinutes: Number(event.target.value),
                  })
                }
              >
                {[...new Set([...BREAK_OPTIONS, draft.breakMinutes])]
                  .sort((left, right) => left - right)
                  .map((count) => (
                    <option key={count} value={count}>
                      {count === 0
                        ? messages.breakOff
                        : fmt(messages.roundingValue, { n: count })}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title={messages.cards.calendar}>
        <div className="space-y-6">
          <CheckboxGroup
            legend={messages.workingDays}
            hint={messages.workingDaysHint}
            error={show(errors.days)}
            value={draft.workingDays}
            onChange={(value) => setDraft({ ...draft, workingDays: value })}
            options={orderedDays.map((orderedDay) => ({
              value: orderedDay,
              label: shortDays[orderedDay]!,
            }))}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={messages.weekStart}>
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={draft.weekStartsOn}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      weekStartsOn: Number(event.target.value),
                    })
                  }
                >
                  {[1, 0, 6, 2, 3, 4, 5].map((day) => (
                    <option key={day} value={day}>
                      {days[day]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={messages.timezone}
              hint={fmt(messages.timezoneHint, { time: localTime })}
            >
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={draft.timezone}
                  onChange={(event) =>
                    setDraft({ ...draft, timezone: event.target.value })
                  }
                >
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replaceAll('_', ' ')}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title={messages.cards.reminders}>
        {/* Przypomnienia są w Pro; Free może tylko wyłączyć przypomnienie ustawione wcześniej. */}
        {isFree && (
          <PlanLimit id="reminder-limit">{limits.reminders}</PlanLimit>
        )}
        <div className="space-y-5">
          <Switch
            label={messages.reminder}
            description={messages.reminderHint}
            checked={draft.reminderOn}
            disabled={isFree && !draft.reminderOn}
            onCheckedChange={(isChecked) =>
              setDraft({ ...draft, reminderOn: isChecked })
            }
          />
          {draft.reminderOn && (
            <Field label={messages.reminderTime} error={show(errors.reminder)}>
              {(fieldProps) => (
                <TimeInput
                  {...fieldProps}
                  className="max-w-40"
                  value={draft.reminderTime}
                  onChange={(value) =>
                    setDraft({ ...draft, reminderTime: value })
                  }
                />
              )}
            </Field>
          )}
        </div>
      </SettingsCard>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        onDiscard={() => {
          setDraft(toDraft(settings))
          setSubmitted(false)
        }}
      />
    </form>
  )
}
