import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarOff } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { data } from '#/data'
import {
  daysOffQuery,
  keys,
  useDataMutation,
} from '#/features/settings/queries'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { daysOffMessages } from '#/i18n/messages/days-off'
import { DAY_OFF_COLORS, DAY_OFF_ICONS, DayOffDialog } from './day-off-dialog'

/** Przycisk „Dzień wolny” w nagłówku Dziś (gdy wybrany dzień nie jest jeszcze wolny). */
export function DayOffButton({ date }: { date: string }) {
  const t = useMessages(daysOffMessages)
  const day = useQuery(daysOffQuery(date, date)).data?.[0]
  const [open, setOpen] = useState(false)
  if (day) return null
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CalendarOff aria-hidden />
        {t.mark}
      </Button>
      {open && (
        <DayOffDialog
          initial={{ from: date, to: date, kind: 'vacation', note: null }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** Baner na Dziś, gdy wybrany dzień jest wolny: rodzaj, notatka, zmiana albo usunięcie. */
export function DayOffBanner({ date }: { date: string }) {
  const t = useMessages(daysOffMessages)
  const day = useQuery(daysOffQuery(date, date)).data?.[0]
  const [editing, setEditing] = useState(false)
  const remove = useDataMutation(() => data.daysOff.remove(date, date), {
    invalidate: [keys.daysOff],
    success: t.banner.removed,
  })
  if (!day) return null
  const Icon = DAY_OFF_ICONS[day.kind]
  return (
    <section
      aria-label={t.kinds[day.kind]}
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line border-l-4 bg-surface px-4 py-3.5 sm:px-5"
      style={{ borderLeftColor: DAY_OFF_COLORS[day.kind] }}
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-xl text-white"
        style={{ background: DAY_OFF_COLORS[day.kind] }}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {fmt(t.banner.title, { kind: t.kinds[day.kind] })}
          {day.note && (
            <span className="font-normal text-ink-soft">: {day.note}</span>
          )}
        </p>
        <p className="text-sm text-ink-soft">{t.banner.lead}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          {t.banner.change}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          {t.banner.remove}
        </Button>
      </div>
      {editing && (
        <DayOffDialog
          initial={{ from: date, to: date, kind: day.kind, note: day.note }}
          replacing={{ from: date, to: date }}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  )
}
