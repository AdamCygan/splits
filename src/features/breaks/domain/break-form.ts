import { TIME_RE } from '#/features/task-types/domain/rules'
import {
  minutesBetween,
  parseDuration,
} from '#/features/time-entries/domain/entries'

export interface BreakDraft {
  /** Czas trwania („30”, „1:15”), gdy nie podano godzin. */
  duration: string
  from: string
  to: string
}

export interface BreakDraftResult {
  /** Czy przerwa jest opisana godzinami od–do (a nie samym czasem trwania). */
  hasTimes: boolean
  minutes: number | null
  /** Błąd do pokazania: złe godziny albo zły czas trwania. */
  error: 'times' | 'duration' | null
}

/** Ręcznie dodawana przerwa: godziny od–do mają pierwszeństwo przed czasem trwania. */
export function readBreakDraft({
  duration,
  from,
  to,
}: BreakDraft): BreakDraftResult {
  const hasTimes = from.trim() !== '' || to.trim() !== ''
  const between =
    TIME_RE.test(from) && TIME_RE.test(to) ? minutesBetween(from, to) : null
  const minutes = hasTimes ? between : parseDuration(duration)
  const error = hasTimes
    ? between === null || between < 1
      ? 'times'
      : null
    : minutes === null || minutes < 1 || minutes > 1440
      ? 'duration'
      : null
  return { hasTimes, minutes, error }
}
