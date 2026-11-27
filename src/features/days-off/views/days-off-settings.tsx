import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/dialog'
import { daysOffApi } from '../data/api'
import { DAY_OFF_KINDS } from '#/features/days-off/data/dto'
import { todayIn } from '#/shared/domain/dates'
import { groupDaysOff } from '#/features/days-off/domain/days-off'
import type { DayOffRange } from '#/features/days-off/domain/days-off'
import { SectionHeader, SettingsCard } from '#/features/settings/views/ui'
import { daysOffQuery } from '#/features/days-off/data/queries'
import { keys } from '#/shared/data/query-keys'
import { settingsQuery } from '#/features/settings/data/queries'
import { useDataMutation } from '#/shared/data/mutations'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate, formatDateRange } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { daysOffMessages } from '#/i18n/messages/days-off'
import { DAY_OFF_COLORS, DAY_OFF_ICONS, DayOffDialog } from './day-off-dialog'
import type { DayOffDraft } from './day-off-dialog'

/** Ustawienia → Dni wolne: urlopy, L4 i święta z poprzedniego, bieżącego i następnego roku. */
export function DaysOffSettings() {
  const t = useMessages(daysOffMessages)
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
  const upcoming = ranges.filter((r) => r.to >= today)
  const past = ranges.filter((r) => r.to < today).reverse()
  const [dialog, setDialog] = useState<{
    initial: DayOffDraft
    replacing?: DayOffRange
  } | null>(null)
  const [removing, setRemoving] = useState<DayOffRange | null>(null)

  const thisYear = (days.data ?? []).filter((d) =>
    d.date.startsWith(String(year)),
  )
  const summary = DAY_OFF_KINDS.map((k) => ({
    kind: k,
    count: thisYear.filter((d) => d.kind === k).length,
  }))
    .filter((x) => x.count > 0)
    .map(
      (x) => `${t.kinds[x.kind]}: ${format.plural(t.settings.days, x.count)}`,
    )
    .join(', ')

  const remove = useDataMutation(
    (range: DayOffRange) => daysOffApi.remove(range.from, range.to),
    {
      invalidate: [keys.daysOff],
      success: t.settings.removed,
      onSuccess: () => setRemoving(null),
    },
  )

  const dates = (r: DayOffRange) =>
    r.from === r.to
      ? formatDate(locale, r.from, {
          weekday: 'short',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : formatDateRange(locale, r.from, r.to)

  const list = (items: Array<DayOffRange>) => (
    <ul className="divide-y divide-line">
      {items.map((r) => {
        const Icon = DAY_OFF_ICONS[r.kind]
        return (
          <li
            key={`${r.from}-${r.to}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
          >
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-lg text-white"
              style={{ background: DAY_OFF_COLORS[r.kind] }}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {t.kinds[r.kind]}
                {r.note && (
                  <span className="font-normal text-ink-soft">: {r.note}</span>
                )}
              </p>
              <p className="text-sm text-ink-soft">
                {dates(r)}, {format.plural(t.settings.days, r.days)}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${t.banner.change}: ${t.kinds[r.kind]}, ${dates(r)}`}
                onClick={() =>
                  setDialog({
                    initial: {
                      from: r.from,
                      to: r.to,
                      kind: r.kind,
                      note: r.note,
                    },
                    replacing: r,
                  })
                }
              >
                {t.banner.change}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={fmt(t.settings.removeLabel, {
                  kind: t.kinds[r.kind],
                  dates: dates(r),
                })}
                onClick={() => setRemoving(r)}
              >
                {t.settings.remove}
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div>
      <SectionHeader title={t.settings.title} lead={t.settings.lead} />
      <SettingsCard
        title={t.settings.upcoming}
        lead={summary ? fmt(t.settings.thisYear, { summary }) : undefined}
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
            {t.settings.add}
          </Button>
        }
      >
        {days.isPending ? (
          <div aria-hidden className="h-24 animate-pulse rounded-lg bg-muted" />
        ) : ranges.length === 0 ? (
          <p className="text-ink-soft">{t.settings.empty}</p>
        ) : upcoming.length === 0 ? (
          <p className="text-ink-soft">{t.settings.emptyUpcoming}</p>
        ) : (
          list(upcoming)
        )}
      </SettingsCard>

      {past.length > 0 && (
        <SettingsCard title={t.settings.past} className="mt-6">
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
            ? fmt(t.settings.removeLabel, {
                kind: t.kinds[removing.kind],
                dates: dates(removing),
              })
            : ''
        }
        description={t.settings.removeText}
        confirmLabel={t.settings.remove}
        cancelLabel={app.actions.cancel}
        destructive
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  )
}
