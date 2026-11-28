import type { FormEvent } from 'react'
import { Button } from '#/components/ui/button'
import {
  CheckboxGroup,
  ColorPicker,
  Field,
  Select,
} from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { usePalette, withCurrent } from '#/features/settings/domain/palette'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { workspacesMessages } from '#/i18n/messages/workspaces'
import type { Workspace } from '../data/dto'
import { useCopyForm } from '../controllers/use-copy-form'
import { useWorkspaceForm } from '../controllers/use-workspace-form'
import { WORKSPACE_NAME_MAX } from '../domain/workspaces'

export interface WorkspaceDialogProps {
  /** Edytowana przestrzeń albo null dla nowej. */
  workspace: Workspace | null
  onClose: () => void
}

/** Nowa przestrzeń (nazwa, kolor, z czego skopiować) albo zmiana nazwy i koloru. */
export function WorkspaceDialog({ workspace, onClose }: WorkspaceDialogProps) {
  const t = useMessages(workspacesMessages)
  const app = useMessages(appMessages)
  const palette = usePalette()
  const form = useWorkspaceForm({ workspace, onDone: onClose })
  const source = form.sources.find((w) => w.id === form.copyFrom)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    form.submit()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="md"
        title={
          workspace
            ? fmt(t.dialog.editTitle, { name: workspace.name })
            : t.dialog.addTitle
        }
        description={form.isNew ? t.settings.lead : undefined}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="workspace-form"
              disabled={form.pending}
              aria-busy={form.pending}
            >
              {form.pending
                ? app.actions.saving
                : form.isNew
                  ? t.dialog.create
                  : app.actions.save}
            </Button>
          </>
        }
      >
        <form
          id="workspace-form"
          noValidate
          onSubmit={onSubmit}
          className="space-y-5"
        >
          <Field label={t.dialog.name} error={form.nameError}>
            {(a) => (
              <Input
                {...a}
                autoFocus
                maxLength={WORKSPACE_NAME_MAX}
                placeholder={t.dialog.namePlaceholder}
                value={form.name}
                onChange={(e) => form.setName(e.target.value)}
              />
            )}
          </Field>
          <ColorPicker
            legend={t.dialog.color}
            value={form.color}
            onChange={form.setColor}
            swatches={withCurrent(palette, form.color)}
          />
          {form.isNew && (
            <>
              <Field label={t.dialog.copyFrom}>
                {(a) => (
                  <Select
                    {...a}
                    value={form.copyFrom}
                    onChange={(e) => form.setCopyFrom(e.target.value)}
                  >
                    <option value="">{t.dialog.blank}</option>
                    {form.sources.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {source && (
                <CheckboxGroup
                  legend={fmt(t.dialog.copyWhat, { name: source.name })}
                  options={form.copyKinds.map((kind) => ({
                    value: kind,
                    label: t.copyKinds[kind],
                  }))}
                  value={form.copy}
                  onChange={form.setCopy}
                />
              )}
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

export interface CopyDialogProps {
  target: Workspace
  onClose: () => void
}

/** Kopiowanie wybranych rzeczy z innej przestrzeni do `target`. */
export function CopyDialog({ target, onClose }: CopyDialogProps) {
  const t = useMessages(workspacesMessages)
  const app = useMessages(appMessages)
  const form = useCopyForm({ target, onDone: onClose })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    form.submit()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="md"
        title={t.settings.copyTitle}
        description={fmt(t.settings.copyLead, { name: target.name })}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="workspace-copy-form"
              disabled={!form.canSubmit || form.pending}
              aria-busy={form.pending}
            >
              {t.settings.copyButton}
            </Button>
          </>
        }
      >
        <form
          id="workspace-copy-form"
          noValidate
          onSubmit={onSubmit}
          className="space-y-5"
        >
          <Field label={t.settings.copyFrom}>
            {(a) => (
              <Select
                {...a}
                value={form.from}
                onChange={(e) => form.setFrom(e.target.value)}
              >
                {form.sources.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <CheckboxGroup
            legend={t.settings.copyWhat}
            options={form.copyKinds.map((kind) => ({
              value: kind,
              label: t.copyKinds[kind],
            }))}
            value={form.kinds}
            onChange={form.setKinds}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
