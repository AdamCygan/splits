import type { Dictionary } from '../context'
import type { Plural } from '../format'

/** Dni wolne: urlop, L4, święta (Dziś, Sprinty, Ustawienia). */
const en = {
  kinds: {
    vacation: 'Vacation',
    sick: 'Sick leave',
    holiday: 'Public holiday',
    other: 'Day off',
  },
  kindHints: {
    vacation: 'Your own time off',
    sick: 'Doctor’s note or a sick day',
    holiday: 'A public holiday or a company day off',
    other: 'Anything else, e.g. time off in lieu',
  },
  mark: 'Day off',
  markLabel: 'Mark a day off',
  dialog: {
    title: 'Mark a day off',
    edit: 'Change the day off',
    lead: 'Days off lower the working days of your sprint, so its numbers stay fair.',
    kind: 'Kind',
    from: 'From',
    to: 'To',
    range:
      'Only your working days in this range are marked, weekends are skipped.',
    note: 'Note',
    optional: '(optional)',
    notePlaceholder: 'e.g. Christmas, flu',
    save: 'Save day off',
    saved: {
      one: 'Marked {n} day off',
      other: 'Marked {n} days off',
    } as Plural,
    none: 'There are no working days in this range.',
    toBeforeFrom: 'The end date can’t be before the start date.',
    tooLong: 'Pick a range of up to a year.',
  },
  banner: {
    title: '{kind}',
    lead: 'This is a day off. You can still log time if you worked.',
    change: 'Change',
    remove: 'Remove day off',
    removed: 'Day off removed',
  },
  sprint: {
    available: 'Working days',
    availableValue: '{available} of {working}',
    none: 'No days off',
    off: {
      one: '{n} day off: {kinds}',
      other: '{n} days off: {kinds}',
    } as Plural,
    short: {
      one: '{n} day off',
      other: '{n} days off',
    } as Plural,
    add: 'Add a day off',
  },
  settings: {
    seoTitle: 'Days off',
    title: 'Days off',
    lead: 'Vacation, sick leave and public holidays. Sprints count only the days you were available.',
    add: 'Add days off',
    upcoming: 'Upcoming',
    past: 'Past',
    empty:
      'No days off yet. Add your vacation or the public holidays of this year.',
    emptyUpcoming: 'Nothing planned.',
    days: { one: '{n} day', other: '{n} days' } as Plural,
    remove: 'Remove',
    removeLabel: 'Remove {kind}, {dates}',
    removed: 'Days off removed',
    removeText: 'Sprints will count these days as working days again.',
    thisYear: 'This year: {summary}',
  },
}

export type DaysOffMessages = typeof en

const pl: DaysOffMessages = {
  kinds: {
    vacation: 'Urlop',
    sick: 'Zwolnienie lekarskie (L4)',
    holiday: 'Święto',
    other: 'Dzień wolny',
  },
  kindHints: {
    vacation: 'Twój urlop',
    sick: 'L4 albo dzień choroby',
    holiday: 'Święto państwowe albo dzień wolny w firmie',
    other: 'Coś innego, np. odbiór za nadgodziny',
  },
  mark: 'Dzień wolny',
  markLabel: 'Oznacz dzień wolny',
  dialog: {
    title: 'Oznacz dzień wolny',
    edit: 'Zmień dzień wolny',
    lead: 'Dni wolne zmniejszają liczbę dni roboczych w sprincie, więc jego liczby są uczciwe.',
    kind: 'Rodzaj',
    from: 'Od',
    to: 'Do',
    range:
      'Zaznaczamy tylko Twoje dni pracy w tym zakresie, weekendy pomijamy.',
    note: 'Notatka',
    optional: '(opcjonalnie)',
    notePlaceholder: 'np. Boże Narodzenie, grypa',
    save: 'Zapisz dzień wolny',
    saved: {
      one: 'Zaznaczono {n} dzień wolny',
      few: 'Zaznaczono {n} dni wolne',
      many: 'Zaznaczono {n} dni wolnych',
      other: 'Zaznaczono {n} dni wolnych',
    },
    none: 'W tym zakresie nie ma dni pracy.',
    toBeforeFrom: 'Data końca nie może być przed datą początku.',
    tooLong: 'Wybierz zakres do roku.',
  },
  banner: {
    title: '{kind}',
    lead: 'To dzień wolny. Jeśli jednak pracowałeś, nadal możesz wpisać czas.',
    change: 'Zmień',
    remove: 'Usuń dzień wolny',
    removed: 'Dzień wolny usunięty',
  },
  sprint: {
    available: 'Dni robocze',
    availableValue: '{available} z {working}',
    none: 'Bez dni wolnych',
    off: {
      one: '{n} dzień wolny: {kinds}',
      few: '{n} dni wolne: {kinds}',
      many: '{n} dni wolnych: {kinds}',
      other: '{n} dni wolnych: {kinds}',
    },
    short: {
      one: '{n} dzień wolny',
      few: '{n} dni wolne',
      many: '{n} dni wolnych',
      other: '{n} dni wolnych',
    },
    add: 'Dodaj dzień wolny',
  },
  settings: {
    seoTitle: 'Dni wolne',
    title: 'Dni wolne',
    lead: 'Urlop, L4 i święta. Sprinty liczą tylko dni, w których byłeś dostępny.',
    add: 'Dodaj dni wolne',
    upcoming: 'Nadchodzące',
    past: 'Minione',
    empty: 'Nie masz jeszcze dni wolnych. Dodaj urlop albo tegoroczne święta.',
    emptyUpcoming: 'Nic nie zaplanowano.',
    days: {
      one: '{n} dzień',
      few: '{n} dni',
      many: '{n} dni',
      other: '{n} dni',
    },
    remove: 'Usuń',
    removeLabel: 'Usuń: {kind}, {dates}',
    removed: 'Dni wolne usunięte',
    removeText: 'Sprinty znów policzą te dni jako robocze.',
    thisYear: 'W tym roku: {summary}',
  },
}

export const daysOffMessages: Dictionary<DaysOffMessages> = { en, pl }
