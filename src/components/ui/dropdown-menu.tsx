import type { ComponentProps } from 'react'
import { DropdownMenu as Primitive } from 'radix-ui'
import { cn } from '#/lib/utils'

/**
 * Menu rozwijane z przycisku (np. „Więcej akcji” przy wierszu). Radix obsługuje
 * strzałki, Enter, Esc, fokus i powrót fokusu na przycisk.
 */
export const DropdownMenu = Primitive.Root
export const DropdownMenuTrigger = Primitive.Trigger

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        {...props}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-xl border border-line bg-surface p-1.5 text-ink shadow-[0_16px_48px_-12px_rgba(20,22,43,0.35)] data-[state=open]:animate-[fade-in_120ms_ease-out]',
          className,
        )}
      />
    </Primitive.Portal>
  )
}

export function DropdownMenuItem({
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

export function DropdownMenuSeparator({
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
