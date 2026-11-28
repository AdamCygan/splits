import { cn } from '#/lib/utils'

export interface TickingTimeProps {
  seconds: number
  className?: string
}

/**
 * Czas HH:MM:SS. Font Timeblame ma cyfry proporcjonalne, więc każda cyfra
 * dostaje pole o stałej szerokości: tykający timer nie "skacze".
 */
export function TickingTime({ seconds, className }: TickingTimeProps) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secondsPart = seconds % 60
  const text = [hours, minutes, secondsPart]
    .map((count) => String(count).padStart(2, '0'))
    .join(':')

  return (
    <span
      className={cn('inline-flex', className)}
      aria-label={text}
      role="timer"
    >
      {text.split('').map((char, index) =>
        char === ':' ? (
          <span key={index} aria-hidden className="px-[0.04em] opacity-50">
            :
          </span>
        ) : (
          <span
            key={index}
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
