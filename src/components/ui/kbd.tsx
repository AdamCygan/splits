import { cn } from '#/lib/utils'

export interface KbdProps {
  children: string
  variant?: 'inline' | 'key'
  className?: string
}

/**
 * Klawisz w podpisach skrótów. `key` = wyraźny klawisz (lista szablonów), `inline` =
 * mały znacznik w tekście (podpowiedzi pod paletą poleceń).
 */
export function Kbd({ children, variant = 'inline', className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'font-sans',
        variant === 'key'
          ? 'inline-grid min-w-14 place-items-center rounded-md border border-b-[3px] border-line bg-surface px-2 py-0.5 text-xs font-semibold'
          : 'rounded border border-line px-1 text-[0.6875rem]',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
