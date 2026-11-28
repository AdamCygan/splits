import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, Field, Select, Switch } from '#/components/ui/controls'
import { ConfirmDialog } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Kbd } from '#/components/ui/kbd'
import { PlanLimit } from '#/features/billing/views/plan-limit'
import { SectionHeader, SettingsCard } from '#/features/settings/views/ui'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { workspacesMessages } from '#/i18n/messages/workspaces'
import type { Workspace } from '../data/dto'
import { openNewWorkspace } from '../controllers/open-workspace-dialog'
import { useApplyPreferences } from '../controllers/use-apply-preferences'
import {
  useWorkspaceActions,
  useWorkspaces,
} from '../controllers/use-workspaces'
import { APPLY_PREFERENCES } from '../domain/workspaces'
import type { ApplyPreference } from '../domain/workspaces'
import { CopyDialog, WorkspaceDialog } from './workspace-dialog'
import { WorkspaceMark } from './workspace-switcher'

/** Ustawienia → Przestrzenie: lista, kolejność, kopiowanie, usuwanie i wybory „gdzie zastosować”. */
export function WorkspacesSettings() {
  const messages = useMessages(workspacesMessages).settings
  const sections = useMessages(settingsMessages).sections
  return (
    <div className="space-y-6">
      <SectionHeader title={sections.workspaces.title} lead={messages.lead} />
      <WorkspaceList />
      <ApplyPreferences />
    </div>
  )
}

function WorkspaceList() {
  const messages = useMessages(workspacesMessages)
  const app = useMessages(appMessages)
  const { items, current, canCreate, shortcutOf } = useWorkspaces()
  const actions = useWorkspaceActions()
  const [editing, setEditing] = useState<Workspace | null>(null)
  const [copying, setCopying] = useState<Workspace | null>(null)
  const [deleting, setDeleting] = useState<Workspace | null>(null)

  return (
    <SettingsCard
      title={messages.settings.listTitle}
      actions={
        <Button
          onClick={openNewWorkspace}
          disabled={!canCreate}
          aria-describedby={canCreate ? undefined : 'workspace-limit'}
        >
          <Plus aria-hidden className="size-4" />
          {messages.settings.create}
        </Button>
      }
    >
      {!canCreate && (
        <PlanLimit id="workspace-limit">{messages.settings.limit}</PlanLimit>
      )}
      <ol className="divide-y divide-line">
        {items.map((workspace, index) => {
          const isCurrent = workspace.id === current?.id
          const shortcut = shortcutOf(workspace.id)
          return (
            <li
              key={workspace.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
            >
              <WorkspaceMark workspace={workspace} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">
                  {workspace.name}{' '}
                  {isCurrent && (
                    <Badge tone="info">{messages.settings.current}</Badge>
                  )}
                </h3>
                {shortcut && items.length > 1 && (
                  <p className="text-sm text-ink-soft">
                    {messages.settings.shortcut} <Kbd>{shortcut}</Kbd>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {!isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void actions.switchTo(workspace)}
                  >
                    {messages.settings.switchTo}
                    <span className="sr-only">: {workspace.name}</span>
                  </Button>
                )}
                {items.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => actions.move(workspace.id, -1)}
                      aria-label={`${messages.settings.moveUp}: ${workspace.name}`}
                    >
                      <ArrowUp aria-hidden className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === items.length - 1}
                      onClick={() => actions.move(workspace.id, 1)}
                      aria-label={`${messages.settings.moveDown}: ${workspace.name}`}
                    >
                      <ArrowDown aria-hidden className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCopying(workspace)}
                    >
                      <CopyPlus aria-hidden className="size-4" />
                      {messages.settings.copyButton}
                      <span className="sr-only">
                        :{' '}
                        {fmt(messages.settings.copyLead, {
                          name: workspace.name,
                        })}
                      </span>
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(workspace)}
                >
                  <Pencil aria-hidden className="size-4" />
                  {app.actions.edit}
                  <span className="sr-only">: {workspace.name}</span>
                </Button>
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleting(workspace)}
                  >
                    <Trash2 aria-hidden className="size-4" />
                    {app.actions.delete}
                    <span className="sr-only">: {workspace.name}</span>
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {editing && (
        <WorkspaceDialog workspace={editing} onClose={() => setEditing(null)} />
      )}
      {copying && (
        <CopyDialog target={copying} onClose={() => setCopying(null)} />
      )}
      {deleting && (
        <DeleteWorkspace
          workspace={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </SettingsCard>
  )
}

interface DeleteWorkspaceProps {
  workspace: Workspace
  onClose: () => void
}

/** Usunięcie przestrzeni z całą zawartością: potwierdzenie wpisaniem nazwy. */
function DeleteWorkspace({ workspace, onClose }: DeleteWorkspaceProps) {
  const messages = useMessages(workspacesMessages).settings
  const app = useMessages(appMessages)
  const { remove } = useWorkspaceActions()
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === workspace.name
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={fmt(messages.deleteTitle, { name: workspace.name })}
      description={messages.deleteBody}
      confirmLabel={app.actions.delete}
      cancelLabel={app.actions.cancel}
      destructive
      busy={remove.isPending}
      disabled={!matches}
      onConfirm={() => {
        if (matches) remove.mutate(workspace, { onSuccess: onClose })
      }}
    >
      <Field label={messages.deleteConfirm} className="mt-4">
        {(fieldProps) => (
          <Input
            {...fieldProps}
            autoComplete="off"
            value={typed}
            placeholder={workspace.name}
            onChange={(event) => setTyped(event.target.value)}
          />
        )}
      </Field>
    </ConfirmDialog>
  )
}

/** Gdzie trafia każdy rodzaj zmian (pytaj / tylko bieżąca / wszystkie) i pytanie na start dnia. */
function ApplyPreferences() {
  const messages = useMessages(workspacesMessages)
  const prefs = useApplyPreferences()
  return (
    <SettingsCard
      title={messages.settings.applyTitle}
      lead={messages.settings.applyLead}
    >
      <div className="space-y-6">
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {prefs.rows.map((row) => (
            <div key={row.kind}>
              <Field label={messages.kindTitles[row.kind]}>
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    value={row.value}
                    onChange={(event) =>
                      prefs.set(row.kind, event.target.value as ApplyPreference)
                    }
                  >
                    {APPLY_PREFERENCES.map((applyPreference) => (
                      <option key={applyPreference} value={applyPreference}>
                        {messages.preferences[applyPreference]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ))}
        </div>
        <Switch
          label={messages.settings.askDaily}
          description={messages.settings.askDailyHint}
          checked={prefs.askDaily}
          onCheckedChange={prefs.setAskDaily}
        />
      </div>
    </SettingsCard>
  )
}
