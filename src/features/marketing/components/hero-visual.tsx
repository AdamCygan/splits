import { Clock, Copy, Play, Square, Wand2 } from 'lucide-react'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { commonMessages } from '#/i18n/messages/common'
import { marketingMessages } from '#/i18n/messages/marketing'

const chips = [
  ['task', 'var(--wt-task)'],
  ['code_review', 'var(--wt-review)'],
  ['pair_programming', 'var(--wt-pair)'],
  ['additional_work', 'var(--wt-extra)'],
] as const

/**
 * Ilustracja w hero: działający timer, menu „prawy przycisk → czas” i skopiowane podsumowanie.
 * Czysty HTML/CSS (bez obrazków), więc nie spowalnia LCP. Dla czytników jeden opis (role="img").
 */
export function HeroVisual() {
  const t = useMessages(marketingMessages).heroVisual
  const types = useMessages(commonMessages).workTypes
  const format = useFormat()
  return (
    <div
      role="img"
      aria-label={t.label}
      className="relative mx-auto hidden w-full max-w-md select-none lg:block"
    >
      {/* Timer */}
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--ink-fixed)] px-4 py-3 text-white shadow-[0_24px_60px_-24px_rgba(20,22,43,0.6)]">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-wt-task opacity-70 motion-reduce:hidden" />
          <span className="relative inline-flex size-2.5 rounded-full bg-wt-task" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {t.timerTitle}
        </span>
        <span className="font-mono text-lg font-semibold tabular-nums">
          0:42:15
        </span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-[var(--ink-fixed)]">
          <Square className="size-3" fill="currentColor" />
          {t.stop}
        </span>
      </div>

      {/* Typy pracy + menu kontekstowe */}
      <div className="relative mt-4 rounded-2xl border border-line bg-surface p-4 pb-20 shadow-[0_24px_60px_-28px_rgba(20,22,43,0.35)]">
        <div className="flex flex-wrap gap-2">
          {chips.map(([kind, color]) => (
            <span
              key={kind}
              className={
                kind === 'code_review'
                  ? 'inline-flex items-center gap-2 rounded-full bg-[var(--ink-fixed)] px-3 py-1.5 text-sm font-medium text-white ring-[3px] ring-wt-review/40'
                  : 'inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink-soft'
              }
            >
              <span
                className="size-2 rounded-full"
                style={{ background: color }}
              />
              {types[kind]}
            </span>
          ))}
        </div>
        <div className="mt-3 ml-16 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-[0_18px_44px_-14px_rgba(20,22,43,0.4)] sm:ml-24">
          <p className="px-2.5 pt-1 pb-1.5 text-xs font-semibold text-ink-soft">
            {types.code_review}
          </p>
          {[15, 30, 60].map((m, i) => (
            <p
              key={m}
              className={
                i === 1
                  ? 'flex items-center gap-2.5 rounded-lg bg-muted px-2.5 py-1.5 text-sm font-medium'
                  : 'flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-medium'
              }
            >
              <Clock className="size-4 text-ink-soft" />
              {fmt(t.log, { time: format.minutes(m) })}
            </p>
          ))}
          <p className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-medium">
            <Wand2 className="size-4 text-ink-soft" />
            {t.custom}
          </p>
          <span className="my-1 block h-px bg-line" />
          <p className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-medium">
            <Play className="size-4 text-ink-soft" />
            {t.timer}
          </p>
        </div>
      </div>

      {/* Podsumowanie */}
      <div className="relative -mt-14 ml-auto w-[88%] rounded-2xl border border-line bg-surface p-4 shadow-[0_24px_60px_-28px_rgba(20,22,43,0.35)]">
        <p className="flex items-center gap-2 text-xs font-semibold text-ok">
          <Copy className="size-3.5" />
          {t.summaryTitle}
        </p>
        <p className="mt-2 font-mono text-xs leading-relaxed text-ink">
          {t.summaryText}
        </p>
      </div>
    </div>
  )
}
