import type { Dictionary } from '../context'
import type { Plural } from '../format'

/** Strona jednego zadania: czas, sesje, dni, przerwania, notatki. */
const en = {
  seoTitle: 'Task',
  back: 'Tasks',
  open: 'Open task: {name}',
  openLink: 'Open the ticket',
  notFound:
    'This task has no finished sessions. It may have been renamed or deleted.',
  backToTasks: 'Back to tasks',
  continue: 'Continue',
  summary: 'Summary',
  edit: 'Edit task',
  stats: {
    time: 'Total time',
    estimate: 'estimate {estimate}, {diff}',
    over: '{time} over',
    under: '{time} under',
    exact: 'right on',
    sessions: 'Sessions',
    average: 'avg. {time}, longest {longest}',
    days: 'Days worked',
    span: {
      one: '{from}',
      other: '{from} – {to}, over {n} days',
    } as Plural,
    interruptions: 'Interruptions',
    none: 'None, one focused stretch a day',
    every: 'one every {time} of work',
    perSp: 'Time per SP',
    perSpHint: '{sp}',
    extra: 'incl. {overtime} overtime',
    extension: 'incl. {time} running over',
  },
  timeline: {
    title: 'Day by day',
    lead: 'This task is in color, other work in grey, the gaps are when you were pulled away.',
    untimed: '+ {time} without start and end',
    other: 'Other work: {name}, {time}',
    session: '{name}: {from}–{to}, {time}',
    sessions: { one: '{n} session', other: '{n} sessions' } as Plural,
  },
  interrupted: {
    title: 'What pulled you away',
    lead: 'Work logged between the sessions of this task, on the same day.',
    empty:
      'Nothing logged between the sessions. Either a clean run or the gaps were breaks.',
    times: { one: '{n} time', other: '{n} times' } as Plural,
    gaps: 'Gaps between sessions',
    gapLine: '{date}, {from}–{to} ({time})',
    nothing: 'nothing logged',
  },
  notes: {
    title: 'Notes',
    empty: 'No notes in the sessions of this task.',
    overtime: 'Overtime',
    extension: 'Ran over',
  },
}

export type TaskViewMessages = typeof en

const pl: TaskViewMessages = {
  seoTitle: 'Zadanie',
  back: 'Zadania',
  open: 'Otwórz zadanie: {name}',
  openLink: 'Otwórz ticket',
  notFound:
    'To zadanie nie ma zakończonych sesji. Mogło zmienić nazwę albo zostać usunięte.',
  backToTasks: 'Wróć do zadań',
  continue: 'Kontynuuj',
  summary: 'Podsumowanie',
  edit: 'Edytuj zadanie',
  stats: {
    time: 'Łączny czas',
    estimate: 'estymata {estimate}, {diff}',
    over: '{time} ponad',
    under: '{time} poniżej',
    exact: 'dokładnie',
    sessions: 'Sesje',
    average: 'śr. {time}, najdłuższa {longest}',
    days: 'Dni pracy',
    span: {
      one: '{from}',
      few: '{from} – {to}, w ciągu {n} dni',
      many: '{from} – {to}, w ciągu {n} dni',
      other: '{from} – {to}, w ciągu {n} dni',
    },
    interruptions: 'Przerwania',
    none: 'Brak, jeden ciągły blok dziennie',
    every: 'jedno na {time} pracy',
    perSp: 'Czas na SP',
    perSpHint: '{sp}',
    extra: 'w tym {overtime} nadgodzin',
    extension: 'w tym {time} przedłużenia',
  },
  timeline: {
    title: 'Dzień po dniu',
    lead: 'To zadanie jest w kolorze, inna praca na szaro, a luki to chwile, gdy coś Cię oderwało.',
    untimed: '+ {time} bez godzin',
    other: 'Inna praca: {name}, {time}',
    session: '{name}: {from}–{to}, {time}',
    sessions: {
      one: '{n} sesja',
      few: '{n} sesje',
      many: '{n} sesji',
      other: '{n} sesji',
    },
  },
  interrupted: {
    title: 'Co Cię odrywało',
    lead: 'Praca wpisana między sesjami tego zadania, tego samego dnia.',
    empty:
      'Między sesjami nic nie zostało wpisane. Albo czysty ciąg pracy, albo luki to były przerwy.',
    times: {
      one: '{n} raz',
      few: '{n} razy',
      many: '{n} razy',
      other: '{n} razy',
    },
    gaps: 'Luki między sesjami',
    gapLine: '{date}, {from}–{to} ({time})',
    nothing: 'nic nie wpisano',
  },
  notes: {
    title: 'Notatki',
    empty: 'W sesjach tego zadania nie ma notatek.',
    overtime: 'Nadgodziny',
    extension: 'Przedłużenie',
  },
}

export const taskViewMessages: Dictionary<TaskViewMessages> = { en, pl }
