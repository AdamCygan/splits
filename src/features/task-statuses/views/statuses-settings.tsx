import { useState } from 'react'
import type { FormEvent } from 'react'
import { Archive, ArchiveRestore, Pencil, Plus, Star } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, ColorDot, ColorPicker, Field } from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { splitArchived } from '#/shared/domain/archive'
import type {
  StatusCategory,
  TaskStatus,
  TaskStatusInput,
} from '#/features/task-statuses/data/dto'
import { LIMITS } from '#/features/task-types/domain/rules'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { mutationFieldError } from '#/shared/data/mutations'
import { statusesQuery } from '../data/queries'
import { usePalette, withCurrent } from '#/features/settings/domain/palette'
import {
  QueryView,
  ReorderButtons,
  SectionHeader,
  SettingsCard,
  useAnnouncer,
} from '#/features/settings/views/ui'
import { move } from '#/shared/domain/move'
import { PlanLimit } from '#/features/billing/views/plan-limit'
import { billingMessages } from '#/i18n/messages/billing'
import { useSaveStatus, useStatuses } from '../controllers/use-statuses'

const categoryTone = {
  todo: 'muted',
  in_progress: 'info',
  done: 'success',
} as const

export function StatusSettings() {
  const t = useMessages(settingsMessages).statuses
  return (
    <div>
      <SectionHeader title={t.title} lead={t.lead} />
      <QueryView query={statusesQuery} skeletonRows={4}>
        {(statuses) => <StatusList statuses={statuses} />}
      </QueryView>
    </div>
  )
}

interface StatusListProps {
  statuses: Array<TaskStatus>
}

function StatusList({ statuses }: StatusListProps) {
  const t = useMessages(settingsMessages).statuses
  const app = useMessages(appMessages)
  const [editing, setEditing] = useState<TaskStatus | 'new' | null>(null)
  const [announcer, announce] = useAnnouncer()
  const { active, archived } = splitArchived(statuses)
  const limits = useMessages(billingMessages).limits

  const { reorder, makeDefault, archive, atLimit } = useStatuses(active.length)

  const onMove = (from: number, to: number) => {
    const next = move(active, from, to)
    reorder.mutate([...next.map((s) => s.id), ...archived.map((s) => s.id)])
    announce(
      fmt(t.moved, {
        name: active[from]!.name,
        position: to + 1,
        total: active.length,
      }),
    )
  }

  return (
    <SettingsCard
      title={t.title}
      lead={t.defaultHint}
      actions={
        <Button
          onClick={() => setEditing('new')}
          disabled={atLimit}
          aria-describedby={atLimit ? 'status-limit' : undefined}
        >
          <Plus aria-hidden className="size-4" />
          {t.add}
        </Button>
      }
    >
      {announcer}
      {atLimit && <PlanLimit id="status-limit">{limits.statuses}</PlanLimit>}
      <ol className="divide-y divide-line">
        {active.map((status, index) => (
          <li
            key={status.id}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          >
            <ReorderButtons
              index={index}
              total={active.length}
              onMove={onMove}
              itemName={status.name}
            />
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="w-5 shrink-0 text-center text-sm text-ink-soft tabular-nums"
                aria-hidden
              >
                {index + 1}
              </span>
              <ColorDot color={status.color} className="size-4 shrink-0" />
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-semibold">
                  <span className="sr-only">
                    {fmt(t.position, {
                      position: index + 1,
                      total: active.length,
                    })}
                    :{' '}
                  </span>
                  {status.name}
                </h3>
                <Badge tone={categoryTone[status.category]}>
                  {t.category[status.category]}
                </Badge>
                {status.isDefault && (
                  <Badge tone="warning">
                    <Star aria-hidden className="size-3" fill="currentColor" />
                    {t.default}
                  </Badge>
                )}
                {status.isSystem && <Badge tone="muted">{t.builtIn}</Badge>}
              </div>
            </div>
            <div className="col-start-2 -ml-3 flex flex-wrap gap-1 sm:col-start-3 sm:row-start-1 sm:ml-0">
              {!status.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={makeDefault.isPending}
                  onClick={() =>
                    makeDefault.mutate({ id: status.id, name: status.name })
                  }
                >
                  <Star aria-hidden className="size-4" />
                  {t.makeDefault}
                  <span className="sr-only">: {status.name}</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(status)}
              >
                <Pencil aria-hidden className="size-4" />
                {app.actions.edit}
                <span className="sr-only">: {status.name}</span>
              </Button>
              {!status.isSystem && !status.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={archive.pending}
                  onClick={() => archive.archive(status)}
                >
                  <Archive aria-hidden className="size-4" />
                  {app.actions.archive}
                  <span className="sr-only">: {status.name}</span>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {archived.length > 0 && (
        <details className="mt-4">
          <summary className="w-fit cursor-pointer rounded-md text-sm font-medium">
            {fmt(t.archivedTitle, { count: archived.length })}
          </summary>
          <ul className="mt-2 divide-y divide-line">
            {archived.map((status) => (
              <li
                key={status.id}
                className="flex items-center gap-3 py-2.5 text-ink-soft"
              >
                <ColorDot color={status.color} />
                <span className="flex-1">{status.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => archive.restore(status)}
                >
                  <ArchiveRestore aria-hidden className="size-4" />
                  {app.actions.restore}
                  <span className="sr-only">: {status.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {editing && (
        <StatusDialog
          status={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </SettingsCard>
  )
}

interface StatusDialogProps {
  status: TaskStatus | null
  onClose: () => void
}

function StatusDialog({ status, onClose }: StatusDialogProps) {
  const t = useMessages(settingsMessages).statuses
  const app = useMessages(appMessages)
  const palette = usePalette()
  const [draft, setDraft] = useState<TaskStatusInput>(() =>
    status
      ? { name: status.name, category: status.category, color: status.color }
      : { name: '', category: 'in_progress', color: '#E5603B' },
  )
  const [submitted, setSubmitted] = useState(false)

  const save = useSaveStatus({ status, onSaved: onClose })

  const nameOk =
    draft.name.trim().length > 0 && draft.name.length <= LIMITS.statusName
  const nameError = nameOk
    ? mutationFieldError(save.error, 'name')
    : t.nameError

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (nameOk) save.mutate({ ...draft, name: draft.name.trim() })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={
          status
            ? fmt(t.dialog.editTitle, { name: status.name })
            : t.dialog.addTitle
        }
        description={t.dialog.description}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="status-form"
              disabled={save.isPending}
              aria-busy={save.isPending}
            >
              {save.isPending
                ? app.actions.saving
                : status
                  ? app.actions.save
                  : t.add}
            </Button>
          </>
        }
      >
        <form
          id="status-form"
          noValidate
          onSubmit={onSubmit}
          className="space-y-6"
        >
          <Field label={t.fields.name} error={submitted ? nameError : null}>
            {(a) => (
              <Input
                {...a}
                autoFocus
                maxLength={LIMITS.statusName}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            )}
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              {t.fields.group}
            </legend>
            <div className="space-y-2">
              {(['todo', 'in_progress', 'done'] as Array<StatusCategory>).map(
                (category) => (
                  <label
                    key={category}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 has-checked:border-ink has-checked:bg-muted/50"
                  >
                    <input
                      type="radio"
                      name="status-category"
                      className="mt-1 accent-[var(--ink)]"
                      checked={draft.category === category}
                      onChange={() => setDraft({ ...draft, category })}
                    />
                    <span>
                      <span className="block font-medium">
                        {t.category[category]}
                      </span>
                      <span className="block text-sm text-ink-soft">
                        {t.categoryHint[category]}
                      </span>
                    </span>
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <ColorPicker
            legend={t.fields.color}
            value={draft.color}
            onChange={(color) => setDraft({ ...draft, color })}
            swatches={withCurrent(palette, draft.color)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
