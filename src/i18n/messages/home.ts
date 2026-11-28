import type { Dictionary } from '../context'

/** Teksty strony głównej (hero, kroki, końcowe wezwanie). Cennik, film i FAQ są w marketing.ts. */
const en = {
  nav: { demo: 'Live demo', start: 'Start free' },
  hero: {
    title: 'Where did the sprint go?',
    lead: 'Timeblame splits every sprint into tasks, code review, pairing and meetings, so you see where the hours went and what a story point really costs.',
    primary: 'Start free',
    demo: 'Try the live demo',
    note: 'Free plan, no card needed. The demo opens without signing up.',
  },
  product: {
    alt: 'The Today screen in Timeblame: time logged against the daily target, planned meetings, quick templates, an unfinished task to pick up and the day’s entries.',
  },
  split: {
    label:
      'One sprint, 80 hours. A regular tracker shows a single block called Development. Timeblame shows 38 hours of tasks, 17 of code review, 11 of pairing, 9 of meetings and 5 of extra work, which is 2.4 hours per story point.',
    sprint: 'Sprint 14',
    total: '80 h, 34 story points',
    before: 'Development, 80 h',
    perSp: '2.4 h',
    perSpLabel: 'per story point',
    rows: [
      { kind: 'task', hours: '38 h', share: '48%' },
      { kind: 'code_review', hours: '17 h', share: '21%' },
      { kind: 'pair_programming', hours: '11 h', share: '14%' },
      { kind: 'meeting', hours: '9 h', share: '11%' },
      { kind: 'additional_work', hours: '5 h', share: '6%' },
    ],
  },
  how: {
    title: 'Three things Timeblame does for you',
    steps: [
      {
        title: 'Log work in seconds',
        text: 'Pick the kind of work and the form asks only for what it needs: a merge request link for a review, story points for a task. Or start a timer and forget about it.',
        points: [
          'One-tap templates for stand-ups and reviews',
          'Paste a link and the ticket number fills itself in',
          'Forgot the timer? Add the entry afterwards',
        ],
      },
      {
        title: 'Get interrupted without losing the thread',
        text: 'Production is down in the middle of a ticket. Pause, fix it, come back. Timeblame keeps both stretches of the task and the hotfix between them.',
        points: [
          'Pause and resume from any page',
          'Every interval saved with its start and end',
          'Unplanned work gets its own type, so it shows in the sprint',
        ],
      },
      {
        title: 'Finish with numbers you can show',
        text: 'A report per ticket with story points and hours, ready for the sprint review or your client. If you bill by the hour, the timesheet for your invoice is one click.',
        points: [
          'Hours per story point, sprint after sprint',
          'CSV export for invoices',
          'A task summary ready to paste into Jira',
        ],
      },
    ],
  },
  intervals: {
    label:
      'A morning on a timeline: PAY-142 from 6:40 to 7:20, a hotfix from 7:20 to 8:50, then PAY-142 again from 9:00 to 10:00.',
    task: 'PAY-142 Payment gateway',
    hotfix: 'Hotfix: checkout 500',
    taskTotal: '1 h 40 min in 2 intervals',
    hotfixTotal: '1 h 30 min',
    paused: 'paused',
    resumed: 'resumed',
    times: ['6:40', '7:20', '8:50', '9:00', '10:00'],
  },
  timesheet: {
    label:
      'A report for October 2026 by ticket: PAY-151 8 story points and 34.5 hours, PAY-142 5 and 21.5, PAY-139 3 and 14, code reviews 18.5 hours, meetings 12 hours. Total 152 hours. Export CSV.',
    month: 'October 2026',
    by: 'by ticket',
    export: 'Export CSV',
    ticket: 'Ticket',
    sp: 'SP',
    hours: 'Hours',
    rows: [
      ['PAY-151 Invoice PDF', '8', '34.5'],
      ['PAY-142 Payment gateway', '5', '21.5'],
      ['PAY-139 Refund API', '3', '14.0'],
      ['Code reviews', '–', '18.5'],
      ['Meetings', '–', '12.0'],
    ],
    total: 'Total',
    totalHours: '152.0 h',
  },
  pricing: {
    title: 'Free to try. $6 a month when you want it all.',
    lead: 'Free gives you a taste with no time limit. Pro removes every limit, monthly or yearly with 2 months free, and you get a full refund within 14 days.',
  },
  final: {
    title: 'Start your next sprint with the full picture.',
    note: 'Free forever. Ready in under a minute.',
    primary: 'Create a free account',
    demo: 'Try the live demo',
  },
}

export type HomeMessages = typeof en

const pl: HomeMessages = {
  nav: { demo: 'Demo na żywo', start: 'Zacznij za darmo' },
  hero: {
    title: 'Gdzie się podział ten sprint?',
    lead: 'Timeblame rozbija każdy sprint na taski, code review, pairing i spotkania, więc widzisz, gdzie poszły godziny i ile naprawdę kosztuje story point.',
    primary: 'Zacznij za darmo',
    demo: 'Wypróbuj demo',
    note: 'Plan darmowy, bez karty. Demo otwiera się bez rejestracji.',
  },
  product: {
    alt: 'Ekran Dziś w Timeblame: czas względem dziennego celu, zaplanowane spotkania, szybkie szablony, niedokończone zadanie do podjęcia i wpisy z dnia.',
  },
  split: {
    label:
      'Jeden sprint, 80 godzin. Zwykły tracker pokazuje jeden blok „Programowanie”. Timeblame pokazuje 38 godzin tasków, 17 code review, 11 pair programmingu, 9 spotkań i 5 pracy extra, czyli 2,4 godziny na story point.',
    sprint: 'Sprint 14',
    total: '80 h, 34 story pointy',
    before: 'Programowanie, 80 h',
    perSp: '2,4 h',
    perSpLabel: 'na story point',
    rows: [
      { kind: 'task', hours: '38 h', share: '48%' },
      { kind: 'code_review', hours: '17 h', share: '21%' },
      { kind: 'pair_programming', hours: '11 h', share: '14%' },
      { kind: 'meeting', hours: '9 h', share: '11%' },
      { kind: 'additional_work', hours: '5 h', share: '6%' },
    ],
  },
  how: {
    title: 'Trzy rzeczy, które Timeblame robi za Ciebie',
    steps: [
      {
        title: 'Wpis w kilka sekund',
        text: 'Wybierasz typ pracy, a formularz pyta tylko o to, czego potrzeba: link do MR przy review, story pointy przy tasku. Albo włączasz timer i o nim zapominasz.',
        points: [
          'Szablony jednym kliknięciem na daily i review',
          'Wklejasz link, numer ticketu wpisuje się sam',
          'Zapomniałeś timera? Dodasz wpis po fakcie',
        ],
      },
      {
        title: 'Przerwane zadanie niczego nie gubi',
        text: 'Produkcja leży w środku ticketu. Pauza, hotfix, powrót. Timeblame zapisuje oba odcinki zadania i hotfix pomiędzy nimi.',
        points: [
          'Pauza i wznowienie z każdej strony',
          'Każdy interwał zapisany z godziną startu i końca',
          'Praca spoza planu ma własny typ, więc widać ją w sprincie',
        ],
      },
      {
        title: 'Na koniec liczby, które można pokazać',
        text: 'Raport per ticket ze story pointami i godzinami, gotowy na review sprintu albo dla klienta. Jeśli rozliczasz się godzinowo, zestawienie do faktury to jedno kliknięcie.',
        points: [
          'Godziny na story point, sprint po sprincie',
          'Eksport CSV do faktury',
          'Podsumowanie zadania gotowe do wklejenia w Jirze',
        ],
      },
    ],
  },
  intervals: {
    label:
      'Poranek na osi czasu: PAY-142 od 6:40 do 7:20, hotfix od 7:20 do 8:50, potem znowu PAY-142 od 9:00 do 10:00.',
    task: 'PAY-142 Integracja bramki',
    hotfix: 'Hotfix: checkout 500',
    taskTotal: '1 h 40 min w 2 interwałach',
    hotfixTotal: '1 h 30 min',
    paused: 'pauza',
    resumed: 'powrót',
    times: ['6:40', '7:20', '8:50', '9:00', '10:00'],
  },
  timesheet: {
    label:
      'Raport za październik 2026 per ticket: PAY-151 8 story pointów i 34,5 godziny, PAY-142 5 i 21,5, PAY-139 3 i 14, code review 18,5 godziny, spotkania 12 godzin. Razem 152 godziny. Eksport CSV.',
    month: 'Październik 2026',
    by: 'per ticket',
    export: 'Eksport CSV',
    ticket: 'Ticket',
    sp: 'SP',
    hours: 'Godziny',
    rows: [
      ['PAY-151 Faktura PDF', '8', '34,5'],
      ['PAY-142 Bramka płatności', '5', '21,5'],
      ['PAY-139 API zwrotów', '3', '14,0'],
      ['Code review', '–', '18,5'],
      ['Spotkania', '–', '12,0'],
    ],
    total: 'Razem',
    totalHours: '152,0 h',
  },
  pricing: {
    title: 'Wypróbuj za darmo. 6 $ miesięcznie, gdy chcesz wszystko.',
    lead: 'Free to przedsmak bez limitu czasu. Pro zdejmuje wszystkie limity, miesięcznie albo rocznie z 2 miesiącami gratis, a pełny zwrot dostajesz w ciągu 14 dni.',
  },
  final: {
    title: 'Zacznij kolejny sprint z pełnym obrazem.',
    note: 'Za darmo na zawsze. Gotowe w niecałą minutę.',
    primary: 'Załóż darmowe konto',
    demo: 'Wypróbuj demo',
  },
}

export const homeMessages: Dictionary<HomeMessages> = { en, pl }
