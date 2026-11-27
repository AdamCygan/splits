import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, todayIn } from '#/domain/dates'
import { clampWorkDate, dayTotals, historyStart } from '#/domain/workday'
import type { TimeEntry } from '#/data/types'
import { useCurrentUser } from '#/features/auth/session'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/plans'
import { settingsQuery, taskTypesQuery } from '#/features/settings/queries'
import { useI18n, useMessages } from '#/i18n/context'
import { entriesMessages } from '#/i18n/messages/entries'
import { entriesQuery } from '../../queries'
import type { EntryPrefill } from '../entry-form'

/** Polecenie z palety (adres ?log=…&mode=… albo ?template=…), wykonywane raz po wejściu. */
export type TodayRequest = {
  log?: string
  mode?: 'timer' | 'range' | 'duration'
  template?: string
}

export type TodayProps = {
  /** Wybrany dzień z adresu (?date=); brak = dziś. */
  date?: string
  onDateChange?: (date: string, today: string) => void
  request?: TodayRequest
  onRequestDone?: () => void
}

/**
 * ViewModel strony Dziś: który dzień (z limitem historii planu Free), nagłówki, liczby
 * dnia, lista wpisów i to, co trafia do formularza (wyszukiwarka, paleta poleceń).
 */
export function useTodayViewModel({
  date,
  onDateChange,
  request,
  onRequestDone,
}: TodayProps) {
  const t = useMessages(entriesMessages)
  const { tag } = useI18n()
  const settings = useQuery(settingsQuery).data
  const user = useCurrentUser()
  const types = useQuery(taskTypesQuery).data ?? []
  const today = todayIn(settings?.timezone)

  // Plan Free: dopisywanie wpisów z ostatnich 30 dni (tyle historii obejmuje Free).
  const limited = !hasProAccess(user)
  const minDate = historyStart(today, limited ? FREE_LIMITS.historyDays : null)
  const workDate = clampWorkDate(date, today, minDate)
  const isToday = workDate === today

  const entries = useQuery(entriesQuery(workDate))
  const list: Array<TimeEntry> = entries.data ?? []

  // Zadanie z wyszukiwarki albo z palety do wpisania w formularz.
  const [prefill, setPrefill] = useState<EntryPrefill | null>(null)
  const nextPrefill = (patch: Omit<EntryPrefill, 'key'>) =>
    setPrefill((p) => ({ ...patch, key: (p?.key ?? 0) + 1 }))
  const requestedLog = request?.log
  const requestedMode = request?.mode
  useEffect(() => {
    if (requestedLog === undefined && requestedMode === undefined) return
    nextPrefill({ title: requestedLog, mode: requestedMode })
    onRequestDone?.()
    // Tylko przy nowym poleceniu z adresu.
  }, [requestedLog, requestedMode])

  // Nagłówki: „Dziś”, „Wczoraj” albo dzień tygodnia; rok tylko, gdy inny niż bieżący.
  const day = new Date(`${workDate}T00:00:00Z`)
  const sameYear = workDate.slice(0, 4) === today.slice(0, 4)
  const dateText = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag, {
      ...options,
      year: sameYear ? undefined : 'numeric',
      timeZone: 'UTC',
    }).format(day)
  const heading = isToday
    ? t.pageTitle
    : workDate === addDays(today, -1)
      ? t.day.yesterday
      : new Intl.DateTimeFormat(tag, {
          weekday: 'long',
          timeZone: 'UTC',
        }).format(day)

  return {
    t,
    today,
    workDate,
    isToday,
    limited,
    minDate,
    dateLabel: dateText({ weekday: 'long', month: 'long', day: 'numeric' }),
    shortDate: dateText({ month: 'long', day: 'numeric' }),
    heading: heading.charAt(0).toUpperCase() + heading.slice(1),
    totals: dayTotals(list, types, settings?.workdayTargetMinutes ?? 0),
    entries: list,
    entriesPending: entries.isPending,
    prefill,
    templateRequest: request?.template,
    onRequestDone,
    useTask: (entry: TimeEntry) => nextPrefill({ entry }),
    changeDate: (next: string) => onDateChange?.(next, today),
  }
}

export type TodayViewModel = ReturnType<typeof useTodayViewModel>
