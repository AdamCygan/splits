import { cn } from '#/lib/utils'

/**
 * Czas HH:MM:SS. Font Pointhours ma cyfry proporcjonalne, więc każda cyfra
 * dostaje pole o stałej szerokości: tykający timer nie "skacze".
 */
export function TickingTime({
  seconds,
  className,
}: {
  seconds: number
  className?: string
}) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const text = [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')

  return (
    <span
      className={cn('inline-flex', className)}
      aria-label={text}
      role="timer"
    >
      {text.split('').map((char, i) =>
        char === ':' ? (
          <span key={i} aria-hidden className="px-[0.04em] opacity-50">
            :
          </span>
        ) : (
          <span
            key={i}
            aria-hidden
            className="inline-block w-[0.62em] text-center"
          >
            {char}
          </span>
        ),
      )}
    </span>
  )
}
