import type { Dictionary } from '../context'
import type { Plural } from '../format'

/** Podsumowanie jednego dnia (z wykresu w Raportach): sumy, oś dnia, zadania, notatki. */
const en = {
  seoTitle: 'Day summary',
  back: 'Reports',
  previous: 'Previous day',
  next: 'Next day',
  edit: 'Edit this day',
  dayOff: {
    vacation: 'Vacation',
    sick: 'Sick leave',
    holiday: 'Public holiday',
    other: 'Day off',
  },
  empty: 'Nothing logged on this day.',
  emptyCta: 'Log time for this day',
  stats: {
    worked: 'Worked',
    target: '{percent}% of your {target} day',
    overtime: '{time} overtime',
    focus: 'Focus work',
    longest: 'longest stretch {time}',
    meetings: 'Meetings',
    meetingCount: { one: '{n} meeting', other: '{n} meetings' } as Plural,
    breaks: 'Breaks',
    noBreaks: 'no breaks logged',
    switches: {
      one: 'switched tasks once',
      other: 'switched tasks {n} times',
    } as Plural,
    breakCount: { one: '{n} break', other: '{n} breaks' } as Plural,
    dayFrom: 'Day from {from} to {to}',
  },
  timeline: {
    title: 'How the day went',
    lead: 'Sessions with a start and end time, coloured by the kind of work. Breaks are striped.',
    keys: 'Day timeline: use the left and right arrow keys to move between sessions, Enter opens the task',
    break: 'Break',
    block: '{name}, {from}–{to}, {time}',
    untimed: '{time} logged without set hours is not on the timeline.',
    noTimes: 'No sessions with set hours on this day.',
    open: 'Click to open the task',
  },
  types: {
    title: 'Where the time went',
    lead: 'Share of the day by kind of work.',
    share: '{percent}%',
  },
  tasks: {
    title: 'Tasks',
    lead: 'Everything you worked on this day, longest first, with your notes.',
    sessions: { one: '{n} session', other: '{n} sessions' } as Plural,
    untimed: 'no set hours',
    overtime: 'Overtime',
    extension: 'Ran over',
  },
}

export type DayViewMessages = typeof en

const pl: DayViewMessages = {
  seoTitle: 'Podsumowanie dnia',
  back: 'Raporty',
  previous: 'Poprzedni dzień',
  next: 'Następny dzień',
  edit: 'Edytuj ten dzień',
  dayOff: {
    vacation: 'Urlop',
    sick: 'Zwolnienie lekarskie',
    holiday: 'Święto',
    other: 'Dzień wolny',
  },
  empty: 'Tego dnia nic nie zostało wpisane.',
  emptyCta: 'Wpisz czas na ten dzień',
  stats: {
    worked: 'Przepracowane',
    target: '{percent}% z dnia pracy ({target})',
    overtime: '{time} nadgodzin',
    focus: 'Praca w skupieniu',
    longest: 'najdłuższy ciąg {time}',
    meetings: 'Spotkania',
    meetingCount: {
      one: '{n} spotkanie',
      few: '{n} spotkania',
      many: '{n} spotkań',
      other: '{n} spotkania',
    },
    breaks: 'Przerwy',
    noBreaks: 'bez przerw',
    switches: {
      one: '{n} zmiana zadania',
      few: '{n} zmiany zadania',
      many: '{n} zmian zadania',
      other: '{n} zmiany zadania',
    },
    breakCount: {
      one: '{n} przerwa',
      few: '{n} przerwy',
      many: '{n} przerw',
      other: '{n} przerwy',
    },
    dayFrom: 'Dzień od {from} do {to}',
  },
  timeline: {
    title: 'Jak minął dzień',
    lead: 'Sesje z godzinami od–do w kolorze rodzaju pracy. Przerwy są w paski.',
    keys: 'Oś dnia: strzałki w lewo i w prawo przechodzą między sesjami, Enter otwiera zadanie',
    break: 'Przerwa',
    block: '{name}, {from}–{to}, {time}',
    untimed: '{time} wpisane bez godzin nie ma miejsca na osi.',
    noTimes: 'Tego dnia nie ma sesji z godzinami.',
    open: 'Kliknij, żeby otworzyć zadanie',
  },
  types: {
    title: 'Na co poszedł czas',
    lead: 'Udział rodzajów pracy w dniu.',
    share: '{percent}%',
  },
  tasks: {
    title: 'Zadania',
    lead: 'Wszystko, nad czym pracowałeś tego dnia, od najdłuższego, z notatkami.',
    sessions: {
      one: '{n} sesja',
      few: '{n} sesje',
      many: '{n} sesji',
      other: '{n} sesji',
    },
    untimed: 'bez godzin',
    overtime: 'Nadgodziny',
    extension: 'Przedłużenie',
  },
}

export const dayViewMessages: Dictionary<DayViewMessages> = { en, pl }
