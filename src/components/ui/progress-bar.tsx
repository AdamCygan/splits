import { cn } from '#/lib/utils'

const TONES = {
  ink: 'bg-ink',
  warn: 'bg-wt-review',
  pair: 'bg-[var(--wt-pair)]',
} as const

/**
 * Cienki pasek postępu (cel dnia, przerwy). Ozdobny: wartość jest zawsze podana tekstem
 * obok, więc pasek jest ukryty przed czytnikami. Wartość 0–100 (przycinana).
 */
export function ProgressBar({
  value,
  tone = 'ink',
  className,
}: {
  value: number
  tone?: keyof typeof TONES
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn('h-full rounded-full', TONES[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
