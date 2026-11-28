import type { ComponentType } from 'react'
import {
  BarChart3,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  Clock,
  Coffee,
  CreditCard,
  Download,
  Keyboard,
  Languages,
  ListTodo,
  LogOut,
  MessageSquarePlus,
  Moon,
  Pause,
  Play,
  Plus,
  Square,
  Sun,
  SunMoon,
  Timer,
  Zap,
  Briefcase,
} from 'lucide-react'
import type { QuickTemplate } from '#/features/templates/data/dto'
import type { Sprint } from '#/features/sprints/data/dto'
import type { TaskType } from '#/features/task-types/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import type { WorkBreak } from '#/features/breaks/data/dto'
import { parseDateQuery } from '#/shared/domain/date-query'
import { addDays } from '#/shared/domain/dates'
import { taskGroupKey } from '#/features/reports/domain/report'
import { foldText } from '#/shared/domain/text'
import { settingsSections } from '#/features/settings/domain/sections'
import { localeNames, locales } from '#/i18n/config'
import type { Locale } from '#/i18n/config'
import { fmt } from '#/i18n/format'
import type { appMessages } from '#/i18n/messages/app'
import type { settingsMessages } from '#/i18n/messages/settings'
import { clockPrefs } from '#/lib/clock'
import type { ClockPref } from '#/lib/clock'
import type { Theme } from '#/lib/theme'
import { openFeedback } from '#/features/feedback/controllers/open-feedback'

/**
 * Model palety poleceń (M w MVVM): jakie polecenia istnieją, jak pasują do wpisanego
 * tekstu i w jakiej kolejności się pokazują. Bez Reacta: dane i akcje przychodzą
 * w `PaletteContext` z ViewModelu, więc całość da się przetestować jednostkowo.
 */

export type Group =
  | 'timer'
  | 'tasks'
  | 'found'
  | 'create'
  | 'actions'
  | 'days'
  | 'pages'
  | 'settings'
  | 'preferences'
  | 'new'

export const ORDER: ReadonlyArray<Group> = [
  'timer',
  'found',
  'tasks',
  'create',
  'actions',
  'days',
  'pages',
  'settings',
  'preferences',
  // Wpisany tekst jako nowy wpis: na końcu, żeby nie przykrywał trafień.
  'new',
]

export interface Command {
  id: string
  group: Group
  label: string
  hint?: string
  /** Druga linia (np. fragment notatki). */
  detail?: string
  icon: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>
  color?: string
  /** Dodatkowe słowa do wyszukiwania (oba języki), np. „create task, nowy wpis”. */
  keywords?: string
  /** Pokazuj tylko, gdy coś wpisano (ustawienia, preferencje), żeby nie zasypać palety. */
  onlyWhenSearching?: boolean
  run: () => void
  /** Ctrl/⌘+Enter: druga akcja (dla zadań „Kontynuuj”). */
  alt?: () => void
}

/** Synonimy w obu językach, żeby „create task” i „dodaj zadanie” trafiały w to samo. */
export const KEYWORDS = {
  log: 'log time add entry new entry create task new task add task track time record time zapisz czas dodaj wpis nowy wpis utworz zadanie dodaj zadanie nowe zadanie wpisz czas todays entries dzisiejsze wpisy',
  timer:
    'start timer track now stopwatch clock in uruchom timer wlacz timer stoper licz czas start',
  pause: 'pause stop timer break wstrzymaj pauza',
  feedback:
    'report bug problem idea feedback suggestion help support contact zgłoś błąd problem pomysł sugestia pomoc kontakt',
  stop: 'stop timer finish end zatrzymaj zakoncz',
  resume: 'resume continue wznow kontynuuj',
  breakStart: 'break coffee lunch rest przerwa kawa obiad odpoczynek',
  breakEnd: 'end break back to work koniec przerwy wracam',
  template: 'template quick log szablon szybki',
  day: 'day summary yesterday history forgot past dzien podsumowanie wczoraj historia zapomnialem',
  report: 'report analytics stats chart sprint raport statystyki wykres',
  tasks: 'tasks list sprint board zadania lista',
  export: 'export csv download invoice timesheet eksport pobierz faktura',
  dayOff:
    'day off vacation holiday sick leave pto dzien wolny urlop swieto l4 choroba',
  upgrade: 'upgrade pro plan billing pay subscription platnosc subskrypcja kup',
  logout: 'logout log out sign out wyloguj',
  theme: 'theme dark light mode appearance motyw ciemny jasny wyglad',
  clock: 'time format clock 12 24 hour am pm format godziny zegar',
  language: 'language english polish polski angielski jezyk',
  shortcuts: 'keyboard shortcuts hotkeys keys help skroty klawiszowe pomoc',
  workspace:
    'workspace switch job client company employer przestrzen przelacz praca klient firma pracodawca',
}

type AppText = (typeof appMessages)['en']
type SettingsText = (typeof settingsMessages)['en']

/** Wszystko, czego model potrzebuje z aplikacji: dane, teksty, formatowanie i akcje. */
export interface PaletteContext {
  text: AppText
  settingsText: SettingsText
  /** Podpis polecenia „Zgłoś problem albo pomysł”. */
  feedbackLabel: string
  /** Przestrzenie: przełączanie i nowa przestrzeń z palety. */
  workspaces: PaletteWorkspaces
  locale: Locale
  today: string
  isPro: boolean
  running: TimeEntry | null
  paused: ReadonlyArray<TimeEntry>
  runningBreak: WorkBreak | null
  templates: ReadonlyArray<QuickTemplate>
  currentSprint: Sprint | undefined
  typeOf: (id: string) => TaskType | undefined
  formatMinutes: (minutes: number) => string
  formatDay: (date: string) => string
  actions: {
    go: (to: string, search?: Record<string, string>) => void
    pause: (entry: TimeEntry) => void
    stop: (entry: TimeEntry) => void
    resume: (entry: TimeEntry) => void
    startBreak: () => void
    endBreak: (id: string) => void
    setTheme: (theme: Theme) => void
    setClock: (preference: ClockPref) => void
    setLocale: (locale: Locale) => void
    signOut: () => void
    showShortcuts: () => void
    switchWorkspace: (id: string) => void
    newWorkspace: () => void
  }
}

export interface PaletteWorkspace {
  id: string
  name: string
  /** Alt+Shift+cyfra albo null (dziesiąta i dalsze). */
  shortcut: string | null
}

export interface PaletteWorkspaces {
  items: ReadonlyArray<PaletteWorkspace>
  currentId: string | null
  switchLabel: string
  createLabel: string
}

/** Słowa zapytania bez wielkości liter i polskich znaków. */
export const queryWords = (typed: string) =>
  foldText(typed).split(/\s+/).filter(Boolean)

/** Czy polecenie pasuje do zapytania: każde słowo w nazwie, podpowiedzi albo synonimach. */
export function matchesWords(command: Command, words: ReadonlyArray<string>) {
  if (words.length === 0) return !command.onlyWhenSearching
  const hay = foldText(
    `${command.label} ${command.hint ?? ''} ${command.keywords ?? ''}`,
  )
  return words.every((word) => hay.includes(word))
}

/** Wyniki w stałej kolejności grup (ORDER), najwyżej `limit`. */
export const orderResults = (list: ReadonlyArray<Command>, limit = 60) =>
  ORDER.flatMap((group) =>
    list.filter((command) => command.group === group),
  ).slice(0, limit)

/** Stałe polecenia palety: teraz trwa, nowy wpis, akcje, dni, strony, ustawienia, preferencje. */
export function buildCommands(context: PaletteContext): Array<Command> {
  const { text, actions } = context
  const commands = text.commands
  const go = (to: string, search?: Record<string, string>) => () =>
    actions.go(to, search)
  const list: Array<Command> = []

  // Teraz trwa: timer, przerwa i wstrzymane zadania na samej górze.
  const { running, runningBreak } = context
  if (running) {
    list.push(
      {
        id: 'timer-pause',
        group: 'timer',
        label: fmt(commands.pause, { title: running.title }),
        icon: Pause,
        keywords: KEYWORDS.pause,
        run: () => actions.pause(running),
      },
      {
        id: 'timer-stop',
        group: 'timer',
        label: fmt(commands.stop, { title: running.title }),
        icon: Square,
        keywords: KEYWORDS.stop,
        run: () => actions.stop(running),
      },
    )
  }
  if (runningBreak) {
    list.push({
      id: 'break-end',
      group: 'timer',
      label: commands.breakEnd,
      icon: Coffee,
      keywords: KEYWORDS.breakEnd,
      run: () => actions.endBreak(runningBreak.id),
    })
  }
  for (const timeEntry of context.paused) {
    list.push({
      id: `resume-${timeEntry.id}`,
      group: 'timer',
      label: fmt(commands.resume, { title: timeEntry.title }),
      icon: Play,
      keywords: KEYWORDS.resume,
      run: () => actions.resume(timeEntry),
    })
  }

  // Nowy wpis: zawsze pod ręką.
  list.push(
    {
      id: 'log',
      group: 'create',
      label: commands.logTime,
      hint: commands.logTimeHint,
      icon: Plus,
      keywords: KEYWORDS.log,
      run: go('/app', { log: '' }),
    },
    {
      id: 'timer',
      group: 'create',
      label: commands.timer,
      icon: Timer,
      keywords: KEYWORDS.timer,
      run: go('/app', { mode: 'timer' }),
    },
  )
  if (!runningBreak)
    list.push({
      id: 'break',
      group: 'actions',
      label: commands.breakStart,
      icon: Coffee,
      keywords: KEYWORDS.breakStart,
      run: actions.startBreak,
    })
  for (const template of context.templates) {
    const type = context.typeOf(template.taskTypeId)
    list.push({
      id: `tpl-${template.id}`,
      group: 'actions',
      label: fmt(commands.template, { name: template.title }),
      hint: [
        template.defaultDurationMinutes !== null
          ? context.formatMinutes(template.defaultDurationMinutes)
          : commands.templateHint,
        template.hotkey ? `Alt+${template.hotkey}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      icon: Zap,
      color: type?.color,
      keywords: `${KEYWORDS.template} ${type?.name ?? ''}`,
      run: go('/app', { template: template.id }),
    })
  }

  // Dni: wczoraj (po wpisaniu); wpisana data daje swój dzień w `typedCommands`.
  const yesterday = addDays(context.today, -1)
  list.push(
    {
      id: 'yesterday-log',
      group: 'days',
      label: commands.yesterdayLog,
      icon: CalendarDays,
      keywords: KEYWORDS.day,
      onlyWhenSearching: true,
      run: go('/app', { date: yesterday }),
    },
    {
      id: 'yesterday-open',
      group: 'days',
      label: commands.yesterdayOpen,
      icon: CalendarDays,
      keywords: KEYWORDS.day,
      onlyWhenSearching: true,
      run: go('/app/day', { date: yesterday }),
    },
  )

  // Strony.
  const pages: Array<Omit<Command, 'group'>> = [
    {
      id: 'p-today',
      label: text.nav.today,
      icon: Clock,
      keywords: 'today home dzis',
      run: go('/app'),
    },
    {
      id: 'p-tasks',
      label: text.nav.tasks,
      icon: ListTodo,
      keywords: KEYWORDS.tasks,
      run: go('/app/tasks'),
    },
    {
      id: 'p-sprints',
      label: text.nav.sprints,
      icon: CalendarRange,
      keywords: 'sprints sprinty',
      run: go('/app/sprints'),
    },
    {
      id: 'p-reports',
      label: text.nav.reports,
      icon: BarChart3,
      keywords: KEYWORDS.report,
      run: go('/app/analytics'),
    },
  ]
  const sprint = context.currentSprint
  if (sprint) {
    pages.push(
      {
        id: 'sprint-report',
        label: commands.sprintReport,
        hint: sprint.name,
        icon: BarChart3,
        keywords: KEYWORDS.report,
        onlyWhenSearching: true,
        run: go('/app/analytics', { sprint: sprint.id }),
      },
      {
        id: 'sprint-tasks',
        label: commands.sprintTasks,
        hint: sprint.name,
        icon: ListTodo,
        keywords: KEYWORDS.tasks,
        onlyWhenSearching: true,
        run: go('/app/tasks', { sprint: sprint.id }),
      },
    )
  }
  pages.push({
    id: 'export',
    label: commands.export,
    hint: context.isPro ? undefined : 'Pro',
    icon: Download,
    keywords: KEYWORDS.export,
    onlyWhenSearching: true,
    run: go('/app/analytics'),
  })
  list.push(...pages.map((page) => ({ ...page, group: 'pages' as const })))

  // Ustawienia.
  for (const { to, key, icon } of settingsSections) {
    list.push({
      id: `s-${to}`,
      group: 'settings',
      label: context.settingsText.sections[key].title,
      hint: context.settingsText.sections[key].text,
      icon,
      keywords: `settings ustawienia ${key}`,
      onlyWhenSearching: true,
      run: go(to),
    })
  }
  list.push({
    id: 'day-off',
    group: 'settings',
    label: commands.dayOff,
    icon: CalendarOff,
    keywords: KEYWORDS.dayOff,
    onlyWhenSearching: true,
    run: go('/app/settings/days-off'),
  })
  // Przestrzenie: przełączenie na inną i nowa przestrzeń.
  for (const paletteWorkspace of context.workspaces.items) {
    if (paletteWorkspace.id === context.workspaces.currentId) continue
    list.push({
      id: `ws-${paletteWorkspace.id}`,
      group: 'actions',
      label: fmt(context.workspaces.switchLabel, {
        name: paletteWorkspace.name,
      }),
      hint: paletteWorkspace.shortcut ?? undefined,
      icon: Briefcase,
      keywords: KEYWORDS.workspace,
      onlyWhenSearching: true,
      run: () => actions.switchWorkspace(paletteWorkspace.id),
    })
  }
  list.push({
    id: 'ws-new',
    group: 'actions',
    label: context.workspaces.createLabel,
    icon: Briefcase,
    keywords: KEYWORDS.workspace,
    onlyWhenSearching: true,
    run: actions.newWorkspace,
  })
  list.push({
    id: 'feedback',
    group: 'actions',
    label: context.feedbackLabel,
    icon: MessageSquarePlus,
    keywords: KEYWORDS.feedback,
    onlyWhenSearching: true,
    run: () => openFeedback(),
  })
  if (!context.isPro)
    list.push({
      id: 'upgrade',
      group: 'settings',
      label: commands.upgrade,
      icon: CreditCard,
      keywords: KEYWORDS.upgrade,
      onlyWhenSearching: true,
      run: go('/app/settings/plan'),
    })

  // Preferencje.
  const themeIcons = { dark: Moon, light: Sun, system: SunMoon } as const
  for (const tableHeader of ['dark', 'light', 'system'] as const)
    list.push({
      id: `theme-${tableHeader}`,
      group: 'preferences',
      label: `${text.menu.theme}: ${text.menu.themes[tableHeader]}`,
      icon: themeIcons[tableHeader],
      keywords: KEYWORDS.theme,
      onlyWhenSearching: true,
      run: () => actions.setTheme(tableHeader),
    })
  for (const preference of clockPrefs)
    list.push({
      id: `clock-${preference}`,
      group: 'preferences',
      label: fmt(commands.clock, { name: text.menu.clocks[preference] }),
      icon: Clock,
      keywords: KEYWORDS.clock,
      onlyWhenSearching: true,
      run: () => actions.setClock(preference),
    })
  for (const locale of locales.filter(
    (otherLocale) => otherLocale !== context.locale,
  ))
    list.push({
      id: `lang-${locale}`,
      group: 'preferences',
      label: fmt(commands.language, { name: localeNames[locale] }),
      icon: Languages,
      keywords: KEYWORDS.language,
      onlyWhenSearching: true,
      run: () => actions.setLocale(locale),
    })
  list.push(
    {
      id: 'shortcuts',
      group: 'preferences',
      label: commands.shortcuts,
      icon: Keyboard,
      keywords: KEYWORDS.shortcuts,
      onlyWhenSearching: true,
      run: actions.showShortcuts,
    },
    {
      id: 'logout',
      group: 'preferences',
      label: commands.logout,
      icon: LogOut,
      keywords: KEYWORDS.logout,
      onlyWhenSearching: true,
      run: actions.signOut,
    },
  )
  return list
}

export interface TaskCommandMeta {
  minutes?: number
  finished?: boolean
  running?: boolean
  snippet?: string | null
}

/** Zadanie jako polecenie: Enter otwiera stronę zadania, Ctrl+Enter kontynuuje pracę. */
export function taskCommand(
  context: PaletteContext,
  entry: TimeEntry,
  group: Extract<Group, 'tasks' | 'found'>,
  meta: TaskCommandMeta = {},
): Command {
  const commands = context.text.commands
  return {
    id: `t-${taskGroupKey(entry)}`,
    group,
    label: entry.title,
    hint: [
      meta.running
        ? commands.running
        : meta.finished
          ? commands.finished
          : null,
      meta.minutes !== undefined
        ? fmt(commands.taskMeta, {
            date: context.formatDay(entry.workDate),
            time: context.formatMinutes(meta.minutes),
          })
        : context.formatDay(entry.workDate),
    ]
      .filter(Boolean)
      .join(' · '),
    detail: meta.snippet ?? undefined,
    icon: ListTodo,
    color: context.typeOf(entry.taskTypeId)?.color,
    run: () =>
      context.actions.go('/app/task', {
        type: entry.taskTypeId,
        title: entry.title,
        ...(entry.link ? { link: entry.link } : {}),
      }),
    alt: () => context.actions.resume(entry),
  }
}

/** Polecenia z wpisanego tekstu: nowy wpis lub timer z tym tytułem i dzień, gdy to data. */
export function typedCommands(
  context: PaletteContext,
  typed: string,
): Array<Command> {
  if (!typed) return []
  const commands = context.text.commands
  const go = (to: string, search?: Record<string, string>) => () =>
    context.actions.go(to, search)
  const list: Array<Command> = [
    {
      id: 'log-titled',
      group: 'new',
      label: fmt(commands.logTitled, { title: typed }),
      icon: Plus,
      run: go('/app', { log: typed }),
    },
    {
      id: 'timer-titled',
      group: 'new',
      label: fmt(commands.timerTitled, { title: typed }),
      icon: Timer,
      run: go('/app', { log: typed, mode: 'timer' }),
    },
  ]
  const date = parseDateQuery(typed, context.today)
  if (date)
    list.push(
      {
        id: 'date-log',
        group: 'days',
        label: fmt(commands.dayLog, { date: context.formatDay(date) }),
        icon: CalendarDays,
        run: go('/app', date === context.today ? {} : { date }),
      },
      {
        id: 'date-open',
        group: 'days',
        label: fmt(commands.dayOpen, { date: context.formatDay(date) }),
        icon: CalendarDays,
        run: go('/app/day', { date }),
      },
    )
  return list
}
