import { Link } from '@tanstack/react-router'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { addDays } from '#/shared/domain/dates'
import { useFormat, useMessages } from '#/i18n/context'
import { entriesMessages } from '#/i18n/messages/entries'

export interface DayPickerProps {
  value: string
  today: string
  /** Najstarszy dzień, do którego można dopisać wpis; null = bez limitu. */
  min: string | null
  /** Limit planu Free: przy najstarszym dniu pokazujemy, skąd się bierze. */
  limited: boolean
  onChange: (date: string) => void
}

/**
 * Wybór dnia na stronie Dziś: poprzedni / następny dzień, kalendarz i powrót do dziś.
 * Przyszłych dni nie ma (nie ma jeszcze przepracowanego czasu), a plan Free kończy się na `min`.
 */
export function DayPicker({
  value,
  today,
  min,
  limited,
  onChange,
}: DayPickerProps) {
  const t = useMessages(entriesMessages).day
  const format = useFormat()
  const isToday = value === today
  const atMin = min !== null && value <= min

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <nav aria-label={t.nav} className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={atMin}
          onClick={() => onChange(addDays(value, -1))}
        >
          <ChevronLeft aria-hidden className="size-4" />
          <span className="sr-only">{t.previous}</span>
        </Button>
        {/* Data w formacie aplikacji („czw., 26 lis”), a pod spodem przezroczyste pole daty:
            kliknięcie otwiera systemowy kalendarz, klawiatura i czytniki dostają zwykłe pole. */}
        <div className="relative h-9 rounded-md border border-input bg-surface focus-within:ring-[3px] focus-within:ring-ring/50">
          <span
            aria-hidden
            className="flex h-full items-center gap-2 px-3 text-sm font-medium whitespace-nowrap"
          >
            <CalendarDays className="size-4 text-ink-soft" />
            {format.day(value, {
              year: value.slice(0, 4) !== today.slice(0, 4),
            })}
          </span>
          <input
            type="date"
            aria-label={t.date}
            value={value}
            max={today}
            min={min ?? undefined}
            required
            onClick={(e) => {
              try {
                e.currentTarget.showPicker()
              } catch {
                // Starsze przeglądarki otwierają kalendarz same po kliknięciu.
              }
            }}
            onChange={(e) => {
              const next = e.target.value
              if (!next) return
              onChange(
                next > today ? today : min !== null && next < min ? min : next,
              )
            }}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          disabled={isToday}
          onClick={() => onChange(addDays(value, 1))}
        >
          <ChevronRight aria-hidden className="size-4" />
          <span className="sr-only">{t.next}</span>
        </Button>
        {!isToday && (
          <Button variant="outline" onClick={() => onChange(today)}>
            {t.backToToday}
          </Button>
        )}
      </nav>
      {limited && atMin && (
        <p className="text-sm text-ink-soft">
          {t.freeLimit}{' '}
          <Link
            to="/app/checkout"
            search={{ interval: 'year' }}
            className="font-medium text-ink underline underline-offset-2"
          >
            {t.upgrade}
          </Link>
        </p>
      )}
    </div>
  )
}
