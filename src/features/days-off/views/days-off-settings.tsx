import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/dialog'
import { useRemoveDaysOff } from '../controllers/use-days-off'
import { DAY_OFF_KINDS } from '#/features/days-off/data/dto'
import { todayIn } from '#/shared/domain/dates'
import { groupDaysOff } from '#/features/days-off/domain/days-off'
import type { DayOffRange } from '#/features/days-off/domain/days-off'
import { SectionHeader, SettingsCard } from '#/features/settings/views/ui'
import { daysOffQuery } from '#/features/days-off/data/queries'
import { settingsQuery } from '#/features/settings/data/queries'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate, formatDateRange } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { daysOffMessages } from '#/i18n/messages/days-off'
import { DAY_OFF_COLORS, DAY_OFF_ICONS, DayOffDialog } from './day-off-dialog'
import type { DayOffDraft } from './day-off-dialog'

/** Ustawienia → Dni wolne: urlopy, L4 i święta z poprzedniego, bieżącego i następnego roku. */
export function DaysOffSettings() {
  const messages = useMessages(daysOffMessages)
  const app = useMessages(appMessages)
  const format = useFormat()
  const { locale } = useI18n()
  const settings = useQuery(settingsQuery).data
  const today = todayIn(settings?.timezone)
  const year = Number(today.slice(0, 4))
  const days = useQuery(daysOffQuery(`${year - 1}-01-01`, `${year + 1}-12-31`))
  const ranges = groupDaysOff(
    days.data ?? [],
    settings?.workingDays ?? [1, 2, 3, 4, 5],
  )
  const upcoming = ranges.filter((dayOffRange) => dayOffRange.to >= today)
  const past = ranges.filter((dayOffRange) => dayOffRange.to < today).reverse()
  const [dialog, setDialog] = useState<{
    initial: DayOffDraft
    replacing?: DayOffRange
  } | null>(null)
  const [removing, setRemoving] = useState<DayOffRange | null>(null)

  const thisYear = (days.data ?? []).filter((dayOff) =>
    dayOff.date.startsWith(String(year)),
  )
  const summary = DAY_OFF_KINDS.map((dayOffKind) => ({
    kind: dayOffKind,
    count: thisYear.filter((dayOff) => dayOff.kind === dayOffKind).length,
  }))
    .filter((dayOffKind) => dayOffKind.count > 0)
    .map(
      (dayOffKind) =>
        `${messages.kinds[dayOffKind.kind]}: ${format.plural(messages.settings.days, dayOffKind.count)}`,
    )
    .join(', ')

  const remove = useRemoveDaysOff({
    success: messages.settings.removed,
    onRemoved: () => setRemoving(null),
  })

  const dates = (dayOffRange: DayOffRange) =>
    dayOffRange.from === dayOffRange.to
      ? formatDate(locale, dayOffRange.from, {
          weekday: 'short',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : formatDateRange(locale, dayOffRange.from, dayOffRange.to)

  const list = (items: Array<DayOffRange>) => (
    <ul className="divide-y divide-line">
      {items.map((dayOffRange) => {
        const Icon = DAY_OFF_ICONS[dayOffRange.kind]
        return (
          <li
            key={`${dayOffRange.from}-${dayOffRange.to}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
          >
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-lg text-white"
              style={{ background: DAY_OFF_COLORS[dayOffRange.kind] }}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {messages.kinds[dayOffRange.kind]}
                {dayOffRange.note && (
                  <span className="font-normal text-ink-soft">
                    : {dayOffRange.note}
                  </span>
                )}
              </p>
              <p className="text-sm text-ink-soft">
                {dates(dayOffRange)},{' '}
                {format.plural(messages.settings.days, dayOffRange.days)}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${messages.banner.change}: ${messages.kinds[dayOffRange.kind]}, ${dates(dayOffRange)}`}
                onClick={() =>
                  setDialog({
                    initial: {
                      from: dayOffRange.from,
                      to: dayOffRange.to,
                      kind: dayOffRange.kind,
                      note: dayOffRange.note,
                    },
                    replacing: dayOffRange,
                  })
                }
              >
                {messages.banner.change}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={fmt(messages.settings.removeLabel, {
                  kind: messages.kinds[dayOffRange.kind],
                  dates: dates(dayOffRange),
                })}
                onClick={() => setRemoving(dayOffRange)}
              >
                {messages.settings.remove}
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div>
      <SectionHeader
        title={messages.settings.title}
        lead={messages.settings.lead}
      />
      <SettingsCard
        title={messages.settings.upcoming}
        lead={
          summary ? fmt(messages.settings.thisYear, { summary }) : undefined
        }
        actions={
          <Button
            onClick={() =>
              setDialog({
                initial: {
                  from: today,
                  to: today,
                  kind: 'vacation',
                  note: null,
                },
              })
            }
          >
            <Plus aria-hidden />
            {messages.settings.add}
          </Button>
        }
      >
        {days.isPending ? (
          <div aria-hidden className="h-24 animate-pulse rounded-lg bg-muted" />
        ) : ranges.length === 0 ? (
          <p className="text-ink-soft">{messages.settings.empty}</p>
        ) : upcoming.length === 0 ? (
          <p className="text-ink-soft">{messages.settings.emptyUpcoming}</p>
        ) : (
          list(upcoming)
        )}
      </SettingsCard>

      {past.length > 0 && (
        <SettingsCard title={messages.settings.past} className="mt-6">
          {list(past)}
        </SettingsCard>
      )}

      {dialog && (
        <DayOffDialog
          initial={dialog.initial}
          replacing={dialog.replacing}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={
          removing
            ? fmt(messages.settings.removeLabel, {
                kind: messages.kinds[removing.kind],
                dates: dates(removing),
              })
            : ''
        }
        description={messages.settings.removeText}
        confirmLabel={messages.settings.remove}
        cancelLabel={app.actions.cancel}
        destructive
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  )
}
