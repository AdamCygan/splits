import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { selectable } from '#/shared/domain/archive'
import { Button } from '#/components/ui/button'
import { ColorDot, Field, Select } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import type { QuickTemplate } from '#/features/templates/data/dto'
import { LIMITS } from '#/features/task-types/domain/rules'
import { scheduleRuns } from '#/features/templates/domain/schedule'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, weekdayNames } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { mutationFieldError } from '#/shared/data/mutations'
import { projectsQuery } from '#/features/projects/data/queries'
import { scaleQuery } from '#/features/story-points/data/queries'
import { settingsQuery } from '#/features/settings/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { templatesQuery } from '../data/queries'
import { ScheduleFields } from './template-schedule'
import {
  scheduleDraft,
  scheduleErrors,
  scheduleFromDraft,
} from '../domain/schedule-draft'
import {
  QueryView,
  ReorderButtons,
  SectionHeader,
  SettingsCard,
  useAnnouncer,
} from '#/features/settings/views/ui'
import { move } from '#/shared/domain/move'
import { Kbd } from '#/components/ui/kbd'
import { PlanLimit } from '#/features/billing/views/plan-limit'
import { billingMessages } from '#/i18n/messages/billing'
import { useSaveTemplate, useTemplates } from '../controllers/use-templates'

/** Wartość pola „Projekt” dla szablonu, w którym projekt wybiera się przy użyciu. */
const ANY = '__any'

export function TemplateSettings() {
  const messages = useMessages(settingsMessages).templates
  const app = useMessages(appMessages)
  const format = useFormat()
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = useQuery(projectsQuery).data ?? []
  const limits = useMessages(billingMessages).limits
  const [editing, setEditing] = useState<QuickTemplate | 'new' | null>(null)
  const [deleting, setDeleting] = useState<QuickTemplate | null>(null)
  const [announcer, announce] = useAnnouncer()
  const { locale } = useI18n()
  const weekStartsOn = useQuery(settingsQuery).data?.weekStartsOn ?? 1
  const shortDays = weekdayNames(locale, 'short')
  /** „pn 10:00, wt–pt 9:30” */
  const describeSchedule = (schedule: QuickTemplate['schedule']) =>
    scheduleRuns(schedule, weekStartsOn)
      .map(
        (scheduleRun) =>
          `${shortDays[scheduleRun.from]}${scheduleRun.to !== scheduleRun.from ? `–${shortDays[scheduleRun.to]}` : ''} ${format.time(scheduleRun.time)}`,
      )
      .join(', ')

  const { reorder, remove, atLimit } = useTemplates(() => setDeleting(null))

  return (
    <div>
      <SectionHeader title={messages.title} lead={messages.lead} />
      {announcer}
      <SettingsCard
        title={messages.title}
        actions={
          <Button
            onClick={() => setEditing('new')}
            disabled={atLimit}
            aria-describedby={atLimit ? 'template-limit' : undefined}
          >
            <Plus aria-hidden className="size-4" />
            {messages.add}
          </Button>
        }
      >
        {atLimit && (
          <PlanLimit id="template-limit">{limits.templates}</PlanLimit>
        )}
        <QueryView query={templatesQuery}>
          {(templates) =>
            templates.length === 0 ? (
              <p className="text-ink-soft">{messages.empty}</p>
            ) : (
              <ol className="divide-y divide-line">
                {templates.map((template, index) => {
                  const type = types.find(
                    (workType) => workType.id === template.taskTypeId,
                  )
                  const project = projects.find(
                    (candidate) => candidate.id === template.projectId,
                  )
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
                            move(templates, from, to).map(
                              (listedTemplate) => listedTemplate.id,
                            ),
                          )
                          announce(
                            fmt(messages.moved, {
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
                            <Kbd variant="key">
                              {fmt(messages.shortcut, { n: template.hotkey })}
                            </Kbd>
                          ) : (
                            <span className="text-xs text-ink-soft">
                              {messages.noShortcut}
                            </span>
                          )}
                        </span>
                        {type && (
                          <ColorDot color={type.color} className="shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold">{template.label}</h3>
                          <p className="truncate text-sm text-ink-soft">
                            {fmt(messages.summary, {
                              type: type?.name ?? '—',
                              duration,
                            })}
                            {template.storyPoints !== null && (
                              <>, {format.sp(template.storyPoints)}</>
                            )}
                            {template.askProject ? (
                              <>, {messages.anyProject}</>
                            ) : (
                              project && <>, {project.name}</>
                            )}
                            , “{template.title}”
                          </p>
                          {template.schedule.length > 0 && (
                            <p className="text-sm text-ink-soft">
                              {fmt(messages.schedule.summary, {
                                when: describeSchedule(template.schedule),
                              })}
                            </p>
                          )}
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
        title={fmt(messages.deleteTitle, { name: deleting?.label ?? '' })}
        description={messages.deleteText}
        confirmLabel={app.actions.delete}
        cancelLabel={app.actions.cancel}
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  )
}

interface TemplateDialogProps {
  template: QuickTemplate | null
  onClose: () => void
}

function TemplateDialog({ template, onClose }: TemplateDialogProps) {
  const messages = useMessages(settingsMessages).templates
  const app = useMessages(appMessages)
  const format = useFormat()
  const types = selectable(
    useQuery(taskTypesQuery).data ?? [],
    template?.taskTypeId,
  )
  const projects = selectable(
    useQuery(projectsQuery).data ?? [],
    template?.projectId,
  )
  const scale = useQuery(scaleQuery).data ?? []
  const others = (useQuery(templatesQuery).data ?? []).filter(
    (otherTemplate) => otherTemplate.id !== template?.id,
  )

  const [draft, setDraft] = useState({
    label: template?.label ?? '',
    taskTypeId: template?.taskTypeId ?? types[0]?.id ?? '',
    title: template?.title ?? '',
    duration: template?.defaultDurationMinutes?.toString() ?? '',
    storyPoints: template?.storyPoints?.toString() ?? '',
    projectId: template?.askProject ? ANY : (template?.projectId ?? ''),
    hotkey: template?.hotkey?.toString() ?? '',
  })
  const [schedule, setSchedule] = useState(() =>
    scheduleDraft(template?.schedule ?? []),
  )
  const weekStartsOn = useQuery(settingsQuery).data?.weekStartsOn ?? 1
  const [submitted, setSubmitted] = useState(false)

  const save = useSaveTemplate({ template, onSaved: onClose })

  const duration = draft.duration.trim() === '' ? null : Number(draft.duration)
  const errors = {
    label:
      draft.label.trim() && draft.label.length <= LIMITS.templateLabel
        ? null
        : messages.labelError,
    title:
      draft.title.trim() && draft.title.length <= LIMITS.templateTitle
        ? null
        : messages.titleError,
    duration:
      duration === null ||
      (Number.isInteger(duration) &&
        duration >= LIMITS.templateDuration.min &&
        duration <= LIMITS.templateDuration.max)
        ? null
        : messages.durationError,
  }
  const scheduleIssues = scheduleErrors(schedule, messages.schedule)
  const durationMissing =
    schedule.enabled && duration === null
      ? messages.schedule.durationNeeded
      : null
  const invalid =
    Object.values(errors).some(Boolean) ||
    !draft.taskTypeId ||
    !!durationMissing ||
    !!scheduleIssues.days ||
    !!scheduleIssues.time ||
    Object.keys(scheduleIssues.dayTimes).length > 0
  const selectedType = types.find(
    (archivable) => archivable.id === draft.taskTypeId,
  )
  const show = (error: string | null) => (submitted ? error : null)

  const onSubmit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
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
      projectId: draft.projectId === ANY ? null : draft.projectId || null,
      askProject: draft.projectId === ANY,
      hotkey: draft.hotkey === '' ? null : Number(draft.hotkey),
      schedule: scheduleFromDraft(schedule),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={
          template
            ? fmt(messages.dialog.editTitle, { name: template.label })
            : messages.dialog.addTitle
        }
        description={messages.dialog.description}
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
                  : messages.add}
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
              label={messages.fields.label}
              hint={messages.fields.labelHint}
              error={show(errors.label)}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  autoFocus
                  maxLength={LIMITS.templateLabel}
                  value={draft.label}
                  onChange={(event) =>
                    setDraft({ ...draft, label: event.target.value })
                  }
                />
              )}
            </Field>
            <Field label={messages.fields.type}>
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={draft.taskTypeId}
                  onChange={(event) =>
                    setDraft({ ...draft, taskTypeId: event.target.value })
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
          <Field label={messages.fields.title} error={show(errors.title)}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                maxLength={LIMITS.templateTitle}
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={messages.fields.duration}
              hint={messages.fields.durationHint}
              error={show(errors.duration ?? durationMissing)}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={720}
                  step={5}
                  value={draft.duration}
                  onChange={(event) =>
                    setDraft({ ...draft, duration: event.target.value })
                  }
                />
              )}
            </Field>
            {selectedType?.storyPointsRequirement !== 'hidden' && (
              <Field label={messages.fields.sp}>
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    value={draft.storyPoints}
                    onChange={(event) =>
                      setDraft({ ...draft, storyPoints: event.target.value })
                    }
                  >
                    <option value="">
                      {fmt(messages.fields.spDefault, {
                        sp:
                          selectedType?.defaultStoryPoints != null
                            ? format.sp(selectedType.defaultStoryPoints)
                            : messages.fields.spNone,
                      })}
                    </option>
                    {scale.map((step) => (
                      <option key={step.points} value={step.points}>
                        {format.sp(step.points)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Field
              label={messages.fields.project}
              hint={
                draft.projectId === ANY
                  ? messages.fields.anyProjectHint
                  : undefined
              }
            >
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={draft.projectId}
                  onChange={(event) =>
                    setDraft({ ...draft, projectId: event.target.value })
                  }
                >
                  <option value="">{messages.fields.noProject}</option>
                  {(projects.length > 1 || draft.projectId === ANY) && (
                    <option value={ANY}>{messages.fields.anyProject}</option>
                  )}
                  {projects.map((archivable) => (
                    <option key={archivable.id} value={archivable.id}>
                      {archivable.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={messages.fields.hotkey}
              error={
                submitted ? mutationFieldError(save.error, 'hotkey') : null
              }
            >
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={draft.hotkey}
                  onChange={(event) =>
                    setDraft({ ...draft, hotkey: event.target.value })
                  }
                >
                  <option value="">{messages.noShortcut}</option>
                  {Array.from({ length: 9 }, (_unused, index) => index + 1).map(
                    (part) => {
                      const taken = others.find(
                        (other) => other.hotkey === part,
                      )
                      return (
                        <option
                          key={part}
                          value={part}
                          disabled={Boolean(taken)}
                        >
                          {taken
                            ? fmt(messages.usedBy, {
                                n: part,
                                label: taken.label,
                              })
                            : fmt(messages.shortcut, { n: part })}
                        </option>
                      )
                    },
                  )}
                </Select>
              )}
            </Field>
          </div>
          <ScheduleFields
            value={schedule}
            onChange={setSchedule}
            weekStartsOn={weekStartsOn}
            errors={submitted ? scheduleIssues : null}
            durationMissing={submitted ? durationMissing : null}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
