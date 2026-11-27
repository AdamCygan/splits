import { entriesApi } from '../data/api'
import { entryKeys } from '../data/queries'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { elapsedSeconds } from '#/features/time-entries/domain/entries'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { useDataMutation } from '#/shared/data/mutations'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

/** Licznik sekund od startu, odświeżany co sekundę tylko gdy timer działa. */
export function useElapsed(entry: TimeEntry | null | undefined) {
  const [now, setNow] = useState(() => Date.now())
  const active = Boolean(entry?.running)
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return entry?.running ? elapsedSeconds(entry.startedAt, now) : 0
}

/** Zatrzymanie timera z komunikatem o zalogowanym czasie. */
export function useStopTimer() {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  return useDataMutation((id: string) => entriesApi.stop(id), {
    invalidate: [entryKeys.all],
    success: (stopped) =>
      fmt(t.timer.stopped, { time: format.minutes(stopped.durationMinutes) }),
  })
}

/** Przerwa: sesja się kończy, a zadanie czeka na pasku z przyciskiem „Wznów”. */
export function usePauseTimer() {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  return useDataMutation((id: string) => entriesApi.pause(id), {
    invalidate: [entryKeys.all],
    success: (paused) =>
      fmt(t.timer.pausedDone, {
        name: paused.title,
        time: format.minutes(paused.durationMinutes),
      }),
  })
}

/** Wznowienie zadania (nowy odcinek czasu); działający timer innego zadania zostaje wstrzymany. */
export function useResumeTask() {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  return useDataMutation((id: string) => entriesApi.resume(id), {
    invalidate: [entryKeys.all],
    success: (result) => fmt(t.timer.resumed, { name: result.started.title }),
    onSuccess: (result) => {
      if (result.stopped)
        toast(
          fmt(t.form.previousStopped, {
            name: result.stopped.title,
            time: format.minutes(result.stopped.durationMinutes),
          }),
        )
    },
  })
}

/** Zadanie skończone: znika z listy wstrzymanych. */
export function useDismissPaused() {
  const t = useMessages(entriesMessages)
  return useDataMutation((entry: TimeEntry) => entriesApi.dismiss(entry.id), {
    invalidate: [entryKeys.all],
    success: (_, entry) => fmt(t.timer.dismissed, { name: entry.title }),
  })
}
