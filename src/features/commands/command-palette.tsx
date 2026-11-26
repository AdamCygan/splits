import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  BarChart3,
  CalendarRange,
  Clock,
  CornerDownLeft,
  ListTodo,
  Moon,
  Search,
  Settings,
  Sun,
  SunMoon,
} from 'lucide-react'
import { addDays, todayIn } from '#/domain/dates'
import { taskGroupKey } from '#/domain/report'
import { settingsSections } from '#/features/settings/sections'
import { settingsQuery, taskTypesQuery } from '#/features/settings/queries'
import { rangeEntriesQuery } from '#/features/time-entries/queries'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { setTheme } from '#/lib/theme'
import { cn } from '#/lib/utils'

type Command = {
  id: string
  group: 'tasks' | 'pages' | 'actions'
  label: string
  hint?: string
  icon: ComponentType<{ 'aria-hidden'?: boolean; className?: string }>
  color?: string
  keywords?: string
  run: () => void
}

const OPEN_EVENT = 'ph:command-palette'

/** Podpis skrótu: ⌘K na Macu, Ctrl K gdzie indziej. */
export function shortcutLabel() {
  return typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? '⌘K'
    : 'Ctrl K'
}

/** Otwiera paletę z dowolnego miejsca (np. z menu konta). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

const normalize = (text: string) =>
  text.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Paleta poleceń (Ctrl+K / ⌘K): przejście do strony lub ustawień, zadania z ostatnich
 * 30 dni i kilka akcji. Wzorzec ARIA combobox + listbox: fokus zostaje w polu,
 * strzałki przesuwają aktywną opcję (aria-activedescendant), Enter ją uruchamia.
 */
export function CommandPalette() {
  const t = useMessages(appMessages)
  const s = useMessages(settingsMessages)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)

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

  const settings = useQuery(settingsQuery).data
  const today = todayIn(settings?.timezone)
  const types = useQuery(taskTypesQuery).data ?? []
  const recent = useQuery({
    ...rangeEntriesQuery(addDays(today, -29), today),
    enabled: open,
  }).data

  const commands = useMemo<Array<Command>>(() => {
    const go = (to: string, search?: Record<string, string>) => () =>
      void navigate({ to, search } as never)
    const pages: Array<Command> = [
      { id: 'p-today', label: t.nav.today, icon: Clock, run: go('/app') },
      {
        id: 'p-tasks',
        label: t.nav.tasks,
        icon: ListTodo,
        run: go('/app/tasks'),
      },
      {
        id: 'p-sprints',
        label: t.nav.sprints,
        icon: CalendarRange,
        run: go('/app/sprints'),
      },
      {
        id: 'p-reports',
        label: t.nav.reports,
        icon: BarChart3,
        run: go('/app/analytics'),
      },
      ...settingsSections.map(({ to, key, icon }) => ({
        id: `p-${to}`,
        label: `${t.nav.settings}: ${s.sections[key].title}`,
        hint: s.sections[key].text,
        icon: key === 'overview' ? Settings : icon,
        run: go(to),
      })),
    ].map((c) => ({ ...c, group: 'pages' as const }))

    const actions: Array<Command> = [
      {
        id: 'a-dark',
        label: `${t.menu.theme}: ${t.menu.themes.dark}`,
        icon: Moon,
        run: () => setTheme('dark'),
      },
      {
        id: 'a-light',
        label: `${t.menu.theme}: ${t.menu.themes.light}`,
        icon: Sun,
        run: () => setTheme('light'),
      },
      {
        id: 'a-system',
        label: `${t.menu.theme}: ${t.menu.themes.system}`,
        icon: SunMoon,
        run: () => setTheme('system'),
      },
    ].map((c) => ({ ...c, group: 'actions' as const }))

    // Zadania z ostatnich 30 dni, od ostatnio ruszanego.
    const latest = new Map<string, NonNullable<typeof recent>[number]>()
    for (const e of recent ?? []) latest.set(taskGroupKey(e), e)
    const tasks: Array<Command> = [...latest.values()]
      .sort((a, b) =>
        `${b.workDate}${b.startTime ?? ''}`.localeCompare(
          `${a.workDate}${a.startTime ?? ''}`,
        ),
      )
      .map((e) => {
        const type = types.find((x) => x.id === e.taskTypeId)
        return {
          id: `t-${taskGroupKey(e)}`,
          group: 'tasks' as const,
          label: e.title,
          hint: type?.name,
          color: type?.color,
          icon: ListTodo,
          keywords: e.link ?? '',
          run: go('/app/task', {
            type: e.taskTypeId,
            title: e.title,
            ...(e.link ? { link: e.link } : {}),
          }),
        }
      })
    return [...tasks, ...pages, ...actions]
  }, [navigate, recent, s, t, types])

  const q = normalize(query.trim())
  const results = useMemo(() => {
    if (!q) {
      // Bez wpisanego tekstu: 5 ostatnich zadań, strony i akcje.
      const tasks = commands.filter((c) => c.group === 'tasks').slice(0, 5)
      return [...tasks, ...commands.filter((c) => c.group !== 'tasks')]
    }
    return commands
      .filter((c) =>
        normalize(`${c.label} ${c.hint ?? ''} ${c.keywords ?? ''}`).includes(q),
      )
      .slice(0, 30)
  }, [commands, q])

  useEffect(() => setActive(0), [q, open])
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = (c: Command | undefined) => {
    if (!c) return
    setOpen(false)
    setQuery('')
    c.run()
  }

  const groupLabel = {
    tasks: t.commands.tasks,
    pages: t.commands.pages,
    actions: t.commands.actions,
  }
  const optionId = (i: number) => `${listId}-${i}`

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setQuery('')
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(20,22,43,0.45)] data-[state=open]:animate-[fade-in_120ms_ease-out]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[12dvh] left-1/2 z-50 flex max-h-[70dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_80px_-20px_rgba(20,22,43,0.45)] outline-none data-[state=open]:animate-[dialog-in_160ms_cubic-bezier(0.2,0.7,0.2,1)]"
        >
          <DialogPrimitive.Title className="sr-only">
            {t.menu.commands}
          </DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search aria-hidden className="size-4 shrink-0 text-ink-soft" />
            <input
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                results.length ? optionId(active) : undefined
              }
              aria-label={t.commands.label}
              placeholder={t.commands.placeholder}
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
                } else if (e.key === 'Home') {
                  e.preventDefault()
                  setActive(0)
                } else if (e.key === 'End') {
                  e.preventDefault()
                  setActive(Math.max(0, results.length - 1))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  run(results[active])
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
            aria-label={t.commands.results}
            className="overflow-y-auto p-1.5"
          >
            {(['tasks', 'pages', 'actions'] as const).map((group) => {
              const items = results
                .map((c, i) => ({ c, i }))
                .filter(({ c }) => c.group === group)
              if (items.length === 0) return null
              return (
                <li key={group} role="presentation">
                  <ul role="group" aria-labelledby={`${listId}-${group}`}>
                    <li
                      role="presentation"
                      id={`${listId}-${group}`}
                      className="px-3 pt-2.5 pb-1 text-xs font-medium text-ink-faint"
                    >
                      {groupLabel[group]}
                    </li>
                    {items.map(({ c, i }) => (
                      <li
                        key={c.id}
                        id={optionId(i)}
                        role="option"
                        aria-selected={i === active}
                        data-index={i}
                        onMouseMove={() => setActive(i)}
                        onClick={() => run(c)}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                          i === active && 'bg-muted',
                        )}
                      >
                        {c.color ? (
                          <span
                            aria-hidden
                            className="mx-1 size-2 shrink-0 rounded-full"
                            style={{ background: c.color }}
                          />
                        ) : (
                          <c.icon
                            aria-hidden
                            className="size-4 shrink-0 text-ink-soft"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {c.label}
                        </span>
                        {c.hint && (
                          <span className="hidden shrink-0 truncate text-xs text-ink-soft sm:block">
                            {c.hint}
                          </span>
                        )}
                        {i === active && (
                          <CornerDownLeft
                            aria-hidden
                            className="size-3.5 shrink-0 text-ink-soft"
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
                {t.commands.empty}
              </li>
            )}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
