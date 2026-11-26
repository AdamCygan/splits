import { useEffect, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { Popover } from 'radix-ui'
import { Clock } from 'lucide-react'
import { useI18n, useMessages } from '#/i18n/context'
import { commonMessages } from '#/i18n/messages/common'
import { displayTime, parseTime, useClockPref, uses12h } from '#/lib/clock'
import { cn } from '#/lib/utils'
import { Input } from './input'

const SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0')
  const m = String((i % 4) * 15).padStart(2, '0')
  return `${h}:${m}`
})

const toMinutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3))
const fromMinutes = (n: number) => {
  const m = ((n % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Pole godziny w formacie aplikacji (24h albo 12h wg preferencji), zamiast systemowego
 * <input type="time">, który wygląda różnie w każdej przeglądarce. Wartość zawsze "HH:MM".
 * Wpisuje się swobodnie (930, 9:30, 2:30pm), strzałki zmieniają o 5 min, a zegar otwiera
 * listę co 15 minut. Tekst, którego nie da się odczytać, idzie dalej bez zmian, żeby
 * walidacja formularza pokazała błąd.
 */
export function TimeInput({
  value,
  onChange,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (value: string) => void
}) {
  const { tag } = useI18n()
  const t = useMessages(commonMessages).time
  const twelve = uses12h(tag, useClockPref())
  // Tekst w trakcie edycji; null = pokazujemy sformatowaną wartość.
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const shown = draft ?? displayTime(value, twelve)
  const parsed = parseTime(value)

  const commit = (text: string) => onChange(parseTime(text) ?? text)

  useEffect(() => {
    if (!open) return
    // Lista przewija się do wybranej godziny (albo najbliższej).
    const id = requestAnimationFrame(() => {
      const target = parsed ?? fromMinutes(9 * 60)
      const slot = SLOTS.reduce((best, s) =>
        Math.abs(toMinutes(s) - toMinutes(target)) <
        Math.abs(toMinutes(best) - toMinutes(target))
          ? s
          : best,
      )
      listRef.current
        ?.querySelector<HTMLElement>(`[data-slot-time="${slot}"]`)
        ?.scrollIntoView({ block: 'center' })
    })
    return () => cancelAnimationFrame(id)
  }, [open, parsed])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <Input
          {...props}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          title={t.hint}
          value={shown}
          onFocus={(e) => {
            setDraft(displayTime(value, twelve))
            props.onFocus?.(e)
          }}
          onChange={(e) => {
            setDraft(e.target.value)
            commit(e.target.value)
          }}
          onBlur={(e) => {
            if (draft !== null) commit(draft)
            setDraft(null)
            props.onBlur?.(e)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              const step =
                (e.shiftKey ? 60 : 5) * (e.key === 'ArrowUp' ? 1 : -1)
              const base = parsed ? toMinutes(parsed) : 9 * 60 - step
              const next = fromMinutes(Math.round((base + step) / 5) * 5)
              onChange(next)
              setDraft(displayTime(next, twelve))
            }
            props.onKeyDown?.(e)
          }}
          className="w-full pr-10 tabular-nums"
        />
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={t.pick}
            className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-soft hover:bg-muted hover:text-ink"
          >
            <Clock aria-hidden className="size-4" />
          </button>
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-40 rounded-xl border border-line bg-surface p-1 shadow-[0_16px_48px_-12px_rgba(20,22,43,0.35)] data-[state=open]:animate-[fade-in_120ms_ease-out]"
        >
          <div
            ref={listRef}
            role="group"
            aria-label={t.list}
            className="max-h-64 overflow-y-auto"
          >
            {SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                data-slot-time={slot}
                aria-pressed={slot === parsed}
                onClick={() => {
                  onChange(slot)
                  setDraft(null)
                  setOpen(false)
                }}
                className="block w-full rounded-lg px-3 py-1.5 text-left text-sm tabular-nums hover:bg-muted aria-pressed:bg-[var(--ink-fixed)] aria-pressed:text-white dark:aria-pressed:bg-ink dark:aria-pressed:text-paper"
              >
                {displayTime(slot, twelve)}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
