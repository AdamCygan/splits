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
  const t = useMessages(workspacesMessages).settings
  const sections = useMessages(settingsMessages).sections
  return (
    <div className="space-y-6">
      <SectionHeader title={sections.workspaces.title} lead={t.lead} />
      <WorkspaceList />
      <ApplyPreferences />
    </div>
  )
}

function WorkspaceList() {
  const t = useMessages(workspacesMessages)
  const app = useMessages(appMessages)
  const { items, current, canCreate, shortcutOf } = useWorkspaces()
  const actions = useWorkspaceActions()
  const [editing, setEditing] = useState<Workspace | null>(null)
  const [copying, setCopying] = useState<Workspace | null>(null)
  const [deleting, setDeleting] = useState<Workspace | null>(null)

  return (
    <SettingsCard
      title={t.settings.listTitle}
      actions={
        <Button
          onClick={openNewWorkspace}
          disabled={!canCreate}
          aria-describedby={canCreate ? undefined : 'workspace-limit'}
        >
          <Plus aria-hidden className="size-4" />
          {t.settings.create}
        </Button>
      }
    >
      {!canCreate && (
        <PlanLimit id="workspace-limit">{t.settings.limit}</PlanLimit>
      )}
      <ol className="divide-y divide-line">
        {items.map((workspace, i) => {
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
                  {isCurrent && <Badge tone="info">{t.settings.current}</Badge>}
                </h3>
                {shortcut && items.length > 1 && (
                  <p className="text-sm text-ink-soft">
                    {t.settings.shortcut} <Kbd>{shortcut}</Kbd>
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
                    {t.settings.switchTo}
                    <span className="sr-only">: {workspace.name}</span>
                  </Button>
                )}
                {items.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={i === 0}
                      onClick={() => actions.move(workspace.id, -1)}
                      aria-label={`${t.settings.moveUp}: ${workspace.name}`}
                    >
                      <ArrowUp aria-hidden className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={i === items.length - 1}
                      onClick={() => actions.move(workspace.id, 1)}
                      aria-label={`${t.settings.moveDown}: ${workspace.name}`}
                    >
                      <ArrowDown aria-hidden className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCopying(workspace)}
                    >
                      <CopyPlus aria-hidden className="size-4" />
                      {t.settings.copyButton}
                      <span className="sr-only">
                        : {fmt(t.settings.copyLead, { name: workspace.name })}
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
  const t = useMessages(workspacesMessages).settings
  const app = useMessages(appMessages)
  const { remove } = useWorkspaceActions()
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === workspace.name
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={fmt(t.deleteTitle, { name: workspace.name })}
      description={t.deleteBody}
      confirmLabel={app.actions.delete}
      cancelLabel={app.actions.cancel}
      destructive
      busy={remove.isPending}
      disabled={!matches}
      onConfirm={() => {
        if (matches) remove.mutate(workspace, { onSuccess: onClose })
      }}
    >
      <Field label={t.deleteConfirm} className="mt-4">
        {(a) => (
          <Input
            {...a}
            autoComplete="off"
            value={typed}
            placeholder={workspace.name}
            onChange={(e) => setTyped(e.target.value)}
          />
        )}
      </Field>
    </ConfirmDialog>
  )
}

/** Gdzie trafia każdy rodzaj zmian (pytaj / tylko bieżąca / wszystkie) i pytanie na start dnia. */
function ApplyPreferences() {
  const t = useMessages(workspacesMessages)
  const prefs = useApplyPreferences()
  return (
    <SettingsCard title={t.settings.applyTitle} lead={t.settings.applyLead}>
      <div className="space-y-6">
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {prefs.rows.map((row) => (
            <div key={row.kind}>
              <Field label={t.kindTitles[row.kind]}>
                {(a) => (
                  <Select
                    {...a}
                    value={row.value}
                    onChange={(e) =>
                      prefs.set(row.kind, e.target.value as ApplyPreference)
                    }
                  >
                    {APPLY_PREFERENCES.map((p) => (
                      <option key={p} value={p}>
                        {t.preferences[p]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ))}
        </div>
        <Switch
          label={t.settings.askDaily}
          description={t.settings.askDailyHint}
          checked={prefs.askDaily}
          onCheckedChange={prefs.setAskDaily}
        />
      </div>
    </SettingsCard>
  )
}
