import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMessages } from '#/i18n/context'
import { commonMessages } from '#/i18n/messages/common'
import { cn } from '#/lib/utils'
import { Select } from './controls'

/**
 * Telefon: rekordy jako karty zamiast tabeli. Tabela zostaje od `sm` w górę
 * (`hidden sm:block`), lista kart jest tylko poniżej (`sm:hidden`), więc czytnik ekranu
 * dostaje jedno albo drugie, nigdy oba.
 */
export interface RecordListProps {
  label: string
  children: ReactNode
  className?: string
}

export function RecordList({ label, children, className }: RecordListProps) {
  return (
    <ul
      aria-label={label}
      className={cn('divide-y divide-line sm:hidden', className)}
    >
      {children}
    </ul>
  )
}

export interface RecordCardProps {
  children: ReactNode
  className?: string
}

export function RecordCard({ children, className }: RecordCardProps) {
  return <li className={cn('px-5 py-4', className)}>{children}</li>
}

export interface FactsProps {
  children: ReactNode
  className?: string
}

/** Wartości rekordu w dwóch kolumnach: podpis nad wartością. */
export function Facts({ children, className }: FactsProps) {
  return (
    <dl className={cn('mt-3 grid grid-cols-2 gap-x-4 gap-y-3', className)}>
      {children}
    </dl>
  )
}

export interface FactProps {
  label: string
  children: ReactNode
  className?: string
}

export function Fact({ label, children, className }: FactProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{children}</dd>
    </div>
  )
}

export interface SortOption<TColumn extends string> {
  value: TColumn
  label: string
}

export interface SortPickerProps<TColumn extends string> {
  options: ReadonlyArray<SortOption<TColumn>>
  column: TColumn
  direction: 'asc' | 'desc'
  /** Ta sama kolumna odwraca kolejność, inna sortuje po niej (jak klik w nagłówek tabeli). */
  onSort: (column: TColumn) => void
  className?: string
}

/** Sortowanie listy kart na telefonie; w tabeli robią to nagłówki kolumn. */
export function SortPicker<TColumn extends string>({
  options,
  column,
  direction,
  onSort,
  className,
}: SortPickerProps<TColumn>) {
  const messages = useMessages(commonMessages).sort
  const isAscending = direction === 'asc'
  const Icon = isAscending ? ArrowUp : ArrowDown
  const findOption = (value: string) =>
    options.find((option) => option.value === value)
  return (
    <div className={cn('flex items-end gap-2 sm:hidden', className)}>
      <label className="min-w-0 flex-1">
        <span className="mb-1.5 block text-sm font-medium">
          {messages.label}
        </span>
        <Select
          value={column}
          onChange={(event) => {
            const picked = findOption(event.target.value)
            if (picked) onSort(picked.value)
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={isAscending ? messages.ascending : messages.descending}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-input bg-surface hover:bg-muted"
      >
        <Icon aria-hidden className="size-4" />
      </button>
    </div>
  )
}
