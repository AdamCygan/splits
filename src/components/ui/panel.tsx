import { useId } from 'react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/**
 * Karta sekcji strony: nagłówek (h2 domyślnie), krótki opis i treść. Sekcja jest
 * nazwanym regionem (aria-labelledby), więc czytniki ekranu mogą do niej przeskoczyć.
 */
export function Panel({
  title,
  lead,
  level = 2,
  headerExtra,
  className,
  children,
}: {
  title: string
  lead?: string
  level?: 2 | 3
  /** Treść pod opisem, przed zawartością (np. legenda wykresu). */
  headerExtra?: ReactNode
  className?: string
  children: ReactNode
}) {
  const id = useId()
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6',
        className,
      )}
    >
      <Heading id={id} className="type-heading text-xl">
        {title}
      </Heading>
      {lead && <p className="mt-1 text-sm text-ink-soft">{lead}</p>}
      {headerExtra && <div className="mt-3">{headerExtra}</div>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
