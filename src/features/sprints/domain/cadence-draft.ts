import type { SprintCadence } from '#/features/sprints/data/dto'
import { startOfWeek, todayIn } from '#/shared/domain/dates'

export const PRESETS = [7, 14, 21, 28] as const

export type LengthChoice = '7' | '14' | '21' | '28' | 'custom'

// ---------------------------------------------------------------- harmonogram

interface ScheduleDraft {
  length: LengthChoice
  customDays: string
  anchorDate: string
  namePattern: string
  autoCreate: boolean
}

export function toDraft(
  cadence: SprintCadence | null,
  defaultPattern: string,
): ScheduleDraft {
  const today = todayIn()
  const days = cadence?.lengthDays ?? 14
  return {
    length: (PRESETS as ReadonlyArray<number>).includes(days)
      ? (String(days) as LengthChoice)
      : 'custom',
    customDays: String(days),
    anchorDate: cadence?.anchorDate ?? startOfWeek(today, 1),
    namePattern: cadence?.namePattern ?? defaultPattern,
    autoCreate: cadence?.autoCreate ?? true,
  }
}
