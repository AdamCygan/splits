import { useQuery } from '@tanstack/react-query'
import { breaksApi } from '#/features/breaks/data/api'
import type { WorkBreak, WorkBreakInput } from '#/features/breaks/data/dto'
import {
  breakKeys,
  breaksQuery,
  runningBreakQuery,
} from '#/features/breaks/data/queries'
import { settingsQuery } from '#/features/settings/data/queries'
import { entryKeys } from '#/features/time-entries/data/queries'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { useDataMutation } from '#/shared/data/mutations'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

/** Sekundy trwającej przerwy, odświeżane co sekundę. */
function useBreakSeconds(running: WorkBreak | null | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running])
  if (!running?.startedAt) return 0
  return Math.max(0, Math.floor((now - Date.parse(running.startedAt)) / 1000))
}

/** Przerwy z dnia: wykorzystane minuty (z trwającą), limit z ustawień i trwająca przerwa. */
export function useBreakDay(date: string) {
  const list = useQuery(breaksQuery(date)).data ?? []
  const running = useQuery(runningBreakQuery).data ?? null
  const limit = useQuery(settingsQuery).data?.breakMinutes ?? 30
  const seconds = useBreakSeconds(running)
  const finished = list
    .filter((b) => !b.running)
    .reduce((sum, b) => sum + b.durationMinutes, 0)
  const live =
    running && running.workDate === date ? Math.floor(seconds / 60) : 0
  return { list, running, limit, used: finished + live, seconds }
}

export function useStartBreak() {
  const t = useMessages(entriesMessages).breaks
  return useDataMutation(() => breaksApi.start(), {
    invalidate: [breakKeys.all, entryKeys.all],
    success: (result) =>
      result.paused
        ? fmt(t.startedPaused, { name: result.paused.title })
        : t.started,
  })
}

interface EndBreakInput {
  id: string
  /** Po przerwie wznowić wstrzymane zadanie. */
  resume: boolean
}

export function useEndBreak() {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  return useDataMutation(
    ({ id, resume }: EndBreakInput) => breaksApi.end(id, resume),
    {
      invalidate: [breakKeys.all, entryKeys.all],
      success: (result) =>
        fmt(t.breaks.ended, {
          time: format.minutes(result.break.durationMinutes),
        }),
      onSuccess: (result) => {
        if (result.resumed)
          toast(fmt(t.timer.resumed, { name: result.resumed.title }))
      },
    },
  )
}

export interface BreakListActionsOptions {
  /** Po dodaniu przerwy (czyszczenie formularza). */
  onAdded: () => void
}

/** Ręczne dodanie przerwy do dnia i usunięcie przerwy z listy. */
export function useBreakListActions({ onAdded }: BreakListActionsOptions) {
  const t = useMessages(entriesMessages).breaks
  const format = useFormat()
  const add = useDataMutation((input: WorkBreakInput) => breaksApi.add(input), {
    invalidate: [breakKeys.all],
    success: (added) =>
      fmt(t.added, { time: format.minutes(added.durationMinutes) }),
    onSuccess: onAdded,
  })
  const remove = useDataMutation((id: string) => breaksApi.remove(id), {
    invalidate: [breakKeys.all],
    success: t.removed,
  })
  return { add, remove }
}
