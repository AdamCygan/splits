import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query'
import { AlertCircle, ArrowDown, ArrowUp } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { panelMessages } from '#/i18n/messages/panel'
import { cn } from '#/lib/utils'

export interface SettingsCardProps {
  title: string
  lead?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  tone?: 'danger'
}

/** Karta sekcji ustawień: nagłówek h2, opis, opcjonalne akcje. */
export function SettingsCard({
  title,
  lead,
  actions,
  children,
  className,
  tone,
}: SettingsCardProps) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'rounded-2xl border bg-surface',
        tone === 'danger' ? 'border-destructive/40' : 'border-line',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0 max-w-[62ch]">
          <h2 id={id} className="type-heading text-2xl">
            {title}
          </h2>
          {lead && (
            <p className="mt-1 text-[0.9375rem] text-ink-soft">{lead}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        )}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}

export interface SectionHeaderProps {
  title: string
  lead?: ReactNode
}

/** Nagłówek strony sekcji (h1). */
export function SectionHeader({ title, lead }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="type-display text-4xl sm:text-5xl">{title}</h1>
      {lead && <p className="mt-3 max-w-[62ch] text-ink-soft">{lead}</p>}
    </div>
  )
}

export interface SaveBarProps {
  dirty: boolean
  saving: boolean
  onDiscard: () => void
  onSave?: () => void
  saveLabel?: string
}

/**
 * Pasek zapisu przy niezapisanych zmianach. Przyklejony do dołu ekranu,
 * ogłaszany czytnikom ekranu (aria-live), z przyciskiem "Odrzuć".
 */
export function SaveBar({
  dirty,
  saving,
  onDiscard,
  onSave,
  saveLabel,
}: SaveBarProps) {
  const t = useMessages(appMessages)
  return (
    <div
      className={cn(
        'sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-6 md:bottom-4',
        !dirty && 'pointer-events-none',
      )}
    >
      {/* Region aria-live musi istnieć przed zmianą treści, więc jest poza ukrywanym paskiem. */}
      <p aria-live="polite" className="sr-only">
        {dirty ? t.status.unsaved : ''}
      </p>
      <div
        role="region"
        aria-label={t.status.unsaved}
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--ink-fixed)] px-4 py-3 text-white shadow-lg transition-[opacity,transform] duration-200',
          dirty ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        )}
        hidden={!dirty}
      >
        <p className="text-sm font-medium">{t.status.unsaved}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={onDiscard}
            disabled={saving}
          >
            {t.actions.discard}
          </Button>
          <Button
            type={onSave ? 'button' : 'submit'}
            onClick={onSave}
            className="bg-white text-[var(--ink-fixed)] hover:bg-white/90"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? t.actions.saving : (saveLabel ?? t.actions.save)}
          </Button>
        </div>
      </div>
    </div>
  )
}

export interface QueryViewProps<T, TKey extends QueryKey> {
  query: UseQueryOptions<T, Error, T, TKey>
  children: (data: T) => ReactNode
  skeletonRows?: number
}

/** Stan ładowania i błędu dla zapytania — dane trafiają do children dopiero, gdy są. */
export function QueryView<T, TKey extends QueryKey>({
  query,
  children,
  skeletonRows = 3,
}: QueryViewProps<T, TKey>) {
  const t = useMessages(appMessages)
  const result = useQuery(query)
  if (result.isPending) {
    return (
      <div role="status" aria-live="polite" className="space-y-3">
        <span className="sr-only">{t.status.loading}</span>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="h-12 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    )
  }
  if (result.isError) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        <AlertCircle aria-hidden className="size-4" />
        <span className="flex-1">{t.status.loadFailed}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void result.refetch()}
        >
          {t.actions.retry}
        </Button>
      </div>
    )
  }
  return <>{children(result.data)}</>
}

export interface ReorderButtonsProps {
  index: number
  total: number
  onMove: (from: number, to: number) => void
  itemName: string
}

/** Przyciski zmiany kolejności — klawiaturowa alternatywa dla przeciągania. */
export function ReorderButtons({
  index,
  total,
  onMove,
  itemName,
}: ReorderButtonsProps) {
  const t = useMessages(appMessages)
  return (
    <div className="flex">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        aria-label={`${t.actions.moveUp}: ${itemName}`}
      >
        <ArrowUp aria-hidden className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label={`${t.actions.moveDown}: ${itemName}`}
      >
        <ArrowDown aria-hidden className="size-4" />
      </Button>
    </div>
  )
}

/** Komunikat dla czytników ekranu (np. po zmianie kolejności). */
export function useAnnouncer() {
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!message) return
    const id = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(id)
  }, [message])
  const node = (
    <div aria-live="polite" className="sr-only">
      {message}
    </div>
  )
  return [node, setMessage] as const
}

/** Ostrzega przed opuszczeniem strony z niezapisanymi zmianami (zamknięcie karty). */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}

export function move<T>(
  list: ReadonlyArray<T>,
  from: number,
  to: number,
): Array<T> {
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item!)
  return copy
}

/** Konto demo nie ma własnego adresu ani hasła: zamiast formularzy krótka informacja. */
export function DemoNotice() {
  const t = useMessages(panelMessages).demo
  return (
    <p className="rounded-2xl border border-line bg-surface px-5 py-4 sm:px-6">
      {t.restricted}{' '}
      <Link
        to="/register"
        className="font-semibold underline underline-offset-4"
      >
        {t.register}
      </Link>
    </p>
  )
}
