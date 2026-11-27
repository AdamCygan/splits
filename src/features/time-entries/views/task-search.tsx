import { useQuery } from '@tanstack/react-query'
import { FormInput, Play, Search, X } from 'lucide-react'
import { useDeferredValue, useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { entriesApi } from '../data/api'
import type {
  TaskSearchResult,
  TimeEntry,
} from '#/features/time-entries/data/dto'
import { unwrap } from '#/lib/api-client'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { cn } from '#/lib/utils'
import { entryKeys } from '../data/queries'
import { useResumeTask } from './timer'

export interface TaskSearchProps {
  isToday: boolean
  onUse: (entry: TimeEntry) => void
}

/**
 * Wyszukiwarka zadań nad formularzem: dowolne zadanie, także zakończone, po tytule albo
 * linku. Wybrane można kontynuować od razu (nowa sesja z timerem) albo wpisać w formularz.
 */
export function TaskSearch({ isToday, onUse }: TaskSearchProps) {
  const t = useMessages(entriesMessages).search
  const format = useFormat()
  const { locale } = useI18n()
  const id = useId()
  const types = useQuery(taskTypesQuery).data ?? []
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState<TaskSearchResult | null>(null)
  const q = useDeferredValue(query.trim())
  const search = useQuery({
    queryKey: [...entryKeys.all, 'search', q],
    queryFn: () => unwrap(entriesApi.search(q)),
    enabled: q.length >= 2,
    staleTime: 10_000,
  })
  const results = q.length >= 2 ? (search.data ?? []) : []
  const resume = useResumeTask()
  const expanded = open && q.length >= 2

  const typeOf = (r: TaskSearchResult) =>
    types.find((x) => x.id === r.entry.taskTypeId)
  const meta = (r: TaskSearchResult) =>
    [
      typeOf(r)?.name,
      fmt(t.last, {
        date: formatDate(locale, r.lastDate, {
          day: 'numeric',
          month: 'short',
        }),
      }),
      format.minutes(r.workedMinutes),
    ]
      .filter(Boolean)
      .join(', ')

  const choose = (r: TaskSearchResult | undefined) => {
    if (!r) return
    setSelected(r)
    setOpen(false)
    setQuery('')
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) =>
        results.length ? (i + step + results.length) % results.length : 0,
      )
    } else if (e.key === 'Enter' && expanded && results[active]) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      if (expanded) setOpen(false)
      else setQuery('')
    }
  }

  return (
    <div className="mb-5">
      <label htmlFor={`${id}-input`} className="text-sm font-medium">
        {t.label}
      </label>
      <div className="relative mt-1.5">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft"
        />
        <Input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={
            expanded && results[active] ? `${id}-opt-${active}` : undefined
          }
          autoComplete="off"
          placeholder={t.placeholder}
          className="pl-9"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {expanded && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label={t.results}
            className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg"
          >
            {results.length === 0 ? (
              <li
                role="presentation"
                className="px-3 py-2.5 text-sm text-ink-soft"
              >
                {search.isFetching ? t.searching : t.none}
              </li>
            ) : (
              results.map((r, i) => (
                <li
                  key={r.entry.id}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown zamiast click: pole nie traci fokusu przed wyborem.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(r)
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 px-3 py-2',
                    i === active && 'bg-muted',
                  )}
                >
                  <span
                    aria-hidden
                    className="mt-1.5 size-2.5 shrink-0 rounded-full"
                    style={{ background: typeOf(r)?.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {r.entry.title}
                    </span>
                    <span className="block truncate text-sm text-ink-soft">
                      {meta(r)}
                    </span>
                  </span>
                  {r.running ? (
                    <Badge tone="muted">{t.running}</Badge>
                  ) : (
                    r.finished && <Badge tone="success">{t.done}</Badge>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {selected && (
        <div
          role="group"
          aria-label={fmt(t.selected, { name: selected.entry.title })}
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-muted/40 px-3 py-2.5"
        >
          <span className="min-w-0 flex-1 basis-48">
            <span className="block truncate font-medium">
              {selected.entry.title}
            </span>
            <span className="block text-sm text-ink-soft">
              {meta(selected)}
              {selected.finished && `, ${t.doneLower}`}
            </span>
          </span>
          <span className="flex flex-wrap gap-2">
            {isToday && !selected.running && (
              <Button
                size="sm"
                disabled={resume.isPending}
                onClick={() =>
                  resume.mutate(selected.entry.id, {
                    onSuccess: () => setSelected(null),
                  })
                }
              >
                <Play aria-hidden className="size-4" />
                {t.continue}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onUse(selected.entry)
                setSelected(null)
              }}
            >
              <FormInput aria-hidden className="size-4" />
              {t.use}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={t.clear}
              onClick={() => setSelected(null)}
            >
              <X aria-hidden className="size-4" />
            </Button>
          </span>
        </div>
      )}
    </div>
  )
}
