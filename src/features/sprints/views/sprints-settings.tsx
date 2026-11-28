import {
  useRemoveSprint,
  useSaveCadence,
  useSaveSprint,
} from '../controllers/use-sprint-settings'
import { cadenceQuery, sprintsQuery } from '../data/queries'
import { PRESETS, toDraft } from '../domain/cadence-draft'
import type { LengthChoice } from '../domain/cadence-draft'
import { goalDrafts, goalsFromDrafts } from '../domain/time-goals'
import { TimeGoalsField } from './sprint-time-goals'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { Badge, Field, Switch, Textarea } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Segmented } from '#/components/ui/segmented'
import { settingsQuery } from '#/features/settings/data/queries'
import {
  QueryView,
  SaveBar,
  SectionHeader,
  SettingsCard,
} from '#/features/settings/views/ui'
import type { Sprint, SprintCadence } from '#/features/sprints/data/dto'
import {
  previewCadence,
  sprintPhase,
  sprintWorkingDays,
} from '#/features/sprints/domain/sprints'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { LIMITS } from '#/features/task-types/domain/rules'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDateRange } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { mutationFieldError } from '#/shared/data/mutations'
import { isValidDate, todayIn } from '#/shared/domain/dates'
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

export function SprintSettings() {
  const messages = useMessages(settingsMessages)
  return (
    <div className="space-y-6">
      <SectionHeader
        title={messages.sections.sprints.title}
        lead={messages.sprints.scheduleLead}
      />
      <QueryView query={cadenceQuery} skeletonRows={4}>
        {(cadence) => <ScheduleCard cadence={cadence} />}
      </QueryView>
      <SprintList />
    </div>
  )
}

interface ScheduleCardProps {
  cadence: SprintCadence | null
}

function ScheduleCard({ cadence }: ScheduleCardProps) {
  const messages = useMessages(settingsMessages).sprints
  const app = useMessages(appMessages)
  const { locale } = useI18n()
  const format = useFormat()
  const settings = useQuery(settingsQuery).data
  const [editing, setEditing] = useState(cadence !== null)
  const [draft, setDraft] = useState(() => toDraft(cadence, 'Sprint {n}'))
  const [submitted, setSubmitted] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  useEffect(() => {
    setDraft(toDraft(cadence, 'Sprint {n}'))
    setEditing(cadence !== null)
  }, [cadence])

  const save = useSaveCadence()

  const lengthDays =
    draft.length === 'custom' ? Number(draft.customDays) : Number(draft.length)
  const errors = {
    length:
      Number.isInteger(lengthDays) &&
      lengthDays >= LIMITS.sprintLengthDays.min &&
      lengthDays <= LIMITS.sprintLengthDays.max
        ? null
        : messages.customDaysError,
    anchor: isValidDate(draft.anchorDate) ? null : messages.dateError,
    pattern:
      draft.namePattern.trim() && draft.namePattern.length <= LIMITS.sprintName
        ? null
        : messages.patternError,
  }
  const valid = !errors.length && !errors.anchor && !errors.pattern
  const next: SprintCadence = {
    lengthDays,
    anchorDate: draft.anchorDate,
    namePattern: draft.namePattern.trim(),
    autoCreate: draft.autoCreate,
  }
  const dirty =
    cadence === null
      ? editing
      : JSON.stringify(next) !== JSON.stringify(cadence)
  const preview = valid ? previewCadence(next, todayIn(settings?.timezone)) : []
  const show = (error: string | null) => (submitted ? error : null)

  const onSubmit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    setSubmitted(true)
    if (valid) save.mutate(next)
  }

  if (!editing) {
    return (
      <SettingsCard title={messages.scheduleTitle}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-ink-soft">{messages.noSchedule}</p>
          <Button onClick={() => setEditing(true)}>{messages.setUp}</Button>
        </div>
      </SettingsCard>
    )
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      <SettingsCard
        title={messages.scheduleTitle}
        actions={
          cadence ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOff(true)}
            >
              {messages.turnOff}
            </Button>
          ) : null
        }
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <div className="space-y-6">
            <Switch
              label={messages.auto}
              description={messages.autoHint}
              checked={draft.autoCreate}
              onCheckedChange={(isChecked) =>
                setDraft({ ...draft, autoCreate: isChecked })
              }
            />
            <Segmented
              label={messages.length}
              value={draft.length}
              onChange={(length) => setDraft({ ...draft, length })}
              options={[
                ...PRESETS.map((preset) => ({
                  value: String(preset) as LengthChoice,
                  label: messages.lengths[preset],
                })),
                { value: 'custom' as const, label: messages.lengths.custom },
              ]}
            />
            {draft.length === 'custom' && (
              <Field label={messages.customDays} error={show(errors.length)}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="number"
                    min={1}
                    max={56}
                    inputMode="numeric"
                    className="max-w-32"
                    value={draft.customDays}
                    onChange={(event) =>
                      setDraft({ ...draft, customDays: event.target.value })
                    }
                  />
                )}
              </Field>
            )}
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label={messages.anchor}
                hint={messages.anchorHint}
                error={show(errors.anchor)}
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="date"
                    value={draft.anchorDate}
                    onChange={(event) =>
                      setDraft({ ...draft, anchorDate: event.target.value })
                    }
                  />
                )}
              </Field>
              <Field
                label={messages.pattern}
                hint={messages.patternHint}
                error={show(errors.pattern)}
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    maxLength={LIMITS.sprintName}
                    value={draft.namePattern}
                    onChange={(event) =>
                      setDraft({ ...draft, namePattern: event.target.value })
                    }
                  />
                )}
              </Field>
            </div>
          </div>

          <div
            aria-labelledby="sprint-preview-title"
            role="region"
            className="rounded-xl bg-muted/60 p-4"
          >
            <h3
              id="sprint-preview-title"
              className="mb-3 text-sm font-semibold"
            >
              {messages.preview}
            </h3>
            {preview.length === 0 ? (
              <p className="text-sm text-ink-soft">{messages.previewEmpty}</p>
            ) : (
              <ol className="space-y-3" aria-live="polite">
                {preview.map((sprint) => (
                  <li key={sprint.number} className="text-sm">
                    <p className="font-semibold">{sprint.name}</p>
                    <p className="text-ink-soft">
                      {formatDateRange(locale, sprint.startsOn, sprint.endsOn)}
                      {settings && (
                        <>
                          ,{' '}
                          {format.plural(
                            messages.workingDays,
                            sprintWorkingDays(sprint, settings.workingDays),
                          )}
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </SettingsCard>
      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        saveLabel={messages.saveSchedule}
        onDiscard={() => {
          setDraft(toDraft(cadence, 'Sprint {n}'))
          setSubmitted(false)
          if (!cadence) setEditing(false)
        }}
      />
      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title={messages.turnOffTitle}
        description={messages.turnOffText}
        confirmLabel={messages.turnOff}
        cancelLabel={app.actions.cancel}
        busy={save.isPending}
        onConfirm={() =>
          save.mutate(null, { onSuccess: () => setConfirmOff(false) })
        }
      />
    </form>
  )
}

// ---------------------------------------------------------------- lista sprintów

function SprintList() {
  const messages = useMessages(settingsMessages).sprints
  const app = useMessages(appMessages)
  const { locale } = useI18n()
  const format = useFormat()
  const taskTypes = useQuery(taskTypesQuery).data ?? []
  const typeName = (id: string) =>
    taskTypes.find((taskType) => taskType.id === id)?.name ?? '?'
  const settings = useQuery(settingsQuery).data
  const [showPast, setShowPast] = useState(false)
  const [editing, setEditing] = useState<Sprint | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Sprint | null>(null)
  const today = todayIn(settings?.timezone)

  const remove = useRemoveSprint(() => setDeleting(null))

  return (
    <SettingsCard
      title={messages.listTitle}
      lead={messages.listLead}
      actions={
        <Button onClick={() => setEditing('new')}>
          <CalendarPlus aria-hidden className="size-4" />
          {messages.add}
        </Button>
      }
    >
      <QueryView query={sprintsQuery}>
        {(sprints) => {
          const past = sprints.filter(
            (sprint) => sprintPhase(sprint, today) === 'past',
          )
          const visible = showPast
            ? sprints
            : sprints.filter((sprint) => sprintPhase(sprint, today) !== 'past')
          const hasNoSprints = sprints.length === 0
          if (hasNoSprints)
            return <p className="text-ink-soft">{messages.empty}</p>
          return (
            <div className="space-y-4">
              <ul className="divide-y divide-line">
                {visible.map((sprint) => {
                  const phase = sprintPhase(sprint, today)
                  return (
                    <li
                      key={sprint.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{sprint.name}</h3>
                          <Badge
                            tone={
                              phase === 'current'
                                ? 'success'
                                : phase === 'upcoming'
                                  ? 'info'
                                  : 'muted'
                            }
                          >
                            {messages.phase[phase]}
                          </Badge>
                        </div>
                        <p className="text-sm text-ink-soft">
                          {formatDateRange(
                            locale,
                            sprint.startsOn,
                            sprint.endsOn,
                          )}
                          {settings && (
                            <>
                              ,{' '}
                              {format.plural(
                                messages.workingDays,
                                sprintWorkingDays(sprint, settings.workingDays),
                              )}
                            </>
                          )}
                          {sprint.capacityStoryPoints !== null && (
                            <>
                              ,{' '}
                              {fmt(messages.capacityShort, {
                                sp: format.sp(sprint.capacityStoryPoints),
                              })}
                            </>
                          )}
                          {', '}
                          {sprint.fromCadence
                            ? messages.fromSchedule
                            : messages.manual}
                        </p>
                        {sprint.goal && (
                          <p className="mt-1 text-sm">{sprint.goal}</p>
                        )}
                        {sprint.timeGoals.length > 0 && (
                          <p className="mt-1 text-sm text-ink-soft">
                            {fmt(messages.timeGoals.summary, {
                              goals: sprint.timeGoals
                                .map(
                                  (timeGoal) =>
                                    `${typeName(timeGoal.taskTypeId)} ${format.minutes(timeGoal.minutes)}`,
                                )
                                .join(', '),
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(sprint)}
                        >
                          <Pencil aria-hidden className="size-4" />
                          {app.actions.edit}
                          <span className="sr-only">: {sprint.name}</span>
                        </Button>
                        {!sprint.fromCadence && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleting(sprint)}
                          >
                            <Trash2 aria-hidden className="size-4" />
                            {app.actions.delete}
                            <span className="sr-only">: {sprint.name}</span>
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              {past.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-expanded={showPast}
                  onClick={() => setShowPast(!showPast)}
                >
                  {showPast
                    ? messages.hidePast
                    : fmt(messages.showPast, { count: past.length })}
                </Button>
              )}
            </div>
          )
        }}
      </QueryView>

      {editing && (
        <SprintDialog
          sprint={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={fmt(messages.deleteTitle, { name: deleting?.name ?? '' })}
        description={messages.deleteText}
        confirmLabel={app.actions.delete}
        cancelLabel={app.actions.cancel}
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </SettingsCard>
  )
}

interface SprintDialogProps {
  sprint: Sprint | null
  onClose: () => void
}

function SprintDialog({ sprint, onClose }: SprintDialogProps) {
  const messages = useMessages(settingsMessages).sprints
  const app = useMessages(appMessages)
  const format = useFormat()
  const today = todayIn()
  const [goals, setGoals] = useState(() =>
    goalDrafts(sprint?.timeGoals ?? [], format.minutes),
  )
  const timeGoals = goalsFromDrafts(goals)
  const [draft, setDraft] = useState({
    name: sprint?.name ?? '',
    startsOn: sprint?.startsOn ?? today,
    endsOn: sprint?.endsOn ?? today,
    goal: sprint?.goal ?? '',
    capacity: sprint?.capacityStoryPoints?.toString() ?? '',
  })
  const [submitted, setSubmitted] = useState(false)

  const save = useSaveSprint({ sprint, onSaved: onClose })

  const capacity =
    draft.capacity.trim() === ''
      ? null
      : Number(draft.capacity.replace(',', '.'))
  const errors = {
    name:
      draft.name.trim() && draft.name.length <= LIMITS.sprintName
        ? null
        : messages.nameError,
    startsOn: isValidDate(draft.startsOn)
      ? (mutationFieldError(save.error, 'startsOn') ?? null)
      : messages.dateError,
    endsOn: !isValidDate(draft.endsOn)
      ? messages.dateError
      : draft.endsOn < draft.startsOn
        ? (mutationFieldError(save.error, 'endsOn') ?? messages.dateError)
        : mutationFieldError(save.error, 'endsOn'),
    capacity:
      capacity === null || (Number.isFinite(capacity) && capacity >= 0)
        ? null
        : messages.capacityError,
  }
  const invalid =
    !(draft.name.trim() && draft.name.length <= LIMITS.sprintName) ||
    !isValidDate(draft.startsOn) ||
    !isValidDate(draft.endsOn) ||
    draft.endsOn < draft.startsOn ||
    errors.capacity !== null ||
    timeGoals === null
  const show = (error: string | null) => (submitted ? error : null)

  const onSubmit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    setSubmitted(true)
    if (invalid) return
    save.mutate({
      name: draft.name.trim(),
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      goal: draft.goal.trim() || null,
      capacityStoryPoints: capacity,
      timeGoals,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={sprint ? messages.dialog.editTitle : messages.dialog.addTitle}
        description={messages.dialog.description}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="sprint-form"
              disabled={save.isPending}
              aria-busy={save.isPending}
            >
              {save.isPending
                ? app.actions.saving
                : sprint
                  ? app.actions.save
                  : messages.add}
            </Button>
          </>
        }
      >
        <form
          id="sprint-form"
          noValidate
          onSubmit={onSubmit}
          className="space-y-5"
        >
          <Field label={messages.fields.name} error={show(errors.name)}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                autoFocus
                maxLength={LIMITS.sprintName}
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={messages.fields.startsOn}
              error={show(errors.startsOn)}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="date"
                  value={draft.startsOn}
                  onChange={(event) =>
                    setDraft({ ...draft, startsOn: event.target.value })
                  }
                />
              )}
            </Field>
            <Field label={messages.fields.endsOn} error={show(errors.endsOn)}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="date"
                  min={draft.startsOn}
                  value={draft.endsOn}
                  onChange={(event) =>
                    setDraft({ ...draft, endsOn: event.target.value })
                  }
                />
              )}
            </Field>
          </div>
          <Field label={messages.fields.goal} hint={messages.fields.goalHint}>
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                maxLength={LIMITS.sprintGoal}
                rows={2}
                value={draft.goal}
                onChange={(event) =>
                  setDraft({ ...draft, goal: event.target.value })
                }
              />
            )}
          </Field>
          <Field
            label={messages.fields.capacity}
            hint={messages.fields.capacityHint}
            error={show(errors.capacity)}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                className="max-w-32"
                value={draft.capacity}
                onChange={(event) =>
                  setDraft({ ...draft, capacity: event.target.value })
                }
              />
            )}
          </Field>
          <TimeGoalsField
            rows={goals}
            onChange={setGoals}
            showErrors={submitted}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
