import { Link } from '@tanstack/react-router'
import { Check, ChevronsUpDown, Plus, Settings2 } from 'lucide-react'
import { Badge } from '#/components/ui/controls'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Kbd } from '#/components/ui/kbd'
import { useMessages } from '#/i18n/context'
import { workspacesMessages } from '#/i18n/messages/workspaces'
import { cn } from '#/lib/utils'
import type { Workspace } from '../data/dto'
import { openNewWorkspace } from '../controllers/open-workspace-dialog'
import {
  useSwitchWorkspace,
  useWorkspaces,
} from '../controllers/use-workspaces'

export interface WorkspaceMarkProps {
  workspace: Pick<Workspace, 'name' | 'color'>
  className?: string
}

/** Znak przestrzeni: kwadrat w jej kolorze z pierwszą literą nazwy (dekoracja, nazwa jest obok). */
export function WorkspaceMark({ workspace, className }: WorkspaceMarkProps) {
  return (
    <span
      aria-hidden
      data-initial={workspace.name.trim().charAt(0).toUpperCase() || '?'}
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold text-white before:content-[attr(data-initial)]',
        className,
      )}
      style={{ background: workspace.color }}
    />
  )
}

export interface WorkspaceSwitcherProps {
  /** Telefon: węższy przycisk w górnym pasku. */
  compact?: boolean
}

/**
 * Przełącznik przestrzeni na górze panelu: bieżąca przestrzeń, lista z skrótami
 * Alt+Shift+1…9, nowa przestrzeń i ustawienia. Jedno kliknięcie zmienia całą aplikację.
 */
export function WorkspaceSwitcher({ compact = false }: WorkspaceSwitcherProps) {
  const t = useMessages(workspacesMessages)
  const { items, current, canCreate, shortcutOf } = useWorkspaces()
  const switchTo = useSwitchWorkspace()
  if (!current) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex min-w-0 items-center gap-2.5 rounded-lg text-left hover:bg-muted data-[state=open]:bg-muted',
            compact
              ? 'max-w-[11rem] px-1.5 py-1.5'
              : 'w-full border border-line px-2 py-2',
          )}
        >
          <WorkspaceMark
            workspace={current}
            className={compact ? 'size-6' : undefined}
          />
          <span className="min-w-0 flex-1">
            {/* Nazwa przycisku = widoczny tekst („Przestrzeń Acme”) + ukryte „zmień”. */}
            <span
              className={compact ? 'sr-only' : 'block text-xs text-ink-soft'}
            >
              {t.label}
            </span>
            <span className="block truncate text-sm font-semibold">
              {current.name}
            </span>
            <span className="sr-only">{t.switcher.open}</span>
          </span>
          <ChevronsUpDown
            aria-hidden
            className="size-4 shrink-0 text-ink-soft"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t.switcher.heading}</DropdownMenuLabel>
        {items.map((workspace) => {
          const active = workspace.id === current.id
          const shortcut = shortcutOf(workspace.id)
          return (
            <DropdownMenuItem
              key={workspace.id}
              onSelect={() => void switchTo(workspace)}
              aria-current={active ? 'true' : undefined}
            >
              <WorkspaceMark workspace={workspace} className="size-6" />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {active ? (
                <>
                  <Check aria-hidden className="size-4" />
                  <span className="sr-only">{t.switcher.current}</span>
                </>
              ) : (
                shortcut && <Kbd className="text-ink-soft">{shortcut}</Kbd>
              )}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        {canCreate ? (
          <DropdownMenuItem onSelect={openNewWorkspace}>
            <Plus aria-hidden />
            {t.switcher.create}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link to="/app/settings/plan">
              <Plus aria-hidden />
              <span className="flex-1">{t.switcher.create}</span>
              <Badge tone="info">{t.switcher.proOnly}</Badge>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/app/settings/workspaces">
            <Settings2 aria-hidden />
            {t.switcher.manage}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
