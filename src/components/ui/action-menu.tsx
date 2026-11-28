import { useRef } from 'react'
import type { ComponentType } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { cn } from '#/lib/utils'

export interface Action {
  label: string
  icon: ComponentType<{ 'aria-hidden'?: boolean }>
  onSelect: () => void
  destructive?: boolean
}

export interface ActionMenuProps {
  /** Pełna nazwa dla czytników, np. „Więcej akcji: PAY-142, 9:00–10:00”. */
  label: string
  title: string
  actions: ReadonlyArray<Action | null | false>
  className?: string
}

/**
 * Przycisk „⋯” z rzadszymi akcjami. Akcja uruchamia się dopiero po zamknięciu menu,
 * gdy fokus wróci na przycisk: otwierany dialog dostaje fokus (np. pole notatki),
 * a po jego zamknięciu fokus wraca na „⋯”, nie na początek strony.
 */
export function ActionMenu({
  label,
  title,
  actions,
  className,
}: ActionMenuProps) {
  const pending = useRef<(() => void) | null>(null)
  const items = actions.filter((action): action is Action => !!action)
  const plain = items.filter((action) => !action.destructive)
  const destructive = items.filter((action) => action.destructive)
  const item = (action: Action) => (
    <DropdownMenuItem
      key={action.label}
      onSelect={() => {
        pending.current = action.onSelect
      }}
      className={
        action.destructive
          ? 'text-destructive [&_svg]:text-destructive'
          : undefined
      }
    >
      <action.icon aria-hidden />
      {action.label}
    </DropdownMenuItem>
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-8', className)}
          title={title}
          aria-label={label}
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        onCloseAutoFocus={() => {
          const run = pending.current
          pending.current = null
          if (run) setTimeout(run, 0)
        }}
      >
        {plain.map(item)}
        {plain.length > 0 && destructive.length > 0 && (
          <DropdownMenuSeparator />
        )}
        {destructive.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
