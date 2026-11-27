import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { entriesApi } from '#/features/time-entries/data/api'
import { addDays, todayIn } from '#/domain/dates'
import { aggregateTasks } from '#/domain/task-groups'
import { signOut, useCurrentUser } from '#/features/auth/session'
import { hasProAccess } from '#/features/billing/domain/plans'
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
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { unwrap } from '#/lib/api-client'
import { setClock } from '#/lib/clock'
import { currentSprint } from '#/domain/sprints'
import { modifierKey } from '#/lib/platform'
import { setTheme } from '#/lib/theme'
import {
  buildCommands,
  matchesWords,
  orderResults,
  queryWords,
  taskCommand,
  typedCommands,
} from './model'
import type { Command, PaletteContext } from './model'
import { OPEN_EVENT } from './open'

/** Aktywna opcja zapamiętana razem z listą wyników, do której należy. */
interface Selection {
  key: string
  index: number
}

type IndexUpdate = number | ((index: number) => number)

/**
 * ViewModel palety poleceń: otwieranie (Ctrl/⌘+K, zdarzenie z menu), zapytanie
 * z opóźnieniem do wyszukiwarki na serwerze, dane i akcje dla modelu, wyniki, aktywna
 * opcja i obsługa klawiatury. Co jest poleceniem, decyduje `model.ts`.
 */
export function useCommandPaletteViewModel() {
  const t = useMessages(appMessages)
  const settingsText = useMessages(settingsMessages)
  const format = useFormat()
  const { locale, setLocale } = useI18n()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selection, setSelection] = useState<Selection>({ key: '', index: 0 })
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Po uruchomieniu polecenia fokus zostaje tam, gdzie je ustawi (np. pole tytułu),
  // zamiast wracać na element sprzed otwarcia palety.
  const ranRef = useRef(false)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
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

  // Dane: część tylko przy otwartej palecie, wyszukiwanie od 2 znaków.
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
  const typed = query.trim()
  // Wyniki z serwera tylko dla bieżącego tekstu: przy szybkim pisaniu i Enterze przed końcem
  // opóźnienia stare wyniki (np. z poprzedniego otwarcia) nie mogą uruchomić złego zadania.
  const searching = debounced.length >= 2 && debounced === typed
  const found = useQuery({
    queryKey: [...entryKeys.all, 'search-all', debounced],
    queryFn: () => unwrap(entriesApi.searchAll(debounced)),
    enabled: open && searching,
    staleTime: 30_000,
  })

  const pause = usePauseTimer()
  const stop = useStopTimer()
  const resume = useResumeTask()
  const startBreak = useStartBreak()
  const endBreak = useEndBreak()

  const ctx: PaletteContext = {
    text: t,
    settingsText,
    locale,
    today,
    isPro: hasProAccess(user),
    running,
    paused,
    runningBreak,
    templates,
    currentSprint: currentSprint(sprints, today),
    typeOf: (id) => types.find((x) => x.id === id),
    formatMinutes: format.minutes,
    formatDay: (date) => format.day(date),
    actions: {
      go: (to, search) => void navigate({ to, search } as never),
      pause: (entry) => pause.mutate(entry.id),
      stop: (entry) => stop.mutate(entry.id),
      resume: (entry) => resume.mutate(entry.id),
      startBreak: () => startBreak.mutate(),
      endBreak: (id) => endBreak.mutate({ id, resume: true }),
      setTheme,
      setClock,
      setLocale: (l) => void setLocale(l),
      signOut: () => void signOut().then(() => navigate({ to: '/login' })),
      showShortcuts: () => setHelp(true),
    },
  }

  // Zadania: bez tekstu 5 ostatnich z 30 dni, z tekstem wyniki z całej historii (serwer).
  const recentTasks = useMemo(
    () => aggregateTasks(recent ?? []).slice(0, 5),
    [recent],
  )
  const words = queryWords(typed)
  const taskResults: Array<Command> = searching
    ? (found.data ?? []).map((r) =>
        taskCommand(ctx, r.entry, 'found', {
          minutes: r.workedMinutes,
          finished: r.finished,
          running: r.running,
          snippet: r.snippet,
        }),
      )
    : typed
      ? []
      : recentTasks.map((task) => taskCommand(ctx, task.latest, 'tasks'))
  const results = orderResults([
    ...taskResults,
    ...buildCommands(ctx).filter((cmd) => matchesWords(cmd, words)),
    ...typedCommands(ctx, typed),
  ])

  // Nowa lista wyników (albo ponowne otwarcie) zaczyna od pierwszej opcji już w tym samym
  // renderze, a nie dopiero po efekcie: Enter wciśnięty w międzyczasie nie trafi w starą pozycję.
  const resultKey = `${open}|${results.map((r) => r.id).join('|')}`
  const active = selection.key === resultKey ? selection.index : 0
  const setActive = (next: IndexUpdate) =>
    setSelection({
      key: resultKey,
      index: typeof next === 'function' ? next(active) : next,
    })
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const close = () => {
    setOpen(false)
    setQuery('')
    setDebounced('')
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

  /** Strzałki przesuwają aktywną opcję, Enter ją uruchamia (Ctrl/⌘+Enter: druga akcja). */
  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
  }

  return {
    t,
    open,
    help,
    query,
    results,
    active,
    activeCommand: results.at(active),
    // Także w czasie opóźnienia przed zapytaniem: zamiast „brak wyników” widać „Szukam…”.
    searchingNow:
      typed.length >= 2 && (debounced !== typed || found.isFetching),
    listId,
    listRef,
    inputRef,
    mod: modifierKey(),
    optionId: (i: number) => `${listId}-${i}`,
    setQuery,
    setActive,
    onInputKeyDown,
    run,
    close,
    openPalette: () => setOpen(true),
    showHelp: () => setHelp(true),
    hideHelp: () => {
      setHelp(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    },
    /** Wywoływane przy otwarciu: fokus w polu, licznik uruchomień od zera. */
    onOpened: () => {
      ranRef.current = false
      inputRef.current?.focus()
    },
    /** Czy po zamknięciu zostawić fokus tam, gdzie ustawiło go polecenie. */
    keepFocusAfterClose: () => ranRef.current,
  }
}

export type CommandPaletteViewModel = ReturnType<
  typeof useCommandPaletteViewModel
>
