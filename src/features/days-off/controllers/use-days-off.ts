import { useApplyMutation } from '#/features/workspaces/controllers/use-apply-mutation'
import { useFormat, useMessages } from '#/i18n/context'
import { daysOffMessages } from '#/i18n/messages/days-off'
import { keys } from '#/shared/data/query-keys'
import { daysOffApi } from '../data/api'
import type { DayOff, DayOffInput } from '../data/dto'

export interface DateRange {
  from: string
  to: string
}

export interface SaveDaysOffOptions {
  /** Edytowany zakres: najpierw go usuwamy, potem zapisujemy nowy. */
  replacing?: DateRange
  onSaved: () => void
}

/** Zapis dni wolnych (nowy zakres albo zmiana istniejącego), z komunikatem o liczbie dni. */
export function useSaveDaysOff({ replacing, onSaved }: SaveDaysOffOptions) {
  const messages = useMessages(daysOffMessages)
  const format = useFormat()
  return useApplyMutation(
    'daysOff',
    async (input: DayOffInput, apply) => {
      if (replacing) {
        const removed = await daysOffApi.remove(
          replacing.from,
          replacing.to,
          apply,
        )
        if (!removed.ok) return removed
      }
      return daysOffApi.set(input, apply)
    },
    {
      invalidate: [keys.daysOff],
      success: (saved: Array<DayOff>) =>
        saved.length === 0
          ? messages.dialog.none
          : format.plural(messages.dialog.saved, saved.length),
      onSuccess: onSaved,
    },
  )
}

export interface RemoveDaysOffOptions {
  success: string
  onRemoved?: () => void
}

/** Usunięcie dni wolnych z zakresu (jeden dzień albo cały urlop). */
export function useRemoveDaysOff({ success, onRemoved }: RemoveDaysOffOptions) {
  return useApplyMutation(
    'daysOff',
    (range: DateRange, apply) => daysOffApi.remove(range.from, range.to, apply),
    { invalidate: [keys.daysOff], success, onSuccess: onRemoved },
  )
}
