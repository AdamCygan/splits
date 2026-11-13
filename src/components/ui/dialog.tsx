import { useEffect, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import {
  AlertDialog as AlertPrimitive,
  Dialog as DialogPrimitive,
} from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '#/lib/utils'
import { Button } from './button'

/**
 * Okna dialogowe na Radix: pułapka fokusu, Esc zamyka, fokus wraca na przycisk,
 * który otworzył okno, a tytuł i opis są podpięte przez aria-labelledby/-describedby.
 */
export const Dialog = DialogPrimitive.Root

/**
 * Radix oddaje fokus tylko do własnego <Trigger>. Nasze okna otwierają się z dowolnych
 * przycisków (często warunkowo renderowane), więc zapamiętujemy element aktywny w chwili
 * otwarcia i wracamy na niego po zamknięciu. Gdy zniknął (np. usunięty wiersz) — na <main>.
 */
function RestoreFocus() {
  const [opener] = useState(() =>
    typeof document === 'undefined'
      ? null
      : (document.activeElement as HTMLElement | null),
  )
  useEffect(
    () => () => {
      setTimeout(() => {
        const target = opener?.isConnected
          ? opener
          : document.getElementById('main')
        target?.focus({ preventScroll: !opener?.isConnected })
      }, 0)
    },
    [opener],
  )
  return null
}
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

const overlay =
  'fixed inset-0 z-50 bg-[rgba(20,22,43,0.45)] data-[state=open]:animate-[fade-in_150ms_ease-out]'
const panel =
  'fixed top-1/2 left-1/2 z-50 flex max-h-[min(90dvh,48rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-line bg-surface shadow-[0_24px_80px_-20px_rgba(20,22,43,0.45)] outline-none data-[state=open]:animate-[dialog-in_180ms_cubic-bezier(0.2,0.7,0.2,1)]'

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  title: string
  description?: ReactNode
  closeLabel: string
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
}

export function DialogContent({
  title,
  description,
  closeLabel,
  size = 'md',
  footer,
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        {...props}
        aria-describedby={description ? undefined : props['aria-describedby']}
        className={cn(
          panel,
          size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl',
          className,
        )}
      >
        <RestoreFocus />
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-5 pb-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="type-heading text-2xl">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-ink-soft">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 shrink-0"
              aria-label={closeLabel}
            >
              <X aria-hidden className="size-5" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
            {footer}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

type ConfirmProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  destructive?: boolean
  busy?: boolean
  children?: ReactNode
}

/** Potwierdzenie akcji nieodwracalnej. Domyślny fokus na "Anuluj" — bezpieczniej dla klawiatury. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive,
  busy,
  children,
}: ConfirmProps) {
  return (
    <AlertPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className={overlay} />
        <AlertPrimitive.Content className={cn(panel, 'max-w-md p-6')}>
          <RestoreFocus />
          <AlertPrimitive.Title className="type-heading text-2xl">
            {title}
          </AlertPrimitive.Title>
          <AlertPrimitive.Description className="mt-2 text-ink-soft">
            {description}
          </AlertPrimitive.Description>
          {children}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AlertPrimitive.Cancel asChild>
              <Button variant="outline">{cancelLabel}</Button>
            </AlertPrimitive.Cancel>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              disabled={busy}
              aria-busy={busy}
              onClick={(e) => {
                e.preventDefault()
                onConfirm()
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  )
}
