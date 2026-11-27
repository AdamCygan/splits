import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

const COLS = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
} as const

/**
 * Pasek liczb nad stroną (Dziś, Zadania, Raporty, Sprinty, dzień, zadanie): lista opisów
 * <dl> w kafelkach rozdzielonych 1-pikselową linią. Na telefonie zawsze 2 kolumny.
 */
export function StatGrid({
  cols = 4,
  className,
  children,
}: {
  cols?: keyof typeof COLS
  className?: string
  children: ReactNode
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line',
        COLS[cols],
        className,
      )}
    >
      {children}
    </dl>
  )
}

/**
 * Jeden kafelek: etykieta, duża wartość i opcjonalna podpowiedź (`warn` = przekroczenie).
 * `children` dokłada własną treść pod wartością (np. pasek postępu), a `action` stoi
 * obok etykiety (np. przycisk „Zarządzaj”).
 */
export function StatTile({
  label,
  value,
  hint,
  warn = false,
  action,
  className,
  children,
}: {
  label: string
  value: ReactNode
  hint?: string
  warn?: boolean
  action?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('bg-surface px-4 py-3 sm:px-5', className)}>
      <dt className="flex items-center justify-between gap-2 text-sm text-ink-soft">
        {label}
        {action}
      </dt>
      <dd className="type-heading mt-0.5 text-xl tabular-nums sm:text-2xl">
        {value}
      </dd>
      {hint && (
        <dd
          className={cn(
            'mt-1 text-xs',
            warn ? 'font-medium text-warn' : 'text-ink-soft',
          )}
        >
          {hint}
        </dd>
      )}
      {children}
    </div>
  )
}
