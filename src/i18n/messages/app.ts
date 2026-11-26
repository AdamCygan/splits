import type { Dictionary } from '../context'

const en = {
  nav: {
    label: 'Main navigation',
    today: 'Today',
    tasks: 'Tasks',
    sprints: 'Sprints',
    reports: 'Reports',
    settings: 'Settings',
    logout: 'Log out',
    account: 'Your account',
  },
  menu: {
    open: 'Account menu',
    settings: 'Account settings',
    theme: 'Theme',
    themes: { system: 'Match system', light: 'Light', dark: 'Dark' },
    language: 'Language',
    commands: 'Search and commands',
  },
  actions: {
    save: 'Save changes',
    saving: 'Saving…',
    discard: 'Discard',
    cancel: 'Cancel',
    close: 'Close',
    edit: 'Edit',
    delete: 'Delete',
    archive: 'Archive',
    restore: 'Restore',
    add: 'Add',
    moveUp: 'Move up',
    moveDown: 'Move down',
    retry: 'Try again',
  },
  status: {
    saved: 'Changes saved',
    unsaved: 'You have unsaved changes',
    loading: 'Loading…',
    loadFailed: 'We couldn’t load this section.',
    required: '(required)',
    optional: '(optional)',
  },
  placeholders: {
    soon: 'Coming next',
    today: {
      title: 'Today',
      text: 'Your day on one timeline: a quick entry form, the timer, today’s entries and progress toward your daily target.',
    },
    tasks: {
      title: 'Tasks',
      text: 'All your tasks with filters for work type, status, project and sprint, with story points and total time.',
    },
    sprints: {
      title: 'Sprints',
      text: 'Story points and hours for the current sprint, split by type of work.',
    },
    reports: {
      title: 'Reports',
      text: 'Time per day, week, sprint, month and task, split by type of work, with CSV export.',
    },
    setupCta: 'Set up your workspace',
    setupText:
      'While these screens are on their way, configure sprints, work types and templates in Settings.',
  },
}

export type AppMessages = typeof en

const pl: AppMessages = {
  nav: {
    label: 'Główna nawigacja',
    today: 'Dziś',
    tasks: 'Zadania',
    sprints: 'Sprinty',
    reports: 'Raporty',
    settings: 'Ustawienia',
    logout: 'Wyloguj się',
    account: 'Twoje konto',
  },
  menu: {
    open: 'Menu konta',
    settings: 'Ustawienia konta',
    theme: 'Motyw',
    themes: { system: 'Jak w systemie', light: 'Jasny', dark: 'Ciemny' },
    language: 'Język',
    commands: 'Szukaj i polecenia',
  },
  actions: {
    save: 'Zapisz zmiany',
    saving: 'Zapisywanie…',
    discard: 'Odrzuć',
    cancel: 'Anuluj',
    close: 'Zamknij',
    edit: 'Edytuj',
    delete: 'Usuń',
    archive: 'Archiwizuj',
    restore: 'Przywróć',
    add: 'Dodaj',
    moveUp: 'Przesuń w górę',
    moveDown: 'Przesuń w dół',
    retry: 'Spróbuj ponownie',
  },
  status: {
    saved: 'Zmiany zapisane',
    unsaved: 'Masz niezapisane zmiany',
    loading: 'Ładowanie…',
    loadFailed: 'Nie udało się wczytać tej sekcji.',
    required: '(wymagane)',
    optional: '(opcjonalnie)',
  },
  placeholders: {
    soon: 'Już wkrótce',
    today: {
      title: 'Dziś',
      text: 'Twój dzień na jednej osi: szybki formularz wpisu, timer, dzisiejsze wpisy i postęp względem normy dnia.',
    },
    tasks: {
      title: 'Zadania',
      text: 'Wszystkie zadania z filtrami po typie pracy, statusie, projekcie i sprincie, ze story pointami i łącznym czasem.',
    },
    sprints: {
      title: 'Sprinty',
      text: 'Story pointy i godziny bieżącego sprintu z podziałem na rodzaje pracy.',
    },
    reports: {
      title: 'Raporty',
      text: 'Czas per dzień, tydzień, sprint, miesiąc i zadanie, z podziałem na rodzaje pracy i eksportem CSV.',
    },
    setupCta: 'Skonfiguruj przestrzeń',
    setupText:
      'Zanim te ekrany będą gotowe, ustaw sprinty, typy pracy i szablony w Ustawieniach.',
  },
}

export const appMessages: Dictionary<AppMessages> = { en, pl }
