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
  Moon,
  Pause,
  Play,
  Plus,
  Square,
  Sun,
  SunMoon,
  Timer,
  Zap,
} from 'lucide-react'
import type { QuickTemplate } from '#/features/templates/data/dto'
import type { Sprint } from '#/features/sprints/data/dto'
import type { TaskType } from '#/features/task-types/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import type { WorkBreak } from '#/features/breaks/data/dto'
import { parseDateQuery } from '#/domain/date-query'
import { addDays } from '#/domain/dates'
import { taskGroupKey } from '#/domain/report'
import { foldText } from '#/domain/text'
import { settingsSections } from '#/features/settings/sections'
import { localeNames, locales } from '#/i18n/config'
import type { Locale } from '#/i18n/config'
import { fmt } from '#/i18n/format'
import type { appMessages } from '#/i18n/messages/app'
import type { settingsMessages } from '#/i18n/messages/settings'
import { clockPrefs } from '#/lib/clock'
import type { ClockPref } from '#/lib/clock'
import type { Theme } from '#/lib/theme'

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
export const KW = {
  log: 'log time add entry new entry create task new task add task track time record time zapisz czas dodaj wpis nowy wpis utworz zadanie dodaj zadanie nowe zadanie wpisz czas todays entries dzisiejsze wpisy',
  timer:
    'start timer track now stopwatch clock in uruchom timer wlacz timer stoper licz czas start',
  pause: 'pause stop timer break wstrzymaj pauza',
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
}

type AppText = (typeof appMessages)['en']
type SettingsText = (typeof settingsMessages)['en']

/** Wszystko, czego model potrzebuje z aplikacji: dane, teksty, formatowanie i akcje. */
export interface PaletteContext {
  text: AppText
  settingsText: SettingsText
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
    setClock: (pref: ClockPref) => void
    setLocale: (locale: Locale) => void
    signOut: () => void
    showShortcuts: () => void
  }
}

/** Słowa zapytania bez wielkości liter i polskich znaków. */
export const queryWords = (typed: string) =>
  foldText(typed).split(/\s+/).filter(Boolean)

/** Czy polecenie pasuje do zapytania: każde słowo w nazwie, podpowiedzi albo synonimach. */
export function matchesWords(cmd: Command, words: ReadonlyArray<string>) {
  if (words.length === 0) return !cmd.onlyWhenSearching
  const hay = foldText(`${cmd.label} ${cmd.hint ?? ''} ${cmd.keywords ?? ''}`)
  return words.every((w) => hay.includes(w))
}

/** Wyniki w stałej kolejności grup (ORDER), najwyżej `limit`. */
export const orderResults = (list: ReadonlyArray<Command>, limit = 60) =>
  ORDER.flatMap((g) => list.filter((x) => x.group === g)).slice(0, limit)

/** Stałe polecenia palety: teraz trwa, nowy wpis, akcje, dni, strony, ustawienia, preferencje. */
export function buildCommands(ctx: PaletteContext): Array<Command> {
  const { text: t, actions: a } = ctx
  const c = t.commands
  const go = (to: string, search?: Record<string, string>) => () =>
    a.go(to, search)
  const list: Array<Command> = []

  // Teraz trwa: timer, przerwa i wstrzymane zadania na samej górze.
  const { running, runningBreak } = ctx
  if (running) {
    list.push(
      {
        id: 'timer-pause',
        group: 'timer',
        label: fmt(c.pause, { title: running.title }),
        icon: Pause,
        keywords: KW.pause,
        run: () => a.pause(running),
      },
      {
        id: 'timer-stop',
        group: 'timer',
        label: fmt(c.stop, { title: running.title }),
        icon: Square,
        keywords: KW.stop,
        run: () => a.stop(running),
      },
    )
  }
  if (runningBreak) {
    list.push({
      id: 'break-end',
      group: 'timer',
      label: c.breakEnd,
      icon: Coffee,
      keywords: KW.breakEnd,
      run: () => a.endBreak(runningBreak.id),
    })
  }
  for (const p of ctx.paused) {
    list.push({
      id: `resume-${p.id}`,
      group: 'timer',
      label: fmt(c.resume, { title: p.title }),
      icon: Play,
      keywords: KW.resume,
      run: () => a.resume(p),
    })
  }

  // Nowy wpis: zawsze pod ręką.
  list.push(
    {
      id: 'log',
      group: 'create',
      label: c.logTime,
      hint: c.logTimeHint,
      icon: Plus,
      keywords: KW.log,
      run: go('/app', { log: '' }),
    },
    {
      id: 'timer',
      group: 'create',
      label: c.timer,
      icon: Timer,
      keywords: KW.timer,
      run: go('/app', { mode: 'timer' }),
    },
  )
  if (!runningBreak)
    list.push({
      id: 'break',
      group: 'actions',
      label: c.breakStart,
      icon: Coffee,
      keywords: KW.breakStart,
      run: a.startBreak,
    })
  for (const tpl of ctx.templates) {
    const type = ctx.typeOf(tpl.taskTypeId)
    list.push({
      id: `tpl-${tpl.id}`,
      group: 'actions',
      label: fmt(c.template, { name: tpl.title }),
      hint: [
        tpl.defaultDurationMinutes !== null
          ? ctx.formatMinutes(tpl.defaultDurationMinutes)
          : c.templateHint,
        tpl.hotkey ? `Alt+${tpl.hotkey}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      icon: Zap,
      color: type?.color,
      keywords: `${KW.template} ${type?.name ?? ''}`,
      run: go('/app', { template: tpl.id }),
    })
  }

  // Dni: wczoraj (po wpisaniu); wpisana data daje swój dzień w `typedCommands`.
  const yesterday = addDays(ctx.today, -1)
  list.push(
    {
      id: 'yesterday-log',
      group: 'days',
      label: c.yesterdayLog,
      icon: CalendarDays,
      keywords: KW.day,
      onlyWhenSearching: true,
      run: go('/app', { date: yesterday }),
    },
    {
      id: 'yesterday-open',
      group: 'days',
      label: c.yesterdayOpen,
      icon: CalendarDays,
      keywords: KW.day,
      onlyWhenSearching: true,
      run: go('/app/day', { date: yesterday }),
    },
  )

  // Strony.
  const pages: Array<Omit<Command, 'group'>> = [
    {
      id: 'p-today',
      label: t.nav.today,
      icon: Clock,
      keywords: 'today home dzis',
      run: go('/app'),
    },
    {
      id: 'p-tasks',
      label: t.nav.tasks,
      icon: ListTodo,
      keywords: KW.tasks,
      run: go('/app/tasks'),
    },
    {
      id: 'p-sprints',
      label: t.nav.sprints,
      icon: CalendarRange,
      keywords: 'sprints sprinty',
      run: go('/app/sprints'),
    },
    {
      id: 'p-reports',
      label: t.nav.reports,
      icon: BarChart3,
      keywords: KW.report,
      run: go('/app/analytics'),
    },
  ]
  const sprint = ctx.currentSprint
  if (sprint) {
    pages.push(
      {
        id: 'sprint-report',
        label: c.sprintReport,
        hint: sprint.name,
        icon: BarChart3,
        keywords: KW.report,
        onlyWhenSearching: true,
        run: go('/app/analytics', { sprint: sprint.id }),
      },
      {
        id: 'sprint-tasks',
        label: c.sprintTasks,
        hint: sprint.name,
        icon: ListTodo,
        keywords: KW.tasks,
        onlyWhenSearching: true,
        run: go('/app/tasks', { sprint: sprint.id }),
      },
    )
  }
  pages.push({
    id: 'export',
    label: c.export,
    hint: ctx.isPro ? undefined : 'Pro',
    icon: Download,
    keywords: KW.export,
    onlyWhenSearching: true,
    run: go('/app/analytics'),
  })
  list.push(...pages.map((p) => ({ ...p, group: 'pages' as const })))

  // Ustawienia.
  for (const { to, key, icon } of settingsSections) {
    list.push({
      id: `s-${to}`,
      group: 'settings',
      label: ctx.settingsText.sections[key].title,
      hint: ctx.settingsText.sections[key].text,
      icon,
      keywords: `settings ustawienia ${key}`,
      onlyWhenSearching: true,
      run: go(to),
    })
  }
  list.push({
    id: 'day-off',
    group: 'settings',
    label: c.dayOff,
    icon: CalendarOff,
    keywords: KW.dayOff,
    onlyWhenSearching: true,
    run: go('/app/settings/days-off'),
  })
  if (!ctx.isPro)
    list.push({
      id: 'upgrade',
      group: 'settings',
      label: c.upgrade,
      icon: CreditCard,
      keywords: KW.upgrade,
      onlyWhenSearching: true,
      run: go('/app/settings/plan'),
    })

  // Preferencje.
  const themeIcons = { dark: Moon, light: Sun, system: SunMoon } as const
  for (const th of ['dark', 'light', 'system'] as const)
    list.push({
      id: `theme-${th}`,
      group: 'preferences',
      label: `${t.menu.theme}: ${t.menu.themes[th]}`,
      icon: themeIcons[th],
      keywords: KW.theme,
      onlyWhenSearching: true,
      run: () => a.setTheme(th),
    })
  for (const pref of clockPrefs)
    list.push({
      id: `clock-${pref}`,
      group: 'preferences',
      label: fmt(c.clock, { name: t.menu.clocks[pref] }),
      icon: Clock,
      keywords: KW.clock,
      onlyWhenSearching: true,
      run: () => a.setClock(pref),
    })
  for (const l of locales.filter((x) => x !== ctx.locale))
    list.push({
      id: `lang-${l}`,
      group: 'preferences',
      label: fmt(c.language, { name: localeNames[l] }),
      icon: Languages,
      keywords: KW.language,
      onlyWhenSearching: true,
      run: () => a.setLocale(l),
    })
  list.push(
    {
      id: 'shortcuts',
      group: 'preferences',
      label: c.shortcuts,
      icon: Keyboard,
      keywords: KW.shortcuts,
      onlyWhenSearching: true,
      run: a.showShortcuts,
    },
    {
      id: 'logout',
      group: 'preferences',
      label: c.logout,
      icon: LogOut,
      keywords: KW.logout,
      onlyWhenSearching: true,
      run: a.signOut,
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
  ctx: PaletteContext,
  entry: TimeEntry,
  group: Extract<Group, 'tasks' | 'found'>,
  meta: TaskCommandMeta = {},
): Command {
  const c = ctx.text.commands
  return {
    id: `t-${taskGroupKey(entry)}`,
    group,
    label: entry.title,
    hint: [
      meta.running ? c.running : meta.finished ? c.finished : null,
      meta.minutes !== undefined
        ? fmt(c.taskMeta, {
            date: ctx.formatDay(entry.workDate),
            time: ctx.formatMinutes(meta.minutes),
          })
        : ctx.formatDay(entry.workDate),
    ]
      .filter(Boolean)
      .join(' · '),
    detail: meta.snippet ?? undefined,
    icon: ListTodo,
    color: ctx.typeOf(entry.taskTypeId)?.color,
    run: () =>
      ctx.actions.go('/app/task', {
        type: entry.taskTypeId,
        title: entry.title,
        ...(entry.link ? { link: entry.link } : {}),
      }),
    alt: () => ctx.actions.resume(entry),
  }
}

/** Polecenia z wpisanego tekstu: nowy wpis lub timer z tym tytułem i dzień, gdy to data. */
export function typedCommands(
  ctx: PaletteContext,
  typed: string,
): Array<Command> {
  if (!typed) return []
  const c = ctx.text.commands
  const go = (to: string, search?: Record<string, string>) => () =>
    ctx.actions.go(to, search)
  const list: Array<Command> = [
    {
      id: 'log-titled',
      group: 'new',
      label: fmt(c.logTitled, { title: typed }),
      icon: Plus,
      run: go('/app', { log: typed }),
    },
    {
      id: 'timer-titled',
      group: 'new',
      label: fmt(c.timerTitled, { title: typed }),
      icon: Timer,
      run: go('/app', { log: typed, mode: 'timer' }),
    },
  ]
  const date = parseDateQuery(typed, ctx.today)
  if (date)
    list.push(
      {
        id: 'date-log',
        group: 'days',
        label: fmt(c.dayLog, { date: ctx.formatDay(date) }),
        icon: CalendarDays,
        run: go('/app', date === ctx.today ? {} : { date }),
      },
      {
        id: 'date-open',
        group: 'days',
        label: fmt(c.dayOpen, { date: ctx.formatDay(date) }),
        icon: CalendarDays,
        run: go('/app/day', { date }),
      },
    )
  return list
}
