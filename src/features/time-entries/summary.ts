import type { TaskType, TimeEntry } from '#/data/types'
import { taskKeyOf, taskStats } from '#/domain/summary'
import type { SummaryValues, TaskStats } from '#/domain/summary'
import type { Locale } from '#/i18n/config'
import { formatMinutes, formatNumber, plural } from '#/i18n/format'
import { localeTags } from '#/i18n/config'
import { commonMessages } from '#/i18n/messages/common'
import { entriesMessages } from '#/i18n/messages/entries'
import { settingsMessages } from '#/i18n/messages/settings'

const dayLabel = (locale: Locale, date: string) =>
  new Intl.DateTimeFormat(localeTags[locale], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))

const clock = (locale: Locale, time: string) =>
  new Intl.DateTimeFormat(localeTags[locale], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
    .format(new Date(`1970-01-01T${time}:00Z`))
    // Zwykła spacja zamiast wąskiej (ICU): tekst wklejany do Jiry czy Slacka wygląda tak samo wszędzie.
    .replace(/[\u202f\u00a0]/g, ' ')

/** Wartości pól szablonu dla zadania, sformatowane w języku użytkownika. */
export function summaryValues(
  locale: Locale,
  stats: TaskStats,
  entry: Pick<TimeEntry, 'title' | 'link'>,
  type: Pick<TaskType, 'name'> | undefined,
): SummaryValues {
  const t = entriesMessages[locale].taskSummary
  return {
    task: entry.title,
    total: formatMinutes(locale, stats.totalMinutes),
    sessions: plural(locale, t.sessions, stats.sessions),
    days: plural(locale, t.days, stats.days.length),
    sp:
      stats.storyPoints === null
        ? t.noSp
        : `${formatNumber(locale, stats.storyPoints)} SP`,
    type: type?.name ?? '',
    key: taskKeyOf(entry) ?? '',
    link: entry.link ?? '',
    first: stats.first ? dayLabel(locale, stats.first) : '',
    last: stats.last ? dayLabel(locale, stats.last) : '',
    notes: stats.notes.length
      ? stats.notes
          .map(({ note }) => `- ${note.replace(/\n+/g, ' ').trim()}`)
          .join('\n')
      : t.noNotes,
    intervals: stats.days
      .map(({ date }) => {
        const ranges = stats.intervals
          .filter((i) => i.date === date)
          .map((i) =>
            i.start && i.end
              ? `${clock(locale, i.start)}–${clock(locale, i.end)} (${formatMinutes(locale, i.minutes)})`
              : formatMinutes(locale, i.minutes),
          )
        return `- ${dayLabel(locale, date)}: ${ranges.join(', ')}`
      })
      .join('\n'),
    overtime: stats.overtimeMinutes
      ? [
          `${t.overtime}: ${formatMinutes(locale, stats.overtimeMinutes)}`,
          ...stats.overtimeNotes.map(
            ({ date, minutes, note }) =>
              `- ${dayLabel(locale, date)}, ${formatMinutes(locale, minutes)}: ${note.replace(/\n+/g, ' ')}`,
          ),
        ].join('\n')
      : t.noOvertime,
    breakdown: stats.days
      .map(
        ({ date, minutes }) =>
          `- ${dayLabel(locale, date)}: ${formatMinutes(locale, minutes)}`,
      )
      .join('\n'),
  }
}

export const defaultSummaryTemplate = (locale: Locale) =>
  settingsMessages[locale].summaries.defaultTemplate

/** Przykładowe zadanie do podglądu w edytorze szablonu. */
export function sampleValues(locale: Locale): SummaryValues {
  const sample = settingsMessages[locale].summaries.sample
  const workDates = ['2026-11-02', '2026-11-03', '2026-11-04']
  const entries: Array<TimeEntry> = [130, 95, 40].map((minutes, i) => ({
    id: String(i),
    taskTypeId: 'task',
    projectId: null,
    title: sample.task,
    link: 'https://acme.atlassian.net/browse/PAY-142',
    storyPoints: 3,
    workDate: workDates[i]!,
    startTime: ['09:15', '13:00', '06:40'][i]!,
    endTime: ['11:25', '14:35', '07:20'][i]!,
    durationMinutes: minutes,
    note: sample.notes[i] ?? null,
    overtimeMinutes: i === 2 ? 40 : null,
    overtimeNote: i === 2 ? sample.overtime : null,
    estimateMinutes: null,
    extensionMinutes: null,
    extensionNote: null,
    running: false,
    paused: false,
    startedAt: null,
    createdAt: '',
  }))
  return summaryValues(locale, taskStats(entries), entries[0]!, {
    name: commonMessages[locale].workTypes.task,
  })
}
