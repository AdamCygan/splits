import { useEffect, useMemo, useState } from 'react'
import { hourOptions } from '#/lib/clock'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckboxGroup, Field, Select, Switch } from '#/components/ui/controls'
import { TimeInput } from '#/components/ui/time-input'
import { Input } from '#/components/ui/input'
import { data } from '#/data'
import type { RoundingMinutes, UserSettings } from '#/data/types'
import { ROUNDING_OPTIONS, TIME_RE } from '#/domain/rules'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt, weekdayNames } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { keys, settingsQuery, useDataMutation } from '../queries'
import { markSetupStep } from '../setup-progress'
import {
  QueryView,
  SaveBar,
  SectionHeader,
  SettingsCard,
  useUnsavedWarning,
} from './ui'

/** Lista stref IANA z przeglądarki; na starszych silnikach przynajmniej bieżąca i UTC. */
function timeZones(current: string) {
  // Starsze przeglądarki (Safari < 15.4) nie mają supportedValuesOf.
  const intl = Intl as unknown as {
    supportedValuesOf?: (key: string) => Array<string>
  }
  const list = intl.supportedValuesOf?.('timeZone') ?? []
  return [...new Set(['UTC', current, ...list])].sort()
}

/** Dzienny limit przerw do wyboru (minuty); 0 = bez limitu. */
const BREAK_OPTIONS = [0, 10, 15, 20, 30, 45, 60, 90, 120]

export function WorkdaySettings() {
  const t = useMessages(settingsMessages)
  return (
    <div>
      <SectionHeader title={t.workday.title} lead={t.workday.lead} />
      <QueryView query={settingsQuery} skeletonRows={6}>
        {(settings) => <WorkdayForm settings={settings} />}
      </QueryView>
    </div>
  )
}

type Draft = UserSettings & {
  targetHours: string
  reminderOn: boolean
  reminderTime: string
}

const toDraft = (s: UserSettings): Draft => ({
  ...s,
  targetHours: String(s.workdayTargetMinutes / 60),
  reminderOn: s.dailyReminderAt !== null,
  reminderTime: s.dailyReminderAt ?? '17:00',
})

function WorkdayForm({ settings }: { settings: UserSettings }) {
  const t = useMessages(settingsMessages).workday
  const app = useMessages(appMessages)
  const { locale, tag } = useI18n()
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings))
  const [submitted, setSubmitted] = useState(false)
  useEffect(() => setDraft(toDraft(settings)), [settings])

  const save = useDataMutation(data.settings.update, {
    invalidate: [keys.settings, keys.sprints],
    success: app.status.saved,
    onSuccess: () => markSetupStep('workday'),
  })

  const hours = Number(draft.targetHours.replace(',', '.'))
  const errors = {
    target:
      Number.isFinite(hours) &&
      hours >= 0 &&
      hours <= 24 &&
      draft.targetHours.trim() !== ''
        ? null
        : t.targetError,
    days: draft.workingDays.length > 0 ? null : t.workingDaysError,
    reminder:
      !draft.reminderOn || TIME_RE.test(draft.reminderTime)
        ? null
        : t.reminderError,
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
  const dirty =
    JSON.stringify(next) !==
    JSON.stringify({
      ...settings,
      workingDays: [...settings.workingDays].sort(),
    })
  useUnsavedWarning(dirty)

  const days = weekdayNames(locale, 'long')
  const shortDays = weekdayNames(locale, 'short')
  const orderedDays = Array.from(
    { length: 7 },
    (_, i) => (draft.weekStartsOn + i) % 7,
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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!valid) return
    save.mutate(next)
  }

  const show = (error: string | null) => (submitted ? error : null)

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      <SettingsCard title={t.cards.time}>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label={t.target}
            hint={t.targetHint}
            error={show(errors.target)}
          >
            {(a) => (
              <div className="flex items-center gap-2">
                <Input
                  {...a}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={24}
                  step={0.5}
                  className="max-w-32"
                  value={draft.targetHours}
                  onChange={(e) =>
                    setDraft({ ...draft, targetHours: e.target.value })
                  }
                />
                <span className="text-ink-soft">{t.hoursUnit}</span>
              </div>
            )}
          </Field>
          <Field label={t.rounding} hint={t.roundingHint}>
            {(a) => (
              <Select
                {...a}
                value={draft.timeRoundingMinutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    timeRoundingMinutes: Number(
                      e.target.value,
                    ) as RoundingMinutes,
                  })
                }
              >
                {ROUNDING_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? t.roundingOff : fmt(t.roundingValue, { n })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.breakLabel} hint={t.breakHint}>
            {(a) => (
              <Select
                {...a}
                value={draft.breakMinutes}
                onChange={(e) =>
                  setDraft({ ...draft, breakMinutes: Number(e.target.value) })
                }
              >
                {[...new Set([...BREAK_OPTIONS, draft.breakMinutes])]
                  .sort((x, y) => x - y)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? t.breakOff : fmt(t.roundingValue, { n })}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title={t.cards.calendar}>
        <div className="space-y-6">
          <CheckboxGroup
            legend={t.workingDays}
            hint={t.workingDaysHint}
            error={show(errors.days)}
            value={draft.workingDays}
            onChange={(value) => setDraft({ ...draft, workingDays: value })}
            options={orderedDays.map((d) => ({
              value: d,
              label: shortDays[d]!,
            }))}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t.weekStart}>
              {(a) => (
                <Select
                  {...a}
                  value={draft.weekStartsOn}
                  onChange={(e) =>
                    setDraft({ ...draft, weekStartsOn: Number(e.target.value) })
                  }
                >
                  {[1, 0, 6, 2, 3, 4, 5].map((d) => (
                    <option key={d} value={d}>
                      {days[d]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={t.timezone}
              hint={fmt(t.timezoneHint, { time: localTime })}
            >
              {(a) => (
                <Select
                  {...a}
                  value={draft.timezone}
                  onChange={(e) =>
                    setDraft({ ...draft, timezone: e.target.value })
                  }
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z.replaceAll('_', ' ')}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title={t.cards.reminders}>
        <div className="space-y-5">
          <Switch
            label={t.reminder}
            description={t.reminderHint}
            checked={draft.reminderOn}
            onCheckedChange={(v) => setDraft({ ...draft, reminderOn: v })}
          />
          {draft.reminderOn && (
            <Field label={t.reminderTime} error={show(errors.reminder)}>
              {(a) => (
                <TimeInput
                  {...a}
                  className="max-w-40"
                  value={draft.reminderTime}
                  onChange={(v) => setDraft({ ...draft, reminderTime: v })}
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

/** Hook pomocniczy do innych sekcji: bieżące ustawienia (np. dni robocze dla sprintów). */
export function useSettings() {
  return useQuery(settingsQuery).data
}
