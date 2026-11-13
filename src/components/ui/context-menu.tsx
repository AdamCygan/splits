import type { ComponentProps } from 'react'
import { ContextMenu as Primitive } from 'radix-ui'
import { cn } from '#/lib/utils'

/**
 * Menu kontekstowe (prawy przycisk, długie przytrzymanie na ekranie dotykowym,
 * klawisz Menu / Shift+F10). Radix obsługuje strzałki, Enter, Esc i fokus.
 */
export const ContextMenu = Primitive.Root
export const ContextMenuTrigger = Primitive.Trigger

export function ContextMenuContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        {...props}
        className={cn(
          'z-50 min-w-52 overflow-hidden rounded-xl border border-line bg-surface p-1.5 text-ink shadow-[0_16px_48px_-12px_rgba(20,22,43,0.35)] data-[state=open]:animate-[fade-in_120ms_ease-out]',
          className,
        )}
      />
    </Primitive.Portal>
  )
}

export function ContextMenuLabel({
  className,
  ...props
}: ComponentProps<typeof Primitive.Label>) {
  return (
    <Primitive.Label
      {...props}
      className={cn(
        'px-2.5 pt-1 pb-1.5 text-xs font-semibold text-ink-soft',
        className,
      )}
    />
  )
}

export function ContextMenuItem({
  className,
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      {...props}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none select-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-ink-soft',
        className,
      )}
    />
  )
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) {
  return (
    <Primitive.Separator
      {...props}
      className={cn('my-1 h-px bg-line', className)}
    />
  )
}
