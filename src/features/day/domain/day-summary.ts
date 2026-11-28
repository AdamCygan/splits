import type { TaskType } from '#/features/task-types/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import type { WorkBreak } from '#/features/breaks/data/dto'
import { toMinutes } from '#/features/time-entries/domain/entries'
import { groupTasks, taskGroupKey } from '#/features/reports/domain/report'
import type { TaskRow } from '#/features/reports/domain/report'

/** Przedział w minutach od północy. */
export interface MinuteRange {
  start: number
  end: number
}

/** Odcinek na osi dnia: sesja pracy albo przerwa, w minutach od północy. */
export interface DayBlock {
  id: string
  kind: 'work' | 'break'
  start: number
  end: number
  minutes: number
  taskTypeId: string | null
  title: string
  /** Klucz zadania (jak w raporcie), żeby oś i lista zadań mówiły o tym samym. */
  taskKey: string | null
}

export interface DaySummary {
  minutes: number
  /** Praca bez spotkań. */
  focusMinutes: number
  meetingMinutes: number
  meetings: number
  overtimeMinutes: number
  extensionMinutes: number
  breakMinutes: number
  breaks: number
  /** Najdłuższy ciągły odcinek pracy bez spotkania i przerwy (wpisy z godzinami). */
  longestFocus: number
  /** Ile razy w ciągu dnia praca przeskoczyła na inne zadanie (wpisy z godzinami). */
  switches: number
  /** Wpisy bez godzin (sam czas trwania) nie mają miejsca na osi. */
  untimedMinutes: number
  /** Pierwszy start i ostatni koniec dnia (minuty od północy); null = brak godzin. */
  span: MinuteRange | null
  blocks: Array<DayBlock>
  tasks: Array<TaskRow>
  byType: Array<{ taskTypeId: string; minutes: number }>
}

/**
 * Podsumowanie jednego dnia: sumy, oś godzin (praca i przerwy), zadania i podział na typy.
 * `entries` i `breaks` są z tego samego dnia; spotkania rozpoznajemy po rodzaju typu pracy.
 */
export function daySummary(
  entries: ReadonlyArray<TimeEntry>,
  breaks: ReadonlyArray<WorkBreak>,
  types: ReadonlyArray<
    Pick<TaskType, 'id' | 'kind' | 'storyPointsRequirement'>
  >,
): DaySummary {
  const kind = new Map(types.map((type) => [type.id, type.kind]))
  const isMeeting = (timeEntry: TimeEntry) =>
    kind.get(timeEntry.taskTypeId) === 'meeting'
  const tasks = groupTasks(entries, types).sort(
    (left, right) =>
      right.minutes - left.minutes || left.title.localeCompare(right.title),
  )
  const sum = (list: ReadonlyArray<Pick<TimeEntry, 'durationMinutes'>>) =>
    list.reduce((total, entry) => total + entry.durationMinutes, 0)
  const meetings = entries.filter(isMeeting)

  const timed = (timeEntry: Pick<TimeEntry, 'startTime' | 'endTime'>) =>
    timeEntry.startTime !== null && timeEntry.endTime !== null
  const blocks: Array<DayBlock> = [
    ...entries.filter(timed).map((timeEntry) => ({
      id: timeEntry.id,
      kind: 'work' as const,
      start: toMinutes(timeEntry.startTime!),
      end: Math.max(
        toMinutes(timeEntry.endTime!),
        toMinutes(timeEntry.startTime!),
      ),
      minutes: timeEntry.durationMinutes,
      taskTypeId: timeEntry.taskTypeId,
      title: timeEntry.title,
      taskKey: taskGroupKey(timeEntry),
    })),
    ...breaks.filter(timed).map((workBreak) => ({
      id: workBreak.id,
      kind: 'break' as const,
      start: toMinutes(workBreak.startTime!),
      end: Math.max(
        toMinutes(workBreak.endTime!),
        toMinutes(workBreak.startTime!),
      ),
      minutes: workBreak.durationMinutes,
      taskTypeId: null,
      title: '',
      taskKey: null,
    })),
  ].sort((left, right) => left.start - right.start || left.end - right.end)

  // Ciągła praca bez spotkań: sąsiednie sesje (do 5 min odstępu) sklejamy w jeden odcinek.
  let longestFocus = 0
  let run: { start: number; end: number } | null = null
  let switches = 0
  let previousTask: string | null = null
  for (const dayBlock of blocks) {
    const focus =
      dayBlock.kind === 'work' &&
      kind.get(dayBlock.taskTypeId ?? '') !== 'meeting'
    if (focus) {
      run =
        run && dayBlock.start - run.end <= 5
          ? { start: run.start, end: Math.max(run.end, dayBlock.end) }
          : { start: dayBlock.start, end: dayBlock.end }
      longestFocus = Math.max(longestFocus, run.end - run.start)
    } else {
      run = null
    }
    const isWorkBlock = dayBlock.kind === 'work'
    if (isWorkBlock) {
      const isTaskSwitch =
        previousTask !== null && dayBlock.taskKey !== previousTask
      if (isTaskSwitch) switches += 1
      previousTask = dayBlock.taskKey
    }
  }

  const perType = new Map<string, number>()
  for (const timeEntry of entries)
    perType.set(
      timeEntry.taskTypeId,
      (perType.get(timeEntry.taskTypeId) ?? 0) + timeEntry.durationMinutes,
    )
  const byType = [...perType]
    .map(([taskTypeId, minutes]) => ({ taskTypeId, minutes }))
    .sort((left, right) => right.minutes - left.minutes)

  return {
    minutes: sum(entries),
    focusMinutes: sum(entries) - sum(meetings),
    meetingMinutes: sum(meetings),
    meetings: meetings.length,
    overtimeMinutes: entries.reduce(
      (accumulator, timeEntry) =>
        accumulator + (timeEntry.overtimeMinutes ?? 0),
      0,
    ),
    extensionMinutes: entries.reduce(
      (accumulator, timeEntry) =>
        accumulator + (timeEntry.extensionMinutes ?? 0),
      0,
    ),
    breakMinutes: sum(breaks),
    breaks: breaks.length,
    longestFocus,
    switches,
    untimedMinutes: sum(entries.filter((timeEntry) => !timed(timeEntry))),
    span:
      blocks.length > 0
        ? {
            start: Math.min(...blocks.map((dayBlock) => dayBlock.start)),
            end: Math.max(...blocks.map((dayBlock) => dayBlock.end)),
          }
        : null,
    blocks,
    tasks,
    byType,
  }
}

/**
 * Oś dnia: pełne godziny od początku do końca pracy (co najmniej godzina), znaczniki
 * co 1, 2 albo 3 godziny (zależnie od długości dnia) i pozycja minuty w procentach.
 */
export function timelineAxis(span: MinuteRange) {
  const from = Math.floor(span.start / 60) * 60
  const to = Math.max(from + 60, Math.ceil(span.end / 60) * 60)
  const hours = (to - from) / 60
  const step = hours > 12 ? 3 : hours > 8 ? 2 : 1
  return {
    from,
    to,
    ticks: Array.from(
      { length: Math.floor(hours / step) + 1 },
      (_unused, index) => from + index * step * 60,
    ),
    /** Pozycja minuty dnia na osi (0–100%). */
    x: (minute: number) => ((minute - from) / (to - from)) * 100,
    /** Minuta dnia w miejscu ułamka szerokości osi (0–1). */
    at: (fraction: number) => from + fraction * (to - from),
  }
}

/** Indeks odcinka osi, w który trafia minuta (−1 = przerwa między odcinkami). */
export const blockIndexAt = (
  blocks: ReadonlyArray<MinuteRange>,
  minute: number,
) =>
  blocks.findIndex(
    (minuteRange) => minute >= minuteRange.start && minute <= minuteRange.end,
  )

/** Sesje zadania od najwcześniejszej; wpisy bez godzin na końcu. */
export const sessionsOfTask = <TEntry extends TimeEntry>(
  entries: ReadonlyArray<TEntry>,
  key: string,
): Array<TEntry> =>
  entries
    .filter((timeEntry) => taskGroupKey(timeEntry) === key)
    .sort((left, right) =>
      (left.startTime ?? '99').localeCompare(right.startTime ?? '99'),
    )
