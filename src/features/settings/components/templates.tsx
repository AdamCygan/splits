import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { selectable } from '#/domain/archive'
import { Button } from '#/components/ui/button'
import { ColorDot, Field, Select } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { templatesApi } from '#/features/templates/data/api'
import type {
  QuickTemplate,
  QuickTemplateInput,
} from '#/features/templates/data/dto'
import { LIMITS } from '#/domain/rules'
import { scheduleRuns } from '#/domain/schedule'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, weekdayNames } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import {
  keys,
  mutationFieldError,
  projectsQuery,
  scaleQuery,
  settingsQuery,
  taskTypesQuery,
  templatesQuery,
  useDataMutation,
} from '../queries'
import { markSetupStep } from '../setup-progress'
import {
  ScheduleFields,
  scheduleDraft,
  scheduleErrors,
  scheduleFromDraft,
} from './template-schedule'
import {
  QueryView,
  ReorderButtons,
  SectionHeader,
  SettingsCard,
  move,
  useAnnouncer,
} from './ui'
import { Kbd } from '#/components/ui/kbd'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import {
  PlanLimit,
  useFreePlan,
} from '#/features/billing/components/plan-limit'
import { billingMessages } from '#/i18n/messages/billing'

/** Wartość pola „Projekt” dla szablonu, w którym projekt wybiera się przy użyciu. */
const ANY = '__any'

export function TemplateSettings() {
  const t = useMessages(settingsMessages).templates
  const app = useMessages(appMessages)
  const format = useFormat()
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = useQuery(projectsQuery).data ?? []
  const templatesData = useQuery(templatesQuery).data
  const isFree = useFreePlan()
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
        (r) =>
          `${shortDays[r.from]}${r.to !== r.from ? `–${shortDays[r.to]}` : ''} ${format.time(r.time)}`,
      )
      .join(', ')

  const reorder = useDataMutation(
    (ids: Array<string>) => templatesApi.reorder(ids),
    { invalidate: [keys.templates] },
  )
  const remove = useDataMutation((id: string) => templatesApi.remove(id), {
    invalidate: [keys.templates],
    success: t.deleted,
    onSuccess: () => setDeleting(null),
  })

  const atLimit =
    isFree && (templatesData ?? []).length >= FREE_LIMITS.quickTemplates

  return (
    <div>
      <SectionHeader title={t.title} lead={t.lead} />
      {announcer}
      <SettingsCard
        title={t.title}
        actions={
          <Button
            onClick={() => setEditing('new')}
            disabled={atLimit}
            aria-describedby={atLimit ? 'template-limit' : undefined}
          >
            <Plus aria-hidden className="size-4" />
            {t.add}
          </Button>
        }
      >
        {atLimit && (
          <PlanLimit id="template-limit">{limits.templates}</PlanLimit>
        )}
        <QueryView query={templatesQuery}>
          {(templates) =>
            templates.length === 0 ? (
              <p className="text-ink-soft">{t.empty}</p>
            ) : (
              <ol className="divide-y divide-line">
                {templates.map((template, index) => {
                  const type = types.find((x) => x.id === template.taskTypeId)
                  const project = projects.find(
                    (p) => p.id === template.projectId,
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
                            <Kbd variant="key">
                              {fmt(t.shortcut, { n: template.hotkey })}
                            </Kbd>
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
                            {template.askProject ? (
                              <>, {t.anyProject}</>
                            ) : (
                              project && <>, {project.name}</>
                            )}
                            , “{template.title}”
                          </p>
                          {template.schedule.length > 0 && (
                            <p className="text-sm text-ink-soft">
                              {fmt(t.schedule.summary, {
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

interface TemplateDialogProps {
  template: QuickTemplate | null
  onClose: () => void
}

function TemplateDialog({ template, onClose }: TemplateDialogProps) {
  const t = useMessages(settingsMessages).templates
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
    (x) => x.id !== template?.id,
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

  const save = useDataMutation(
    (input: QuickTemplateInput) =>
      template
        ? templatesApi.update(template.id, input)
        : templatesApi.create(input),
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
  const scheduleIssues = scheduleErrors(schedule, t.schedule)
  const durationMissing =
    schedule.enabled && duration === null ? t.schedule.durationNeeded : null
  const invalid =
    Object.values(errors).some(Boolean) ||
    !draft.taskTypeId ||
    !!durationMissing ||
    !!scheduleIssues.days ||
    !!scheduleIssues.time ||
    Object.keys(scheduleIssues.dayTimes).length > 0
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
              error={show(errors.duration ?? durationMissing)}
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
            <Field
              label={t.fields.project}
              hint={
                draft.projectId === ANY ? t.fields.anyProjectHint : undefined
              }
            >
              {(a) => (
                <Select
                  {...a}
                  value={draft.projectId}
                  onChange={(e) =>
                    setDraft({ ...draft, projectId: e.target.value })
                  }
                >
                  <option value="">{t.fields.noProject}</option>
                  {(projects.length > 1 || draft.projectId === ANY) && (
                    <option value={ANY}>{t.fields.anyProject}</option>
                  )}
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
