import { useId } from 'react'
import { Languages } from 'lucide-react'
import { locales, localeNames } from '#/i18n/config'
import { useI18n, useMessages } from '#/i18n/context'
import { commonMessages } from '#/i18n/messages/common'
import { cn } from '#/lib/utils'
import type { Locale } from '#/i18n/config'

/**
 * Wybór języka jako natywny <select>: najlepiej obsługiwany przez klawiaturę,
 * czytniki ekranu i telefony. Zmiana zapisuje się w ciasteczku i od razu przełącza UI.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const id = useId()
  const { locale, setLocale } = useI18n()
  const t = useMessages(commonMessages).language

  return (
    <div className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <Languages aria-hidden className="size-4 text-ink-soft" />
      <label htmlFor={id} className="sr-only">
        {t.label}
      </label>
      <select
        id={id}
        value={locale}
        onChange={(e) => void setLocale(e.target.value as Locale)}
        className="h-9 cursor-pointer rounded-md border border-line bg-surface pr-8 pl-2.5 text-ink"
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {localeNames[l]}
          </option>
        ))}
      </select>
    </div>
  )
}
