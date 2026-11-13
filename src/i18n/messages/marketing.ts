import type { Dictionary } from '../context'
import type { Plural } from '../format'

const en = {
  hero: {
    title: 'Code reviews ate your sprint. Now you can prove it.',
    lead: 'Splits is the time tracker built for developers. Start a timer in one click, log a review with a right-click, jot down what you actually did, and finish every sprint with story points and hours for each kind of work.',
    primaryCta: 'Start tracking free',
    videoCta: 'Watch the video, 28s',
    note: 'Free forever. No credit card. Ready in under a minute.',
    demoHint:
      'This demo is live. Stop the timer or add an entry from a template.',
  },
  heroVisual: {
    label:
      'A running timer for PAY-142, a right-click menu on Code review with 15 minutes, 30 minutes, 1 hour, a custom time and Start timer now, and a copied task summary.',
    timerTitle: 'PAY-142 Payment gateway integration',
    stop: 'Stop',
    log: 'Log {time}',
    custom: 'Custom duration…',
    timer: 'Start timer now',
    summaryTitle: 'Summary copied',
    summaryText:
      'Total time on PAY-142: 5h 55m (3 sessions, 3 days, 3 SP). Why: signature check, clock-skew bug in tests, retries after review.',
  },
  pains: {
    title: 'Your board shows tickets. Your day was so much more.',
    items: [
      {
        title: 'Stand-ups from memory',
        problem:
          '“Yesterday I… reviewed something?” Your brain is not a timesheet.',
        fix: 'Every entry has a type, a time and your notes. Yesterday is one glance away.',
      },
      {
        title: 'Invisible work',
        problem:
          'Hotfixes, reviews and calls never get a card, so they never get credit.',
        fix: 'Code reviews, pairing and extra work earn story points and show up in the sprint.',
      },
      {
        title: 'Friday-afternoon timesheets',
        problem: 'You rebuild the whole week from Slack history and guesswork.',
        fix: 'Start a timer when you start and stop it when you’re done. Nothing to reconstruct.',
      },
    ],
  },
  video: {
    title: 'See a workday with Splits',
    lead: 'A code review template, the timer, the entry form and the sprint summary in 28 seconds. It works without sound.',
    play: 'Watch the video, 28s',
    playSuffix: ': Splits in 28 seconds',
    transcriptToggle: 'What’s in the video',
    captionsLabel: 'English',
    name: 'Splits in 28 seconds',
    description:
      'A short video showing how Splits logs a developer’s time: a one-click code review template, the timer, an entry form that adapts to the type of work and a sprint summary with story points and hours.',
    transcript: [
      'Friday retro. How much time went into code reviews? Nobody remembers.',
      'Splits, time tracking for developers.',
      'Log an entry in three seconds: click the 25-minute code review template and it appears on your day’s timeline. Stop the timer and the entry saves itself.',
      'A form that fits the work: a code review is a merge request link and a duration, pair programming is a title and a duration.',
      'End of the sprint: 37 story points and 70 hours, split into tasks, code reviews, pair programming, extra work and meetings.',
      'Start your next sprint with the full picture. Create a free account, no credit card needed.',
    ],
  },
  form: {
    title: 'A form that knows what you’re working on',
    lead: 'A code review needs a merge request link. Pairing needs a title. A task needs story points. Pick the kind of work and the form shows exactly what it needs, plus room for notes on what you actually did.',
    points: [
      {
        title: 'Right-click to log',
        text: 'Right-click any kind of work, pick 15 minutes, an hour or your own time, type a title, done.',
      },
      {
        title: 'Notes that write your summary',
        text: 'Jot down decisions and blockers. Splits turns them into a ready-to-paste task summary for Jira or stand-up.',
      },
      {
        title: 'Links recognized automatically',
        text: 'Paste a URL and Splits pulls out PAY-142 or !481.',
      },
    ],
  },
  sprints: {
    title: 'Code reviews finally count',
    lead: 'Every entry earns story points on your own scale, so the sprint shows all the work you did, not just the tickets. Set the scale the way your team estimates.',
    scaleCaption: 'The default scale. Change it in settings.',
    points: [
      {
        title: 'Sprints that create themselves',
        text: 'Pick a length and a start day. New sprints appear on schedule and every entry lands in the right one.',
      },
      {
        title: 'Reports without spreadsheets',
        text: 'Time per day, sprint, month and task. See what reviews and meetings really cost.',
      },
      {
        title: 'Facts, not judgement',
        text: 'Story points and real hours, side by side. No productivity scores, no one watching.',
      },
    ],
  },
  speed: {
    title: 'Faster than opening your timesheet',
    items: [
      {
        keys: ['Right-click'],
        title: 'Quick log from any type',
        text: 'Right-click a kind of work, pick a duration, type a title. Saved.',
      },
      {
        keys: ['Alt', '1'],
        title: 'Templates on shortcuts',
        text: 'Stand-up, refinement, your usual review: up to 9 templates on Alt+1…9.',
      },
      {
        keys: ['▶ Start'],
        title: 'A timer with no end time',
        text: 'Start it now, stop it from any page when you’re done. The entry saves itself.',
      },
    ],
  },
  steps: {
    title: 'Up and running in a minute',
    items: [
      {
        title: 'Create an account',
        text: 'Work types, statuses and a story point scale come ready out of the box.',
      },
      {
        title: 'Pick your sprint',
        text: 'One, two or three weeks. Sprints appear on schedule.',
      },
      {
        title: 'Hit start',
        text: 'Timer, right-click or template. Your day builds itself.',
      },
    ],
  },
  pricing: {
    title: 'Free for your daily grind. Pro for the price of one lunch a year',
    lead: 'Log, time and summarize your work for free, forever. Go Pro when you want every sprint, every export and no limits. One payment a year, nothing monthly.',
    pageTitle: 'Pricing',
    pageSeoTitle: 'Splits pricing: Free and Pro, billed yearly',
    pageSeoDescription:
      'Use Splits free forever, or go Pro for $24 a year (that’s $2 a month), paid once a year. Team plan for whole teams is coming soon. Full refund within 14 days.',
    badges: { pro: 'Most popular', team: 'Coming soon' },
    perMonthYearly: 'That’s {price} a month, paid once a year',
    perSeat: 'per person, per year',
    period: { forever: 'forever', year: 'per year' },
    cta: {
      free: 'Create free account',
      pro: 'Get Pro for a year',
      team: 'Join the waitlist',
    },
    teamMail: 'Team plan waitlist',
    note: 'Prices in USD, including VAT where it applies. Paid yearly by card through Stripe. Full refund within 14 days, cancel renewal anytime in settings.',
    features: {
      free: [
        'Unlimited entries, timer and notes',
        'Code reviews, pairing, meetings, extra work',
        'Sprints and your own story point scale',
        'Task summaries from your template',
        'Reports for the last 30 days',
        'Up to 3 custom work types',
      ],
      pro: [
        'Everything in Free',
        'Full history: every sprint, month and task',
        'Sprint analytics: SP vs hours per kind of work',
        'CSV export for invoices and reviews',
        'Unlimited work types, statuses and templates',
        'Priority email support',
      ],
      team: [
        'Everything in Pro for every person',
        'Team reports: time and SP per person and sprint',
        'Jira worklog sync and GitLab / GitHub reviews',
        'Timesheet approvals and one invoice for the team',
      ],
    },
  },
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'Is the Free plan really free?',
        a: 'Yes, with no time limit and no credit card. You get time logging, the timer, sprints and story points. Pro unlocks full report history, CSV export and unlimited custom types.',
      },
      {
        q: 'Does Splits replace Jira or GitLab?',
        a: 'No. Your tasks stay in your tracker. In Splits you paste a ticket or merge request link and log how long you spent on it.',
      },
      {
        q: 'My team counts story points differently. Can I change that?',
        a: 'Yes. You set the scale yourself: each story point value has its own time limit, for example 2 SP up to 2 hours and 3 SP up to 4 hours. Code reviews and meetings can have story points too.',
      },
      {
        q: 'Is it a tool for the whole team?',
        a: 'Splits is personal. Everyone has their own account and their own stats. Nobody watches your day.',
      },
      {
        q: 'Can I use it to bill clients for my hours?',
        a: 'Yes. You see time per task, day and month, and on the Pro plan you can export it to CSV and attach it to an invoice.',
      },
      {
        q: 'Can I start a timer and fill in the details later?',
        a: 'Yes. Start a timer with just a title, or set the time you actually started. Stop it from any page when you’re done, then add notes whenever you like.',
      },
      {
        q: 'What are task summaries?',
        a: 'Write a template once, for example “Total time on {task}: {total}. Why: {notes}”. Splits fills it in from every entry on that task, ready to paste into Jira, a pull request or your stand-up.',
      },
      {
        q: 'Does it work on my phone?',
        a: 'Yes. Splits runs in the browser on desktop and mobile. There’s nothing to install.',
      },
      {
        q: 'Why only yearly billing?',
        a: 'One payment a year keeps the price low: card fees on small monthly charges would eat a big part of it. You get a full refund within 14 days, and you can turn off renewal anytime in settings.',
      },
      {
        q: 'Can I export or delete my data?',
        a: 'Yes. CSV export is part of Pro, and deleting your account removes all your entries, tasks and settings.',
      },
    ],
  },
  finalCta: {
    title: 'Next retro, bring receipts.',
    button: 'Start tracking free',
    note: 'Free forever. No credit card. Ready in under a minute.',
  },
  demo: {
    yourDay: 'Your day',
    logged: 'Logged',
    ofTarget: '{logged} of {target}',
    timerRunning: 'Timer running',
    timerStopped: 'Timer stopped, entry saved',
    stopTimer: 'Stop the timer and save the entry',
    startTimer: 'Start the timer again',
    templatesHint: 'Quick templates: one click and the entry is in',
    clear: 'Clear demo',
    dayFull: 'The day is full. Stop the timer or clear the demo.',
    spToday: 'Story points today',
    summary: 'Daily summary',
    timelineLabel:
      'Day timeline from 9:00 to 17:00: {count}, {total} in total.',
    entries: { one: '{n} entry', other: '{n} entries' } as Plural,
    titles: {
      standup: 'Daily stand-up',
      payment: 'PAY-142 Payment gateway integration',
      cr481: 'CR !481 Refund form validation',
      pair: 'Queue migration with Kate',
      hotfix: 'Fix staging certificate',
      cr486: 'CR !486 Webhook retries',
      refinement: 'Refinement',
      e2e: 'Debugging E2E tests',
    },
  },
  formDemo: {
    tabsLabel: 'Type of work',
    required: '(required)',
    save: 'Save entry',
    storyPoints: 'Story points',
    duration: 'Duration',
    start: 'Start',
    end: 'End',
    notes: {
      task: 'A full entry: ticket link, story points, start and end time, and an optional description.',
      code_review:
        'Paste the merge request link and enter the time. Splits recognizes !481 on its own.',
      pair_programming: 'A session title and the time. That’s all.',
      additional_work:
        'Everything that eats time outside tickets: hotfixes, support, onboarding.',
      custom:
        'Add your own type in settings and decide which fields are required.',
    },
    fields: {
      title: 'Title',
      taskLink: 'Link to task',
      mrLink: 'Merge request link',
      description: 'Notes (optional)',
      typeName: 'Type name',
    },
    values: {
      taskTitle: 'Payment gateway integration',
      description: 'Callback handling and retries.',
      pairTitle: 'Queue migration with Kate',
      extraTitle: 'Fix staging certificate',
      customTitle: 'On-call duty',
    },
    customTab: 'Your type',
    toggles: [
      ['Link', 'optional'],
      ['Notes', 'optional'],
      ['Time', 'start–end'],
      ['Default SP', '1'],
    ],
  },
  sprintDemo: {
    name: 'Sprint 14',
    workingDays: '10 working days',
    completed: 'Completed',
    logged: 'Time logged',
    breakdownLabel: 'Sprint time split by type of work',
    headers: {
      type: 'Type of work',
      entries: 'Entries',
      sp: 'SP',
      time: 'Time',
    },
    upTo: 'up to {time}',
  },
}

export type MarketingMessages = typeof en

const pl: MarketingMessages = {
  hero: {
    title: 'Code review zjadło Ci sprint. Teraz to udowodnisz.',
    lead: 'Splits to time tracker zrobiony dla programistów. Timer jednym kliknięciem, wpis z code review prawym przyciskiem, notatka o tym, co naprawdę zrobiłeś, a na koniec sprintu story pointy i godziny dla każdego rodzaju pracy.',
    primaryCta: 'Zacznij za darmo',
    videoCta: 'Zobacz film, 28 s',
    note: 'Za darmo na zawsze. Bez karty. Gotowe w minutę.',
    demoHint:
      'To demo działa naprawdę. Zatrzymaj timer albo dodaj wpis z szablonu.',
  },
  heroVisual: {
    label:
      'Działający timer dla PAY-142, menu prawego przycisku na Code Review z opcjami 15 minut, 30 minut, 1 godzina, własny czas i uruchom timer, oraz skopiowane podsumowanie zadania.',
    timerTitle: 'PAY-142 Integracja bramki płatności',
    stop: 'Stop',
    log: 'Zapisz {time}',
    custom: 'Własny czas…',
    timer: 'Uruchom timer teraz',
    summaryTitle: 'Podsumowanie skopiowane',
    summaryText:
      'Łączny czas na PAY-142: 5 h 55 min (3 sesje, 3 dni, 3 SP). Dlaczego: weryfikacja podpisu, błąd zegara w testach, poprawki po review.',
  },
  pains: {
    title: 'Tablica pokazuje tickety. Twój dzień to dużo więcej.',
    items: [
      {
        title: 'Daily z pamięci',
        problem:
          '„Wczoraj… chyba robiłem review?” Twoja głowa to nie timesheet.',
        fix: 'Każdy wpis ma typ, czas i Twoje notatki. Wczorajszy dzień widzisz w sekundę.',
      },
      {
        title: 'Niewidzialna praca',
        problem:
          'Hotfixy, review i calle nie mają kart, więc nikt ich nie widzi.',
        fix: 'Code Review, pairing i prace dodatkowe dostają story pointy i liczą się do sprintu.',
      },
      {
        title: 'Timesheet w piątek po południu',
        problem: 'Odtwarzasz cały tydzień ze Slacka i na wyczucie.',
        fix: 'Startujesz timer, gdy zaczynasz, zatrzymujesz, gdy kończysz. Nic do odtwarzania.',
      },
    ],
  },
  video: {
    title: 'Zobacz, jak wygląda dzień ze Splits',
    lead: 'Szablon Code Review, timer, formularz i podsumowanie sprintu w 28 sekund. Film działa bez dźwięku.',
    play: 'Obejrzyj film, 28 s',
    playSuffix: ': Splits w 28 sekund',
    transcriptToggle: 'Co jest w filmie',
    captionsLabel: 'Polski',
    name: 'Splits w 28 sekund',
    description:
      'Krótki film o tym, jak Splits notuje czas pracy programisty: szablon Code Review jednym kliknięciem, timer, formularz dopasowany do rodzaju pracy i podsumowanie sprintu ze story pointami i godzinami.',
    transcript: [
      'Piątek, retro. Ile czasu zjadły Code Review? Nikt nie pamięta.',
      'Splits, time tracker dla programistów.',
      'Wpis w trzy sekundy: klikasz szablon Code Review, 25 minut, i wpis pojawia się na osi dnia. Zatrzymujesz timer i wpis zapisuje się sam.',
      'Formularz dopasowany do pracy: Code Review to link do merge requesta i czas, pair programming to tytuł i czas.',
      'Koniec sprintu: 37 story pointów i 70 godzin, z podziałem na zadania, Code Review, pair programming, prace dodatkowe i spotkania.',
      'Następny sprint zacznij z pełnym obrazem. Załóż darmowe konto, plan Free bez karty.',
    ],
  },
  form: {
    title: 'Formularz, który wie, nad czym pracujesz',
    lead: 'Code Review potrzebuje linku do MR. Pairing potrzebuje tytułu. Zadanie potrzebuje story pointów. Wybierasz rodzaj pracy, a formularz pokazuje dokładnie to, czego trzeba, plus miejsce na notatki o tym, co naprawdę zrobiłeś.',
    points: [
      {
        title: 'Wpis prawym przyciskiem',
        text: 'Klikasz rodzaj pracy prawym przyciskiem, wybierasz 15 minut, godzinę albo własny czas, wpisujesz tytuł. Gotowe.',
      },
      {
        title: 'Notatki, które piszą podsumowanie',
        text: 'Notujesz decyzje i blokery. Splits robi z nich gotowe do wklejenia podsumowanie zadania do Jiry albo na daily.',
      },
      {
        title: 'Linki rozpoznawane same',
        text: 'Wklejasz URL, Splits wyciąga PAY-142 albo !481.',
      },
    ],
  },
  sprints: {
    title: 'Code Review w końcu się liczy',
    lead: 'Każdy wpis dostaje story pointy z Twojej skali, więc sprint pokazuje całą pracę, a nie tylko tickety. Ustaw skalę tak, jak estymuje Twój zespół.',
    scaleCaption: 'Domyślna skala. Zmienisz ją w ustawieniach.',
    points: [
      {
        title: 'Sprinty, które tworzą się same',
        text: 'Wybierasz długość i dzień startu. Nowe sprinty pojawiają się według harmonogramu, a każdy wpis trafia do właściwego.',
      },
      {
        title: 'Raporty bez arkuszy',
        text: 'Czas per dzień, sprint, miesiąc i zadanie. Widzisz, ile naprawdę kosztują review i spotkania.',
      },
      {
        title: 'Fakty, nie oceny',
        text: 'Story pointy i prawdziwe godziny obok siebie. Bez wskaźników produktywności i bez podglądania.',
      },
    ],
  },
  speed: {
    title: 'Szybciej niż otwarcie timesheetu',
    items: [
      {
        keys: ['Prawy przycisk'],
        title: 'Szybki wpis z każdego typu',
        text: 'Prawy przycisk na rodzaju pracy, wybierasz czas, wpisujesz tytuł. Zapisane.',
      },
      {
        keys: ['Alt', '1'],
        title: 'Szablony na skrótach',
        text: 'Daily, refinement, typowe review: do 9 szablonów pod Alt+1…9.',
      },
      {
        keys: ['▶ Start'],
        title: 'Timer bez godziny końca',
        text: 'Startujesz teraz, zatrzymujesz z dowolnej strony, gdy skończysz. Wpis zapisuje się sam.',
      },
    ],
  },
  steps: {
    title: 'Gotowe w minutę',
    items: [
      {
        title: 'Załóż konto',
        text: 'Typy pracy, statusy i skala story pointów są gotowe od razu.',
      },
      {
        title: 'Ustaw sprint',
        text: 'Tydzień, dwa albo trzy. Sprinty pojawiają się według harmonogramu.',
      },
      {
        title: 'Kliknij start',
        text: 'Timer, prawy przycisk albo szablon. Dzień układa się sam.',
      },
    ],
  },
  pricing: {
    title: 'Za darmo na co dzień. Pro w cenie jednego lunchu na rok',
    lead: 'Loguj, mierz i podsumowuj pracę za darmo, na zawsze. Przejdź na Pro, gdy chcesz każdy sprint, każdy eksport i brak limitów. Jedna płatność w roku, nic co miesiąc.',
    pageTitle: 'Cennik',
    pageSeoTitle: 'Cennik Splits: Free i Pro, płatne rocznie',
    pageSeoDescription:
      'Splits za darmo na zawsze albo Pro za 24 $ rocznie (2 $ miesięcznie), płatne raz w roku. Plan Team dla całych zespołów już wkrótce. Pełny zwrot w ciągu 14 dni.',
    badges: { pro: 'Najczęściej wybierany', team: 'Wkrótce' },
    perMonthYearly: 'To {price} miesięcznie, płatne raz w roku',
    perSeat: 'za osobę, rocznie',
    period: { forever: 'na zawsze', year: 'rocznie' },
    cta: {
      free: 'Załóż darmowe konto',
      pro: 'Kup Pro na rok',
      team: 'Zapisz się na listę',
    },
    teamMail: 'Lista oczekujących na plan Team',
    note: 'Ceny w USD, z VAT, jeśli dotyczy. Płatność kartą raz w roku przez Stripe. Pełny zwrot w ciągu 14 dni, odnowienie wyłączysz w ustawieniach.',
    features: {
      free: [
        'Bez limitu wpisów, timer i notatki',
        'Code review, pair programming, spotkania, prace dodatkowe',
        'Sprinty i własna skala story pointów',
        'Podsumowania zadań z Twojego szablonu',
        'Raporty z ostatnich 30 dni',
        'Do 3 własnych rodzajów pracy',
      ],
      pro: [
        'Wszystko z Free',
        'Pełna historia: każdy sprint, miesiąc i zadanie',
        'Analityka sprintu: SP a godziny per rodzaj pracy',
        'Eksport do CSV do faktur i ocen okresowych',
        'Bez limitu rodzajów pracy, statusów i szablonów',
        'Priorytetowe wsparcie mailowe',
      ],
      team: [
        'Wszystko z Pro dla każdej osoby',
        'Raporty zespołu: czas i SP per osoba i sprint',
        'Synchronizacja worklogów z Jirą i review z GitLaba / GitHuba',
        'Zatwierdzanie timesheetów i jedna faktura za zespół',
      ],
    },
  },
  faq: {
    title: 'Pytania',
    items: [
      {
        q: 'Czy plan Free jest naprawdę darmowy?',
        a: 'Tak, bez limitu czasu i bez karty. Notujesz czas, korzystasz z timera, sprintów i story pointów. Pro odblokowuje pełną historię raportów, eksport CSV i nielimitowane własne typy.',
      },
      {
        q: 'Czy Splits zastępuje Jirę albo GitLaba?',
        a: 'Nie. Zadania nadal żyją w Twoim trackerze. W Splits wklejasz link do ticketu lub merge requesta i notujesz, ile czasu na nim spędziłeś.',
      },
      {
        q: 'Mój zespół liczy story pointy inaczej. Da się to ustawić?',
        a: 'Tak. Skalę ustawiasz sam: każda wartość SP ma swój limit czasu, np. 2 SP do 2 godzin, 3 SP do 4 godzin. Code Review i spotkania też mogą mieć story pointy.',
      },
      {
        q: 'Czy to narzędzie dla całego zespołu?',
        a: 'Splits jest osobisty: każdy prowadzi własne konto i własne statystyki. Nikt nie podgląda Twojego dnia.',
      },
      {
        q: 'Nadaje się do rozliczania godzin z klientem?',
        a: 'Tak. Widzisz czas per zadanie, dzień i miesiąc, a w planie Pro eksportujesz go do CSV i dołączasz do faktury.',
      },
      {
        q: 'Mogę uruchomić timer i uzupełnić szczegóły później?',
        a: 'Tak. Startujesz timer z samym tytułem albo z godziną, o której faktycznie zacząłeś. Zatrzymujesz go z dowolnej strony, a notatki dopisujesz, kiedy chcesz.',
      },
      {
        q: 'Czym są podsumowania zadań?',
        a: 'Piszesz szablon raz, np. „Łączny czas na {task}: {total}. Dlaczego: {notes}”. Splits wypełnia go ze wszystkich wpisów zadania, gotowy do wklejenia w Jirę, pull request albo na daily.',
      },
      {
        q: 'Działa na telefonie?',
        a: 'Tak. Splits działa w przeglądarce na komputerze i telefonie, bez instalowania aplikacji.',
      },
      {
        q: 'Dlaczego tylko płatność roczna?',
        a: 'Jedna płatność w roku pozwala trzymać niską cenę: prowizje od małych płatności co miesiąc zjadłyby jej sporą część. Masz pełny zwrot w ciągu 14 dni, a odnowienie wyłączysz w ustawieniach w każdej chwili.',
      },
      {
        q: 'Czy mogę wyeksportować albo usunąć swoje dane?',
        a: 'Tak. Eksport do CSV jest w planie Pro, a usunięcie konta kasuje wszystkie Twoje wpisy, zadania i ustawienia.',
      },
    ],
  },
  finalCta: {
    title: 'Na następne retro przyjdź z dowodami.',
    button: 'Zacznij za darmo',
    note: 'Za darmo na zawsze. Bez karty. Gotowe w minutę.',
  },
  demo: {
    yourDay: 'Twój dzień',
    logged: 'Zalogowane',
    ofTarget: '{logged} z {target}',
    timerRunning: 'Timer działa',
    timerStopped: 'Timer zatrzymany, wpis zapisany na osi',
    stopTimer: 'Zatrzymaj timer i zapisz wpis',
    startTimer: 'Uruchom timer od nowa',
    templatesHint: 'Szybkie szablony: jeden klik i wpis gotowy',
    clear: 'Wyczyść demo',
    dayFull: 'Dzień pełny. Zatrzymaj timer albo wyczyść demo.',
    spToday: 'Story pointy dziś',
    summary: 'Podsumowanie dnia',
    timelineLabel: 'Oś dnia od 9:00 do 17:00: {count}, łącznie {total}.',
    entries: {
      one: '{n} wpis',
      few: '{n} wpisy',
      many: '{n} wpisów',
      other: '{n} wpisu',
    },
    titles: {
      standup: 'Daily',
      payment: 'PAY-142 Integracja bramki płatności',
      cr481: 'CR !481 Walidacja formularza zwrotów',
      pair: 'Migracja kolejek z Kasią',
      hotfix: 'Hotfix certyfikatu na stagingu',
      cr486: 'CR !486 Retry webhooków',
      refinement: 'Refinement',
      e2e: 'Debugowanie testów E2E',
    },
  },
  formDemo: {
    tabsLabel: 'Typ pracy',
    required: '(wymagane)',
    save: 'Zapisz wpis',
    storyPoints: 'Story pointy',
    duration: 'Czas',
    start: 'Start',
    end: 'Koniec',
    notes: {
      task: 'Pełny wpis: link do ticketu, story pointy, godziny od–do i opcjonalny opis.',
      code_review:
        'Wklejasz link do merge requesta i wpisujesz czas. Numer !481 rozpoznajemy sami.',
      pair_programming: 'Tytuł sesji i czas. Nic więcej nie trzeba.',
      additional_work:
        'Wszystko, co zjada czas poza ticketami: hotfixy, wsparcie, onboarding.',
      custom:
        'Dodajesz własny typ w ustawieniach i decydujesz, które pola są wymagane.',
    },
    fields: {
      title: 'Tytuł',
      taskLink: 'Link do zadania',
      mrLink: 'Link do MR',
      description: 'Notatki (opcjonalnie)',
      typeName: 'Nazwa typu',
    },
    values: {
      taskTitle: 'Integracja bramki płatności',
      description: 'Obsługa callbacków i retry.',
      pairTitle: 'Migracja kolejek z Kasią',
      extraTitle: 'Hotfix certyfikatu na stagingu',
      customTitle: 'Dyżur produkcyjny',
    },
    customTab: 'Twój typ',
    toggles: [
      ['Link', 'opcjonalny'],
      ['Notatki', 'opcjonalne'],
      ['Czas', 'od–do'],
      ['Domyślne SP', '1'],
    ],
  },
  sprintDemo: {
    name: 'Sprint 14',
    workingDays: '10 dni roboczych',
    completed: 'Ukończone',
    logged: 'Zalogowany czas',
    breakdownLabel: 'Podział czasu sprintu na rodzaje pracy',
    headers: { type: 'Rodzaj pracy', entries: 'Wpisy', sp: 'SP', time: 'Czas' },
    upTo: 'do {time}',
  },
}

export const marketingMessages: Dictionary<MarketingMessages> = { en, pl }
