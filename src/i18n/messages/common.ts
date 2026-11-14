import type { Dictionary } from '../context'

const en = {
  seo: {
    title:
      'Pointhours: time tracking for developers. Tasks, code reviews, sprints',
    description:
      'Log time on tasks, code reviews, pair programming and meetings in seconds. See story points and hours for every kind of work at the end of the sprint. Free plan, no credit card.',
    ogAlt: 'Pointhours: a workday split into tasks, code reviews and meetings',
  },
  nav: {
    video: 'Video',
    features: 'Features',
    sprints: 'Sprints',
    pricing: 'Pricing',
    faq: 'FAQ',
    login: 'Log in',
    signup: 'Sign up free',
    home: 'Pointhours home page',
    footer: 'Footer',
    contact: 'Contact',
  },
  footer: { tagline: 'Developer time, counted honestly.' },
  language: { label: 'Language', change: 'Change language' },
  skipLink: 'Skip to main content',
  loading: 'Loading…',
  notFound: {
    code: 'Error 404',
    title: 'This page doesn’t exist',
    back: 'Go to the home page',
  },
  legal: {
    label: 'Legal',
    terms: 'Terms',
    privacy: 'Privacy',
    cookies: 'Cookies',
    cookieSettings: 'Cookie settings',
    updated: 'Effective from {date} · version {version}',
    contents: 'On this page',
    otherDocs: 'Related documents',
    banner: {
      label: 'Cookie consent',
      title: 'Cookies, briefly',
      text: 'We use necessary cookies to keep you signed in and remember your language. With your consent, we also collect anonymous usage statistics (PostHog, EU servers) to improve {name}. No ads, no cross-site tracking.',
      policy: 'Cookie Policy',
      accept: 'Allow statistics',
      reject: 'Necessary only',
      customize: 'Choose',
      save: 'Save choice',
      necessaryTitle: 'Necessary',
      necessaryText: 'Sign-in, language, security. Always on.',
      analyticsTitle: 'Statistics',
      analyticsText:
        'Anonymous usage data that helps us decide what to build next.',
    },
  },
  workTypes: {
    task: 'Task',
    code_review: 'Code review',
    pair_programming: 'Pair programming',
    additional_work: 'Extra work',
    meeting: 'Meeting',
    custom: 'Custom type',
  },
}

export type CommonMessages = typeof en

const pl: CommonMessages = {
  seo: {
    title:
      'Pointhours: time tracker dla programistów. Zadania, Code Review, sprinty',
    description:
      'Notuj czas na zadaniach, Code Review, pair programmingu i spotkaniach w kilka sekund. Na koniec sprintu zobacz story pointy i godziny dla każdego rodzaju pracy. Plan Free bez karty.',
    ogAlt:
      'Pointhours: dzień pracy podzielony na zadania, Code Review i spotkania',
  },
  nav: {
    video: 'Film',
    features: 'Funkcje',
    sprints: 'Sprinty',
    pricing: 'Cennik',
    faq: 'FAQ',
    login: 'Zaloguj się',
    signup: 'Załóż konto',
    home: 'Pointhours, strona główna',
    footer: 'Stopka',
    contact: 'Kontakt',
  },
  footer: { tagline: 'Czas pracy developera, policzony uczciwie.' },
  language: { label: 'Język', change: 'Zmień język' },
  skipLink: 'Przejdź do treści',
  loading: 'Ładowanie…',
  notFound: {
    code: 'Błąd 404',
    title: 'Nie ma takiej strony',
    back: 'Wróć na stronę główną',
  },
  legal: {
    label: 'Dokumenty prawne',
    terms: 'Regulamin',
    privacy: 'Prywatność',
    cookies: 'Cookies',
    cookieSettings: 'Ustawienia cookies',
    updated: 'Obowiązuje od {date} · wersja {version}',
    contents: 'Na tej stronie',
    otherDocs: 'Powiązane dokumenty',
    banner: {
      label: 'Zgoda na cookies',
      title: 'Krótko o cookies',
      text: 'Niezbędne cookies utrzymują logowanie i zapamiętują język. Za Twoją zgodą zbieramy też anonimowe statystyki korzystania (PostHog, serwery w UE), żeby ulepszać {name}. Bez reklam i śledzenia między stronami.',
      policy: 'Polityka cookies',
      accept: 'Zezwól na statystyki',
      reject: 'Tylko niezbędne',
      customize: 'Wybierz',
      save: 'Zapisz wybór',
      necessaryTitle: 'Niezbędne',
      necessaryText: 'Logowanie, język, bezpieczeństwo. Zawsze włączone.',
      analyticsTitle: 'Statystyki',
      analyticsText:
        'Anonimowe dane o korzystaniu, które pomagają zdecydować, co budować dalej.',
    },
  },
  workTypes: {
    task: 'Zadanie',
    code_review: 'Code Review',
    pair_programming: 'Pair programming',
    additional_work: 'Prace dodatkowe',
    meeting: 'Spotkanie',
    custom: 'Własny typ',
  },
}

export const commonMessages: Dictionary<CommonMessages> = { en, pl }
