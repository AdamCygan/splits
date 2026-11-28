import { useCallback, useState } from 'react'
import { Timer } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Kbd } from '#/components/ui/kbd'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { workspacesMessages } from '#/i18n/messages/workspaces'
import { cn } from '#/lib/utils'
import { useNewWorkspaceRequests } from '../controllers/open-workspace-dialog'
import { useApplyDialog } from '../controllers/use-apply-dialog'
import {
  useDailyPicker,
  useRunningElsewhere,
  useWorkspaceShortcuts,
  useWorkspaceTabsSync,
} from '../controllers/use-workspaces'
import { workspaceShortcut } from '../domain/workspaces'
import { WorkspaceDialog } from './workspace-dialog'
import { WorkspaceMark } from './workspace-switcher'

/**
 * Wszystko, co przestrzenie robią w tle panelu: skróty Alt+Shift+1…9, zgodność kart,
 * okno na start dnia, pytanie „gdzie zastosować” i okno nowej przestrzeni.
 */
export function WorkspaceHosts() {
  useWorkspaceShortcuts()
  useWorkspaceTabsSync()
  return (
    <>
      <DailyPicker />
      <ApplyDialog />
      <NewWorkspaceHost />
    </>
  )
}

function NewWorkspaceHost() {
  const [open, setOpen] = useState(false)
  useNewWorkspaceRequests(useCallback(() => setOpen(true), []))
  if (!open) return null
  return <WorkspaceDialog workspace={null} onClose={() => setOpen(false)} />
}

/** „W czym dziś pracujesz?”: duże przyciski przestrzeni z numerami skrótów. */
function DailyPicker() {
  const messages = useMessages(workspacesMessages).picker
  const app = useMessages(appMessages)
  const picker = useDailyPicker()
  if (!picker.open) return null
  return (
    <Dialog open onOpenChange={(open) => !open && picker.close()}>
      <DialogContent
        size="md"
        title={messages.title}
        description={messages.lead}
        closeLabel={app.actions.close}
      >
        <ul className="grid gap-2">
          {picker.items.map((workspace, index) => {
            const current = workspace.id === picker.current?.id
            const shortcut = workspaceShortcut(index)
            return (
              <li key={workspace.id}>
                <button
                  type="button"
                  autoFocus={current}
                  onClick={() => picker.pick(workspace)}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-colors hover:border-ink/40 hover:bg-muted',
                    current ? 'border-ink' : 'border-line',
                  )}
                >
                  <WorkspaceMark
                    workspace={workspace}
                    className="size-10 rounded-lg text-base"
                  />
                  <span className="min-w-0 flex-1 truncate text-lg font-semibold">
                    {workspace.name}
                  </span>
                  {shortcut && (
                    <Kbd variant="key" className="hidden sm:inline-grid">
                      {shortcut}
                    </Kbd>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={picker.dontAsk}
            onChange={(event) => picker.setDontAsk(event.target.checked)}
            className="mt-0.5 size-4 accent-[var(--ink)]"
          />
          <span>
            <span className="font-medium">{messages.dontAsk}</span>
            <span className="block text-ink-soft">{messages.dontAskHint}</span>
          </span>
        </label>
      </DialogContent>
    </Dialog>
  )
}

/** Pytanie, czy zmiana (dni wolne, sprint, rodzaj pracy…) ma trafić do wszystkich przestrzeni. */
function ApplyDialog() {
  const messages = useMessages(workspacesMessages)
  const app = useMessages(appMessages)
  const dialog = useApplyDialog()
  const { kind } = dialog
  const isClosed = !dialog.open || !kind
  if (isClosed) return null
  const thing = messages.kinds[kind]
  const options = [
    {
      value: 'this' as const,
      label: fmt(messages.apply.onlyHere, { name: dialog.currentName }),
      hint: null,
    },
    {
      value: 'all' as const,
      label: messages.apply.everywhere,
      hint: messages.apply.everywhereHint,
    },
  ]
  return (
    <Dialog open onOpenChange={(open) => !open && dialog.cancel()}>
      <DialogContent
        size="sm"
        title={messages.apply.title}
        description={fmt(messages.apply.lead, { count: dialog.count, thing })}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={dialog.cancel}>
              {app.actions.cancel}
            </Button>
            <Button onClick={dialog.confirm}>{messages.apply.apply}</Button>
          </>
        }
      >
        <fieldset>
          <legend className="sr-only">{messages.apply.title}</legend>
          <div className="grid gap-2">
            {options.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                  dialog.choice === option.value
                    ? 'border-ink bg-surface'
                    : 'border-line hover:border-ink/40',
                )}
              >
                <input
                  type="radio"
                  name="apply-target"
                  value={option.value}
                  checked={dialog.choice === option.value}
                  onChange={() => dialog.setChoice(option.value)}
                  className="mt-1 size-4 accent-[var(--ink)]"
                />
                <span>
                  <span className="block font-medium">{option.label}</span>
                  {option.hint && (
                    <span className="block text-sm text-ink-soft">
                      {option.hint}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={dialog.remember}
            onChange={(event) => dialog.setRemember(event.target.checked)}
            className="mt-0.5 size-4 accent-[var(--ink)]"
          />
          <span>
            <span className="font-medium">
              {fmt(messages.apply.dontAsk, { thing })}
            </span>
            <span className="block text-ink-soft">
              {messages.apply.dontAskHint}
            </span>
          </span>
        </label>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Timer działa w innej przestrzeni (jeden timer na konto): pasek z jego tytułem i przejściem
 * do tamtej przestrzeni. Znika, gdy timer ruszy tutaj.
 */
export function RunningElsewhere() {
  const messages = useMessages(workspacesMessages).elsewhere
  const elsewhere = useRunningElsewhere()
  if (!elsewhere) return null
  const { workspace, entry, go } = elsewhere
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-muted px-4 py-2.5 text-sm sm:px-6 md:px-10"
    >
      <Timer aria-hidden className="size-4 shrink-0" />
      <WorkspaceMark workspace={workspace} className="size-5 text-[0.625rem]" />
      <span className="min-w-0 flex-1 truncate">
        {fmt(messages.running, { name: workspace.name, title: entry.title })}
      </span>
      <Button size="sm" variant="outline" onClick={go}>
        {fmt(messages.go, { name: workspace.name })}
      </Button>
    </div>
  )
}
