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
  const messages = useMessages(workspacesMessages)
  const app = useMessages(appMessages)
  const palette = usePalette()
  const form = useWorkspaceForm({ workspace, onDone: onClose })
  const source = form.sources.find(
    (sourceWorkspace) => sourceWorkspace.id === form.copyFrom,
  )

  const onSubmit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    form.submit()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="md"
        title={
          workspace
            ? fmt(messages.dialog.editTitle, { name: workspace.name })
            : messages.dialog.addTitle
        }
        description={form.isNew ? messages.settings.lead : undefined}
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
                  ? messages.dialog.create
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
          <Field label={messages.dialog.name} error={form.nameError}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                autoFocus
                maxLength={WORKSPACE_NAME_MAX}
                placeholder={messages.dialog.namePlaceholder}
                value={form.name}
                onChange={(event) => form.setName(event.target.value)}
              />
            )}
          </Field>
          <ColorPicker
            legend={messages.dialog.color}
            value={form.color}
            onChange={form.setColor}
            swatches={withCurrent(palette, form.color)}
          />
          {form.isNew && (
            <>
              <Field label={messages.dialog.copyFrom}>
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    value={form.copyFrom}
                    onChange={(event) => form.setCopyFrom(event.target.value)}
                  >
                    <option value="">{messages.dialog.blank}</option>
                    {form.sources.map((workspaceOption) => (
                      <option
                        key={workspaceOption.id}
                        value={workspaceOption.id}
                      >
                        {workspaceOption.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {source && (
                <CheckboxGroup
                  legend={fmt(messages.dialog.copyWhat, { name: source.name })}
                  options={form.copyKinds.map((kind) => ({
                    value: kind,
                    label: messages.copyKinds[kind],
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
  const messages = useMessages(workspacesMessages)
  const app = useMessages(appMessages)
  const form = useCopyForm({ target, onDone: onClose })

  const onSubmit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    form.submit()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="md"
        title={messages.settings.copyTitle}
        description={fmt(messages.settings.copyLead, { name: target.name })}
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
              {messages.settings.copyButton}
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
          <Field label={messages.settings.copyFrom}>
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={form.from}
                onChange={(event) => form.setFrom(event.target.value)}
              >
                {form.sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <CheckboxGroup
            legend={messages.settings.copyWhat}
            options={form.copyKinds.map((kind) => ({
              value: kind,
              label: messages.copyKinds[kind],
            }))}
            value={form.kinds}
            onChange={form.setKinds}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
