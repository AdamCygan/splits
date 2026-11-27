import type { TaskType, TimeEntry, WorkBreak } from '#/data/types'
import { toMinutes } from './entries'
import { groupTasks, taskGroupKey } from './report'
import type { TaskRow } from './report'

/** Odcinek na osi dnia: sesja pracy albo przerwa, w minutach od północy. */
export type DayBlock = {
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

export type DaySummary = {
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
  span: { start: number; end: number } | null
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
  const kind = new Map(types.map((x) => [x.id, x.kind]))
  const isMeeting = (e: TimeEntry) => kind.get(e.taskTypeId) === 'meeting'
  const tasks = groupTasks(entries, types).sort(
    (a, b) => b.minutes - a.minutes || a.title.localeCompare(b.title),
  )
  const sum = (list: ReadonlyArray<{ durationMinutes: number }>) =>
    list.reduce((s, e) => s + e.durationMinutes, 0)
  const meetings = entries.filter(isMeeting)

  const timed = (x: { startTime: string | null; endTime: string | null }) =>
    x.startTime !== null && x.endTime !== null
  const blocks: Array<DayBlock> = [
    ...entries.filter(timed).map((e) => ({
      id: e.id,
      kind: 'work' as const,
      start: toMinutes(e.startTime!),
      end: Math.max(toMinutes(e.endTime!), toMinutes(e.startTime!)),
      minutes: e.durationMinutes,
      taskTypeId: e.taskTypeId,
      title: e.title,
      taskKey: taskGroupKey(e),
    })),
    ...breaks.filter(timed).map((b) => ({
      id: b.id,
      kind: 'break' as const,
      start: toMinutes(b.startTime!),
      end: Math.max(toMinutes(b.endTime!), toMinutes(b.startTime!)),
      minutes: b.durationMinutes,
      taskTypeId: null,
      title: '',
      taskKey: null,
    })),
  ].sort((a, b) => a.start - b.start || a.end - b.end)

  // Ciągła praca bez spotkań: sąsiednie sesje (do 5 min odstępu) sklejamy w jeden odcinek.
  let longestFocus = 0
  let run: { start: number; end: number } | null = null
  let switches = 0
  let previousTask: string | null = null
  for (const b of blocks) {
    const focus =
      b.kind === 'work' && kind.get(b.taskTypeId ?? '') !== 'meeting'
    if (focus) {
      run =
        run && b.start - run.end <= 5
          ? { start: run.start, end: Math.max(run.end, b.end) }
          : { start: b.start, end: b.end }
      longestFocus = Math.max(longestFocus, run.end - run.start)
    } else {
      run = null
    }
    if (b.kind === 'work') {
      if (previousTask !== null && b.taskKey !== previousTask) switches += 1
      previousTask = b.taskKey
    }
  }

  const perType = new Map<string, number>()
  for (const e of entries)
    perType.set(
      e.taskTypeId,
      (perType.get(e.taskTypeId) ?? 0) + e.durationMinutes,
    )
  const byType = [...perType]
    .map(([taskTypeId, minutes]) => ({ taskTypeId, minutes }))
    .sort((a, b) => b.minutes - a.minutes)

  return {
    minutes: sum(entries),
    focusMinutes: sum(entries) - sum(meetings),
    meetingMinutes: sum(meetings),
    meetings: meetings.length,
    overtimeMinutes: entries.reduce((s, e) => s + (e.overtimeMinutes ?? 0), 0),
    extensionMinutes: entries.reduce(
      (s, e) => s + (e.extensionMinutes ?? 0),
      0,
    ),
    breakMinutes: sum(breaks),
    breaks: breaks.length,
    longestFocus,
    switches,
    untimedMinutes: sum(entries.filter((e) => !timed(e))),
    span:
      blocks.length > 0
        ? {
            start: Math.min(...blocks.map((b) => b.start)),
            end: Math.max(...blocks.map((b) => b.end)),
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
export function timelineAxis(span: { start: number; end: number }) {
  const from = Math.floor(span.start / 60) * 60
  const to = Math.max(from + 60, Math.ceil(span.end / 60) * 60)
  const hours = (to - from) / 60
  const step = hours > 12 ? 3 : hours > 8 ? 2 : 1
  return {
    from,
    to,
    ticks: Array.from(
      { length: Math.floor(hours / step) + 1 },
      (_, i) => from + i * step * 60,
    ),
    /** Pozycja minuty dnia na osi (0–100%). */
    x: (minute: number) => ((minute - from) / (to - from)) * 100,
    /** Minuta dnia w miejscu ułamka szerokości osi (0–1). */
    at: (fraction: number) => from + fraction * (to - from),
  }
}

/** Indeks odcinka osi, w który trafia minuta (−1 = przerwa między odcinkami). */
export const blockIndexAt = (
  blocks: ReadonlyArray<{ start: number; end: number }>,
  minute: number,
) => blocks.findIndex((b) => minute >= b.start && minute <= b.end)

/** Sesje zadania od najwcześniejszej; wpisy bez godzin na końcu. */
export const sessionsOfTask = <TEntry extends TimeEntry>(
  entries: ReadonlyArray<TEntry>,
  key: string,
): Array<TEntry> =>
  entries
    .filter((e) => taskGroupKey(e) === key)
    .sort((a, b) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99'))
