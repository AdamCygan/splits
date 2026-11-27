import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  Clock,
  Coffee,
  CornerDownLeft,
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
  Search,
  Square,
  Sun,
  SunMoon,
  Timer,
  Zap,
} from 'lucide-react'
import { data } from '#/data'
import type { TimeEntry } from '#/data/types'
import { parseDateQuery } from '#/domain/date-query'
import { addDays, todayIn } from '#/domain/dates'
import { taskGroupKey } from '#/domain/report'
import { hasProAccess } from '#/features/billing/plans'
import { signOut, useCurrentUser } from '#/features/auth/session'
import { settingsSections } from '#/features/settings/sections'
import {
  settingsQuery,
  sprintsQuery,
  taskTypesQuery,
  templatesQuery,
} from '#/features/settings/queries'
import {
  useEndBreak,
  useStartBreak,
} from '#/features/time-entries/components/breaks'
import {
  usePauseTimer,
  useResumeTask,
  useStopTimer,
} from '#/features/time-entries/components/timer'
import {
  entryKeys,
  pausedQuery,
  rangeEntriesQuery,
  runningBreakQuery,
  runningQuery,
} from '#/features/time-entries/queries'
import { localeNames, locales } from '#/i18n/config'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { unwrap } from '#/lib/api-client'
import { clockPrefs, setClock } from '#/lib/clock'
import { setTheme } from '#/lib/theme'
import { cn } from '#/lib/utils'
import { Kbd } from '#/components/ui/kbd'

type Group =
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

const ORDER: ReadonlyArray<Group> = [
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

type Command = {
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

const OPEN_EVENT = 'ph:command-palette'

const isMac = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent)

/** Podpis skrótu: ⌘K na Macu, Ctrl K gdzie indziej. */
export function shortcutLabel() {
  return isMac() ? '⌘K' : 'Ctrl K'
}

/** Otwiera paletę z dowolnego miejsca (np. z menu konta). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

const normalize = (text: string) =>
  text.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Synonimy w obu językach, żeby „create task” i „dodaj zadanie” trafiały w to samo.
const KW = {
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

/**
 * Paleta poleceń (Ctrl+K / ⌘K). Szuka w całej historii zadań i notatek (serwer, z
 * fragmentem notatki), podpowiada akcje dopasowane do wpisanego tekstu („create task”
 * prowadzi do formularza w Dziś), steruje timerem i przerwą, przenosi do stron, ustawień
 * i dni. Wzorzec ARIA combobox + listbox: fokus zostaje w polu, strzałki przesuwają
 * aktywną opcję (aria-activedescendant), Enter ją uruchamia, Ctrl+Enter kontynuuje zadanie.
 */
export function CommandPalette() {
  const t = useMessages(appMessages)
  const c = t.commands
  const s = useMessages(settingsMessages)
  const format = useFormat()
  const { locale, setLocale } = useI18n()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Po uruchomieniu polecenia fokus zostaje tam, gdzie je ustawi (np. pole tytułu),
  // zamiast wracać na element sprzed otwarcia palety.
  const ranRef = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 150)
    return () => clearTimeout(id)
  }, [query])

  const settings = useQuery(settingsQuery).data
  const today = todayIn(settings?.timezone)
  const types = useQuery(taskTypesQuery).data ?? []
  const templates = useQuery(templatesQuery).data ?? []
  const sprints = useQuery(sprintsQuery).data ?? []
  const running = useQuery({ ...runningQuery, enabled: open }).data ?? null
  const paused = useQuery({ ...pausedQuery, enabled: open }).data ?? []
  const runningBreak =
    useQuery({ ...runningBreakQuery, enabled: open }).data ?? null
  const recent = useQuery({
    ...rangeEntriesQuery(addDays(today, -29), today),
    enabled: open,
  }).data
  const searching = debounced.length >= 2
  const found = useQuery({
    queryKey: [...entryKeys.all, 'search-all', debounced],
    queryFn: () => unwrap(data.entries.searchAll(debounced)),
    enabled: open && searching,
    staleTime: 30_000,
  })

  const pause = usePauseTimer()
  const stop = useStopTimer()
  const resume = useResumeTask()
  const startBreak = useStartBreak()
  const endBreak = useEndBreak()

  const current = sprints.find((x) => x.startsOn <= today && x.endsOn >= today)
  const isPro = hasProAccess(user)
  const typeOf = (id: string) => types.find((x) => x.id === id)
  const dayLabel = (date: string) => format.day(date)
  const go = (to: string, search?: Record<string, string>) => () =>
    void navigate({ to, search } as never)

  const typed = query.trim()

  const commands: Array<Command> = []
  // Teraz trwa: timer, przerwa i wstrzymane zadania na samej górze.
  if (running) {
    commands.push(
      {
        id: 'timer-pause',
        group: 'timer',
        label: fmt(c.pause, { title: running.title }),
        icon: Pause,
        keywords: KW.pause,
        run: () => pause.mutate(running.id),
      },
      {
        id: 'timer-stop',
        group: 'timer',
        label: fmt(c.stop, { title: running.title }),
        icon: Square,
        keywords: KW.stop,
        run: () => stop.mutate(running.id),
      },
    )
  }
  if (runningBreak) {
    commands.push({
      id: 'break-end',
      group: 'timer',
      label: c.breakEnd,
      icon: Coffee,
      keywords: KW.breakEnd,
      run: () => endBreak.mutate({ id: runningBreak.id, resume: true }),
    })
  }
  for (const p of paused) {
    commands.push({
      id: `resume-${p.id}`,
      group: 'timer',
      label: fmt(c.resume, { title: p.title }),
      icon: Play,
      keywords: KW.resume,
      run: () => resume.mutate(p.id),
    })
  }

  // Nowy wpis: zawsze pod ręką.
  commands.push(
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
    commands.push({
      id: 'break',
      group: 'actions',
      label: c.breakStart,
      icon: Coffee,
      keywords: KW.breakStart,
      run: () => startBreak.mutate(),
    })
  for (const tpl of templates) {
    const type = typeOf(tpl.taskTypeId)
    commands.push({
      id: `tpl-${tpl.id}`,
      group: 'actions',
      label: fmt(c.template, { name: tpl.title }),
      hint: [
        tpl.defaultDurationMinutes !== null
          ? format.minutes(tpl.defaultDurationMinutes)
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

  // Dni: wczoraj (po wpisaniu), a wpisana data („20.11”) daje swój dzień niżej.
  const yesterday = addDays(today, -1)
  commands.push(
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
  if (current) {
    pages.push(
      {
        id: 'sprint-report',
        label: c.sprintReport,
        hint: current.name,
        icon: BarChart3,
        keywords: KW.report,
        onlyWhenSearching: true,
        run: go('/app/analytics', { sprint: current.id }),
      },
      {
        id: 'sprint-tasks',
        label: c.sprintTasks,
        hint: current.name,
        icon: ListTodo,
        keywords: KW.tasks,
        onlyWhenSearching: true,
        run: go('/app/tasks', { sprint: current.id }),
      },
    )
  }
  pages.push({
    id: 'export',
    label: c.export,
    hint: isPro ? undefined : 'Pro',
    icon: Download,
    keywords: KW.export,
    onlyWhenSearching: true,
    run: go('/app/analytics'),
  })
  commands.push(...pages.map((p) => ({ ...p, group: 'pages' as const })))

  // Ustawienia.
  for (const { to, key, icon } of settingsSections) {
    commands.push({
      id: `s-${to}`,
      group: 'settings',
      label: s.sections[key].title,
      hint: s.sections[key].text,
      icon,
      keywords: `settings ustawienia ${key}`,
      onlyWhenSearching: true,
      run: go(to),
    })
  }
  commands.push({
    id: 'day-off',
    group: 'settings',
    label: c.dayOff,
    icon: CalendarOff,
    keywords: KW.dayOff,
    onlyWhenSearching: true,
    run: go('/app/settings/days-off'),
  })
  if (!isPro)
    commands.push({
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
    commands.push({
      id: `theme-${th}`,
      group: 'preferences',
      label: `${t.menu.theme}: ${t.menu.themes[th]}`,
      icon: themeIcons[th],
      keywords: KW.theme,
      onlyWhenSearching: true,
      run: () => setTheme(th),
    })
  for (const pref of clockPrefs)
    commands.push({
      id: `clock-${pref}`,
      group: 'preferences',
      label: fmt(c.clock, { name: t.menu.clocks[pref] }),
      icon: Clock,
      keywords: KW.clock,
      onlyWhenSearching: true,
      run: () => setClock(pref),
    })
  for (const l of locales.filter((x) => x !== locale))
    commands.push({
      id: `lang-${l}`,
      group: 'preferences',
      label: fmt(c.language, { name: localeNames[l] }),
      icon: Languages,
      keywords: KW.language,
      onlyWhenSearching: true,
      run: () => void setLocale(l),
    })
  commands.push(
    {
      id: 'shortcuts',
      group: 'preferences',
      label: c.shortcuts,
      icon: Keyboard,
      keywords: KW.shortcuts,
      onlyWhenSearching: true,
      run: () => setHelp(true),
    },
    {
      id: 'logout',
      group: 'preferences',
      label: c.logout,
      icon: LogOut,
      keywords: KW.logout,
      onlyWhenSearching: true,
      run: () => void signOut().then(() => navigate({ to: '/login' })),
    },
  )

  // Zadania: bez tekstu 5 ostatnich z 30 dni, z tekstem wyniki z całej historii (serwer).
  const taskCommand = (
    entry: TimeEntry,
    group: Group,
    meta: {
      minutes?: number
      finished?: boolean
      running?: boolean
      snippet?: string | null
    } = {},
  ): Command => ({
    id: `t-${taskGroupKey(entry)}`,
    group,
    label: entry.title,
    hint: [
      meta.running ? c.running : meta.finished ? c.finished : null,
      meta.minutes !== undefined
        ? fmt(c.taskMeta, {
            date: dayLabel(entry.workDate),
            time: format.minutes(meta.minutes),
          })
        : dayLabel(entry.workDate),
    ]
      .filter(Boolean)
      .join(' · '),
    detail: meta.snippet ?? undefined,
    icon: ListTodo,
    color: typeOf(entry.taskTypeId)?.color,
    run: go('/app/task', {
      type: entry.taskTypeId,
      title: entry.title,
      ...(entry.link ? { link: entry.link } : {}),
    }),
    alt: () => resume.mutate(entry.id),
  })
  const tasks = useMemo(() => {
    const latest = new Map<string, TimeEntry>()
    for (const e of recent ?? []) latest.set(taskGroupKey(e), e)
    return [...latest.values()]
      .sort((a, b) =>
        `${b.workDate}${b.startTime ?? ''}`.localeCompare(
          `${a.workDate}${a.startTime ?? ''}`,
        ),
      )
      .slice(0, 5)
  }, [recent])
  const taskCommands = searching
    ? (found.data ?? []).map((r) =>
        taskCommand(r.entry, 'found', {
          minutes: r.workedMinutes,
          finished: r.finished,
          running: r.running,
          snippet: r.snippet,
        }),
      )
    : typed
      ? []
      : tasks.map((e) => taskCommand(e, 'tasks'))

  const words = normalize(typed).split(/\s+/).filter(Boolean)
  const matches = (cmd: Command) => {
    if (!words.length) return !cmd.onlyWhenSearching
    const hay = normalize(
      `${cmd.label} ${cmd.hint ?? ''} ${cmd.keywords ?? ''}`,
    )
    return words.every((w) => hay.includes(w))
  }
  const list = [...taskCommands, ...commands.filter(matches)]
  if (typed) {
    // Wpisany tekst jako tytuł nowego wpisu albo timera (jak „Create issue” w Linear).
    list.push(
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
    )
    const date = parseDateQuery(typed, today)
    if (date)
      list.push(
        {
          id: 'date-log',
          group: 'days',
          label: fmt(c.dayLog, { date: dayLabel(date) }),
          icon: CalendarDays,
          run: go('/app', date === today ? {} : { date }),
        },
        {
          id: 'date-open',
          group: 'days',
          label: fmt(c.dayOpen, { date: dayLabel(date) }),
          icon: CalendarDays,
          run: go('/app/day', { date }),
        },
      )
  }
  // Grupy w stałej kolejności (ORDER).
  const results = ORDER.flatMap((g) => list.filter((x) => x.group === g)).slice(
    0,
    60,
  )

  const resultKey = results.map((r) => r.id).join('|')
  useEffect(() => setActive(0), [resultKey, open])
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const close = () => {
    setOpen(false)
    setQuery('')
    setHelp(false)
  }
  const run = (cmd: Command | undefined, alt = false) => {
    if (!cmd) return
    if (cmd.id === 'shortcuts') {
      setHelp(true)
      return
    }
    ranRef.current = true
    close()
    if (alt && cmd.alt) cmd.alt()
    else cmd.run()
  }

  const optionId = (i: number) => `${listId}-${i}`
  const activeCmd = results.at(active)
  const mod = isMac() ? '⌘' : 'Ctrl'

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : close())}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(20,22,43,0.45)] data-[state=open]:animate-[fade-in_120ms_ease-out]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            ranRef.current = false
            inputRef.current?.focus()
          }}
          onCloseAutoFocus={(e) => {
            if (ranRef.current) e.preventDefault()
          }}
          className="fixed top-[10dvh] left-1/2 z-50 flex max-h-[76dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_80px_-20px_rgba(20,22,43,0.45)] outline-none data-[state=open]:animate-[dialog-in_160ms_cubic-bezier(0.2,0.7,0.2,1)]"
        >
          <DialogPrimitive.Title className="sr-only">
            {t.menu.commands}
          </DialogPrimitive.Title>
          {help ? (
            <ShortcutsHelp
              mod={mod}
              onBack={() => {
                setHelp(false)
                setTimeout(() => inputRef.current?.focus(), 0)
              }}
            />
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search aria-hidden className="size-4 shrink-0 text-ink-soft" />
                <input
                  ref={inputRef}
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    results.length ? optionId(active) : undefined
                  }
                  aria-label={c.label}
                  placeholder={c.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setActive((i) => Math.min(results.length - 1, i + 1))
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setActive((i) => Math.max(0, i - 1))
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      run(results.at(active), e.ctrlKey || e.metaKey)
                    }
                  }}
                  className="h-14 w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
                />
                <kbd className="hidden shrink-0 rounded border border-line px-1.5 text-[0.6875rem] text-ink-soft sm:block">
                  Esc
                </kbd>
              </div>
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={c.results}
                aria-busy={searching && found.isFetching}
                className="min-h-0 flex-1 overflow-y-auto p-1.5"
              >
                {ORDER.map((group) => {
                  const items = results
                    .map((cmd, i) => ({ cmd, i }))
                    .filter(({ cmd }) => cmd.group === group)
                  if (items.length === 0) return null
                  return (
                    <li key={group} role="presentation">
                      <ul role="group" aria-labelledby={`${listId}-${group}`}>
                        <li
                          role="presentation"
                          id={`${listId}-${group}`}
                          className="px-3 pt-2.5 pb-1 text-xs font-medium text-ink-faint"
                        >
                          {c.groups[group]}
                        </li>
                        {items.map(({ cmd, i }) => (
                          <li
                            key={cmd.id}
                            id={optionId(i)}
                            role="option"
                            aria-selected={i === active}
                            data-index={i}
                            onMouseMove={() => setActive(i)}
                            onClick={(e) => run(cmd, e.ctrlKey || e.metaKey)}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-sm',
                              i === active && 'bg-muted',
                            )}
                          >
                            {cmd.color ? (
                              <span
                                aria-hidden
                                className="mx-1 mt-1.5 size-2 shrink-0 rounded-full"
                                style={{ background: cmd.color }}
                              />
                            ) : (
                              <cmd.icon
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0 text-ink-soft"
                              />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {cmd.label}
                              </span>
                              {cmd.detail && (
                                <span className="mt-0.5 block truncate text-xs text-ink-soft">
                                  {cmd.detail}
                                </span>
                              )}
                            </span>
                            {cmd.hint && (
                              <span className="mt-0.5 hidden max-w-[45%] shrink-0 truncate text-xs text-ink-soft sm:block">
                                {cmd.hint}
                              </span>
                            )}
                            {i === active && (
                              <CornerDownLeft
                                aria-hidden
                                className="mt-0.5 size-3.5 shrink-0 text-ink-soft"
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  )
                })}
                {results.length === 0 && (
                  <li
                    role="presentation"
                    className="px-3 py-6 text-center text-sm text-ink-soft"
                  >
                    {c.empty}
                  </li>
                )}
              </ul>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-ink-soft">
                <p aria-hidden className="flex flex-wrap gap-x-4 gap-y-1">
                  {searching && found.isFetching ? (
                    <span>{c.searching}</span>
                  ) : (
                    <>
                      <span>
                        <Kbd>↑</Kbd> <Kbd>↓</Kbd> {c.hints.move}
                      </span>
                      <span>
                        <Kbd>↵</Kbd> {c.hints.open}
                      </span>
                      {activeCmd?.alt && (
                        <span>
                          <Kbd>{mod}</Kbd> <Kbd>↵</Kbd> {c.hints.continue}
                        </span>
                      )}
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setHelp(true)}
                  className="ml-auto inline-flex min-h-6 items-center gap-1.5 rounded hover:text-ink"
                >
                  <Keyboard aria-hidden className="size-3.5" />
                  {c.shortcuts}
                </button>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Lista skrótów klawiszowych w palecie (polecenie „Skróty klawiszowe”). */
function ShortcutsHelp({ mod, onBack }: { mod: string; onBack: () => void }) {
  const c = useMessages(appMessages).commands
  const rows: Array<[string, string]> = [
    [`${mod} K`, c.keys.palette],
    ['Alt 1–9', c.keys.template],
    [`${mod} Enter`, c.keys.save],
    ['↑ ↓', c.keys.time],
    ['Enter', c.keys.open],
    [`${mod} Enter`, c.keys.continue],
    ['Esc', c.keys.close],
  ]
  return (
    <div className="overflow-y-auto p-5">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid size-9 place-items-center rounded-lg hover:bg-muted"
          aria-label={c.back}
          // Fokus na powrocie, żeby Esc/Enter od razu działały w tym widoku.
          autoFocus
        >
          <ArrowLeft aria-hidden className="size-4" />
        </button>
        <h2 className="type-heading text-xl">{c.shortcutsTitle}</h2>
      </div>
      <dl className="divide-y divide-line">
        {rows.map(([keys, label]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 py-2.5"
          >
            <dt className="text-sm">{label}</dt>
            <dd className="shrink-0">
              <kbd className="rounded border border-line px-2 py-0.5 text-xs text-ink-soft">
                {keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
