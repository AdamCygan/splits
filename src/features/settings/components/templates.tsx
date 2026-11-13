import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { ColorDot, Field, Select } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { data } from '#/data'
import type { QuickTemplate, QuickTemplateInput } from '#/data/types'
import { LIMITS } from '#/domain/rules'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import {
  keys,
  mutationFieldError,
  projectsQuery,
  scaleQuery,
  taskTypesQuery,
  templatesQuery,
  useDataMutation,
} from '../queries'
import { markSetupStep } from '../setup-progress'
import {
  QueryView,
  ReorderButtons,
  SectionHeader,
  SettingsCard,
  move,
  useAnnouncer,
} from './ui'

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-grid min-w-14 place-items-center rounded-md border border-line border-b-[3px] bg-surface px-2 py-0.5 font-sans text-xs font-semibold">
      {children}
    </kbd>
  )
}

export function TemplateSettings() {
  const t = useMessages(settingsMessages).templates
  const app = useMessages(appMessages)
  const format = useFormat()
  const types = useQuery(taskTypesQuery).data ?? []
  const [editing, setEditing] = useState<QuickTemplate | 'new' | null>(null)
  const [deleting, setDeleting] = useState<QuickTemplate | null>(null)
  const [announcer, announce] = useAnnouncer()

  const reorder = useDataMutation(
    (ids: Array<string>) => data.templates.reorder(ids),
    { invalidate: [keys.templates] },
  )
  const remove = useDataMutation((id: string) => data.templates.remove(id), {
    invalidate: [keys.templates],
    success: t.deleted,
    onSuccess: () => setDeleting(null),
  })

  return (
    <div>
      <SectionHeader title={t.title} lead={t.lead} />
      {announcer}
      <SettingsCard
        title={t.title}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden className="size-4" />
            {t.add}
          </Button>
        }
      >
        <QueryView query={templatesQuery}>
          {(templates) =>
            templates.length === 0 ? (
              <p className="text-ink-soft">{t.empty}</p>
            ) : (
              <ol className="divide-y divide-line">
                {templates.map((template, index) => {
                  const type = types.find((x) => x.id === template.taskTypeId)
                  const duration = template.defaultDurationMinutes
                    ? format.minutes(template.defaultDurationMinutes)
                    : '—'
                  return (
                    <li
                      key={template.id}
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                    >
                      <ReorderButtons
                        index={index}
                        total={templates.length}
                        itemName={template.label}
                        onMove={(from, to) => {
                          reorder.mutate(
                            move(templates, from, to).map((x) => x.id),
                          )
                          announce(
                            fmt(t.moved, {
                              name: template.label,
                              position: to + 1,
                              total: templates.length,
                            }),
                          )
                        }}
                      />
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-16 shrink-0">
                          {template.hotkey ? (
                            <Kbd>{fmt(t.shortcut, { n: template.hotkey })}</Kbd>
                          ) : (
                            <span className="text-xs text-ink-soft">
                              {t.noShortcut}
                            </span>
                          )}
                        </span>
                        {type && (
                          <ColorDot color={type.color} className="shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold">{template.label}</h3>
                          <p className="truncate text-sm text-ink-soft">
                            {fmt(t.summary, {
                              type: type?.name ?? '—',
                              duration,
                            })}
                            {template.storyPoints !== null && (
                              <>, {format.sp(template.storyPoints)}</>
                            )}
                            , “{template.title}”
                          </p>
                        </div>
                      </div>
                      <div className="col-start-2 -ml-3 flex gap-1 sm:col-start-3 sm:row-start-1 sm:ml-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(template)}
                        >
                          <Pencil aria-hidden className="size-4" />
                          {app.actions.edit}
                          <span className="sr-only">: {template.label}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleting(template)}
                        >
                          <Trash2 aria-hidden className="size-4" />
                          {app.actions.delete}
                          <span className="sr-only">: {template.label}</span>
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )
          }
        </QueryView>
      </SettingsCard>

      {editing && (
        <TemplateDialog
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={fmt(t.deleteTitle, { name: deleting?.label ?? '' })}
        description={t.deleteText}
        confirmLabel={app.actions.delete}
        cancelLabel={app.actions.cancel}
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  )
}

function TemplateDialog({
  template,
  onClose,
}: {
  template: QuickTemplate | null
  onClose: () => void
}) {
  const t = useMessages(settingsMessages).templates
  const app = useMessages(appMessages)
  const format = useFormat()
  const types = (useQuery(taskTypesQuery).data ?? []).filter(
    (x) => !x.archivedAt || x.id === template?.taskTypeId,
  )
  const projects = (useQuery(projectsQuery).data ?? []).filter(
    (p) => !p.archivedAt || p.id === template?.projectId,
  )
  const scale = useQuery(scaleQuery).data ?? []
  const others = (useQuery(templatesQuery).data ?? []).filter(
    (x) => x.id !== template?.id,
  )

  const [draft, setDraft] = useState({
    label: template?.label ?? '',
    taskTypeId: template?.taskTypeId ?? types[0]?.id ?? '',
    title: template?.title ?? '',
    duration: template?.defaultDurationMinutes?.toString() ?? '',
    storyPoints: template?.storyPoints?.toString() ?? '',
    projectId: template?.projectId ?? '',
    hotkey: template?.hotkey?.toString() ?? '',
  })
  const [submitted, setSubmitted] = useState(false)

  const save = useDataMutation(
    (input: QuickTemplateInput) =>
      template
        ? data.templates.update(template.id, input)
        : data.templates.create(input),
    {
      invalidate: [keys.templates],
      success: template ? app.status.saved : t.created,
      onSuccess: () => {
        markSetupStep('templates')
        onClose()
      },
    },
  )

  const duration = draft.duration.trim() === '' ? null : Number(draft.duration)
  const errors = {
    label:
      draft.label.trim() && draft.label.length <= LIMITS.templateLabel
        ? null
        : t.labelError,
    title:
      draft.title.trim() && draft.title.length <= LIMITS.templateTitle
        ? null
        : t.titleError,
    duration:
      duration === null ||
      (Number.isInteger(duration) &&
        duration >= LIMITS.templateDuration.min &&
        duration <= LIMITS.templateDuration.max)
        ? null
        : t.durationError,
  }
  const invalid = Object.values(errors).some(Boolean) || !draft.taskTypeId
  const selectedType = types.find((x) => x.id === draft.taskTypeId)
  const show = (e: string | null) => (submitted ? e : null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (invalid) return
    save.mutate({
      label: draft.label.trim(),
      taskTypeId: draft.taskTypeId,
      title: draft.title.trim(),
      defaultDurationMinutes: duration,
      storyPoints:
        draft.storyPoints === '' ||
        selectedType?.storyPointsRequirement === 'hidden'
          ? null
          : Number(draft.storyPoints),
      projectId: draft.projectId || null,
      hotkey: draft.hotkey === '' ? null : Number(draft.hotkey),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={
          template
            ? fmt(t.dialog.editTitle, { name: template.label })
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
              form="template-form"
              disabled={save.isPending}
              aria-busy={save.isPending}
            >
              {save.isPending
                ? app.actions.saving
                : template
                  ? app.actions.save
                  : t.add}
            </Button>
          </>
        }
      >
        <form
          id="template-form"
          noValidate
          onSubmit={onSubmit}
          className="space-y-5"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t.fields.label}
              hint={t.fields.labelHint}
              error={show(errors.label)}
            >
              {(a) => (
                <Input
                  {...a}
                  autoFocus
                  maxLength={LIMITS.templateLabel}
                  value={draft.label}
                  onChange={(e) =>
                    setDraft({ ...draft, label: e.target.value })
                  }
                />
              )}
            </Field>
            <Field label={t.fields.type}>
              {(a) => (
                <Select
                  {...a}
                  value={draft.taskTypeId}
                  onChange={(e) =>
                    setDraft({ ...draft, taskTypeId: e.target.value })
                  }
                >
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field label={t.fields.title} error={show(errors.title)}>
            {(a) => (
              <Input
                {...a}
                maxLength={LIMITS.templateTitle}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t.fields.duration}
              hint={t.fields.durationHint}
              error={show(errors.duration)}
            >
              {(a) => (
                <Input
                  {...a}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={720}
                  step={5}
                  value={draft.duration}
                  onChange={(e) =>
                    setDraft({ ...draft, duration: e.target.value })
                  }
                />
              )}
            </Field>
            {selectedType?.storyPointsRequirement !== 'hidden' && (
              <Field label={t.fields.sp}>
                {(a) => (
                  <Select
                    {...a}
                    value={draft.storyPoints}
                    onChange={(e) =>
                      setDraft({ ...draft, storyPoints: e.target.value })
                    }
                  >
                    <option value="">
                      {fmt(t.fields.spDefault, {
                        sp:
                          selectedType?.defaultStoryPoints != null
                            ? format.sp(selectedType.defaultStoryPoints)
                            : t.fields.spNone,
                      })}
                    </option>
                    {scale.map((s) => (
                      <option key={s.points} value={s.points}>
                        {format.sp(s.points)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Field label={t.fields.project}>
              {(a) => (
                <Select
                  {...a}
                  value={draft.projectId}
                  onChange={(e) =>
                    setDraft({ ...draft, projectId: e.target.value })
                  }
                >
                  <option value="">{t.fields.noProject}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={t.fields.hotkey}
              error={
                submitted ? mutationFieldError(save.error, 'hotkey') : null
              }
            >
              {(a) => (
                <Select
                  {...a}
                  value={draft.hotkey}
                  onChange={(e) =>
                    setDraft({ ...draft, hotkey: e.target.value })
                  }
                >
                  <option value="">{t.noShortcut}</option>
                  {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
                    const taken = others.find((x) => x.hotkey === n)
                    return (
                      <option key={n} value={n} disabled={Boolean(taken)}>
                        {taken
                          ? fmt(t.usedBy, { n, label: taken.label })
                          : fmt(t.shortcut, { n })}
                      </option>
                    )
                  })}
                </Select>
              )}
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
