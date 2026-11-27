import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, Field, Switch, Textarea } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Segmented } from '#/components/ui/segmented'
import { sprintsApi } from '#/features/sprints/data/api'
import type {
  Sprint,
  SprintCadence,
  SprintInput,
} from '#/features/sprints/data/dto'
import { isValidDate, startOfWeek, todayIn } from '#/domain/dates'
import { LIMITS } from '#/domain/rules'
import {
  previewCadence,
  sprintPhase,
  sprintWorkingDays,
} from '#/domain/sprints'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDateRange } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import {
  cadenceQuery,
  keys,
  mutationFieldError,
  settingsQuery,
  sprintsQuery,
  taskTypesQuery,
  useDataMutation,
} from '../queries'
import { markSetupStep } from '../setup-progress'
import {
  TimeGoalsField,
  goalDrafts,
  goalsFromDrafts,
} from './sprint-time-goals'
import { QueryView, SaveBar, SectionHeader, SettingsCard } from './ui'

const PRESETS = [7, 14, 21, 28] as const
type LengthChoice = '7' | '14' | '21' | '28' | 'custom'

export function SprintSettings() {
  const t = useMessages(settingsMessages)
  return (
    <div className="space-y-6">
      <SectionHeader
        title={t.sections.sprints.title}
        lead={t.sprints.scheduleLead}
      />
      <QueryView query={cadenceQuery} skeletonRows={4}>
        {(cadence) => <ScheduleCard cadence={cadence} />}
      </QueryView>
      <SprintList />
    </div>
  )
}

// ---------------------------------------------------------------- harmonogram

interface ScheduleDraft {
  length: LengthChoice
  customDays: string
  anchorDate: string
  namePattern: string
  autoCreate: boolean
}

function toDraft(
  cadence: SprintCadence | null,
  defaultPattern: string,
): ScheduleDraft {
  const today = todayIn()
  const days = cadence?.lengthDays ?? 14
  return {
    length: (PRESETS as ReadonlyArray<number>).includes(days)
      ? (String(days) as LengthChoice)
      : 'custom',
    customDays: String(days),
    anchorDate: cadence?.anchorDate ?? startOfWeek(today, 1),
    namePattern: cadence?.namePattern ?? defaultPattern,
    autoCreate: cadence?.autoCreate ?? true,
  }
}

interface ScheduleCardProps {
  cadence: SprintCadence | null
}

function ScheduleCard({ cadence }: ScheduleCardProps) {
  const t = useMessages(settingsMessages).sprints
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

  const save = useDataMutation(sprintsApi.setCadence, {
    invalidate: [keys.cadence, keys.sprints],
    success: (result) => (result ? t.scheduleSaved : app.status.saved),
    onSuccess: () => markSetupStep('sprints'),
  })

  const lengthDays =
    draft.length === 'custom' ? Number(draft.customDays) : Number(draft.length)
  const errors = {
    length:
      Number.isInteger(lengthDays) &&
      lengthDays >= LIMITS.sprintLengthDays.min &&
      lengthDays <= LIMITS.sprintLengthDays.max
        ? null
        : t.customDaysError,
    anchor: isValidDate(draft.anchorDate) ? null : t.dateError,
    pattern:
      draft.namePattern.trim() && draft.namePattern.length <= LIMITS.sprintName
        ? null
        : t.patternError,
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
  const show = (e: string | null) => (submitted ? e : null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (valid) save.mutate(next)
  }

  if (!editing) {
    return (
      <SettingsCard title={t.scheduleTitle}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-ink-soft">{t.noSchedule}</p>
          <Button onClick={() => setEditing(true)}>{t.setUp}</Button>
        </div>
      </SettingsCard>
    )
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      <SettingsCard
        title={t.scheduleTitle}
        actions={
          cadence ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOff(true)}
            >
              {t.turnOff}
            </Button>
          ) : null
        }
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <div className="space-y-6">
            <Switch
              label={t.auto}
              description={t.autoHint}
              checked={draft.autoCreate}
              onCheckedChange={(v) => setDraft({ ...draft, autoCreate: v })}
            />
            <Segmented
              label={t.length}
              value={draft.length}
              onChange={(length) => setDraft({ ...draft, length })}
              options={[
                ...PRESETS.map((d) => ({
                  value: String(d) as LengthChoice,
                  label: t.lengths[d],
                })),
                { value: 'custom' as const, label: t.lengths.custom },
              ]}
            />
            {draft.length === 'custom' && (
              <Field label={t.customDays} error={show(errors.length)}>
                {(a) => (
                  <Input
                    {...a}
                    type="number"
                    min={1}
                    max={56}
                    inputMode="numeric"
                    className="max-w-32"
                    value={draft.customDays}
                    onChange={(e) =>
                      setDraft({ ...draft, customDays: e.target.value })
                    }
                  />
                )}
              </Field>
            )}
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label={t.anchor}
                hint={t.anchorHint}
                error={show(errors.anchor)}
              >
                {(a) => (
                  <Input
                    {...a}
                    type="date"
                    value={draft.anchorDate}
                    onChange={(e) =>
                      setDraft({ ...draft, anchorDate: e.target.value })
                    }
                  />
                )}
              </Field>
              <Field
                label={t.pattern}
                hint={t.patternHint}
                error={show(errors.pattern)}
              >
                {(a) => (
                  <Input
                    {...a}
                    maxLength={LIMITS.sprintName}
                    value={draft.namePattern}
                    onChange={(e) =>
                      setDraft({ ...draft, namePattern: e.target.value })
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
              {t.preview}
            </h3>
            {preview.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.previewEmpty}</p>
            ) : (
              <ol className="space-y-3" aria-live="polite">
                {preview.map((s) => (
                  <li key={s.number} className="text-sm">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-ink-soft">
                      {formatDateRange(locale, s.startsOn, s.endsOn)}
                      {settings && (
                        <>
                          ,{' '}
                          {format.plural(
                            t.workingDays,
                            sprintWorkingDays(s, settings.workingDays),
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
        saveLabel={t.saveSchedule}
        onDiscard={() => {
          setDraft(toDraft(cadence, 'Sprint {n}'))
          setSubmitted(false)
          if (!cadence) setEditing(false)
        }}
      />
      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title={t.turnOffTitle}
        description={t.turnOffText}
        confirmLabel={t.turnOff}
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
  const t = useMessages(settingsMessages).sprints
  const app = useMessages(appMessages)
  const { locale } = useI18n()
  const format = useFormat()
  const taskTypes = useQuery(taskTypesQuery).data ?? []
  const typeName = (id: string) =>
    taskTypes.find((x) => x.id === id)?.name ?? '?'
  const settings = useQuery(settingsQuery).data
  const [showPast, setShowPast] = useState(false)
  const [editing, setEditing] = useState<Sprint | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Sprint | null>(null)
  const today = todayIn(settings?.timezone)

  const remove = useDataMutation((id: string) => sprintsApi.remove(id), {
    invalidate: [keys.sprints],
    success: t.deleted,
    onSuccess: () => setDeleting(null),
  })

  return (
    <SettingsCard
      title={t.listTitle}
      lead={t.listLead}
      actions={
        <Button onClick={() => setEditing('new')}>
          <CalendarPlus aria-hidden className="size-4" />
          {t.add}
        </Button>
      }
    >
      <QueryView query={sprintsQuery}>
        {(sprints) => {
          const past = sprints.filter((s) => sprintPhase(s, today) === 'past')
          const visible = showPast
            ? sprints
            : sprints.filter((s) => sprintPhase(s, today) !== 'past')
          if (sprints.length === 0)
            return <p className="text-ink-soft">{t.empty}</p>
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
                            {t.phase[phase]}
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
                                t.workingDays,
                                sprintWorkingDays(sprint, settings.workingDays),
                              )}
                            </>
                          )}
                          {sprint.capacityStoryPoints !== null && (
                            <>
                              ,{' '}
                              {fmt(t.capacityShort, {
                                sp: format.sp(sprint.capacityStoryPoints),
                              })}
                            </>
                          )}
                          {', '}
                          {sprint.fromCadence ? t.fromSchedule : t.manual}
                        </p>
                        {sprint.goal && (
                          <p className="mt-1 text-sm">{sprint.goal}</p>
                        )}
                        {sprint.timeGoals.length > 0 && (
                          <p className="mt-1 text-sm text-ink-soft">
                            {fmt(t.timeGoals.summary, {
                              goals: sprint.timeGoals
                                .map(
                                  (g) =>
                                    `${typeName(g.taskTypeId)} ${format.minutes(g.minutes)}`,
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
                    ? t.hidePast
                    : fmt(t.showPast, { count: past.length })}
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
        title={fmt(t.deleteTitle, { name: deleting?.name ?? '' })}
        description={t.deleteText}
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
  const t = useMessages(settingsMessages).sprints
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

  const save = useDataMutation(
    (input: SprintInput) =>
      sprint ? sprintsApi.update(sprint.id, input) : sprintsApi.create(input),
    {
      invalidate: [keys.sprints],
      success: sprint ? app.status.saved : t.created,
      onSuccess: onClose,
    },
  )

  const capacity =
    draft.capacity.trim() === ''
      ? null
      : Number(draft.capacity.replace(',', '.'))
  const errors = {
    name:
      draft.name.trim() && draft.name.length <= LIMITS.sprintName
        ? null
        : t.nameError,
    startsOn: isValidDate(draft.startsOn)
      ? (mutationFieldError(save.error, 'startsOn') ?? null)
      : t.dateError,
    endsOn: !isValidDate(draft.endsOn)
      ? t.dateError
      : draft.endsOn < draft.startsOn
        ? (mutationFieldError(save.error, 'endsOn') ?? t.dateError)
        : mutationFieldError(save.error, 'endsOn'),
    capacity:
      capacity === null || (Number.isFinite(capacity) && capacity >= 0)
        ? null
        : t.capacityError,
  }
  const invalid =
    !(draft.name.trim() && draft.name.length <= LIMITS.sprintName) ||
    !isValidDate(draft.startsOn) ||
    !isValidDate(draft.endsOn) ||
    draft.endsOn < draft.startsOn ||
    errors.capacity !== null ||
    timeGoals === null
  const show = (e: string | null) => (submitted ? e : null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
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
        title={sprint ? t.dialog.editTitle : t.dialog.addTitle}
        description={t.dialog.description}
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
                  : t.add}
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
          <Field label={t.fields.name} error={show(errors.name)}>
            {(a) => (
              <Input
                {...a}
                autoFocus
                maxLength={LIMITS.sprintName}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.fields.startsOn} error={show(errors.startsOn)}>
              {(a) => (
                <Input
                  {...a}
                  type="date"
                  value={draft.startsOn}
                  onChange={(e) =>
                    setDraft({ ...draft, startsOn: e.target.value })
                  }
                />
              )}
            </Field>
            <Field label={t.fields.endsOn} error={show(errors.endsOn)}>
              {(a) => (
                <Input
                  {...a}
                  type="date"
                  min={draft.startsOn}
                  value={draft.endsOn}
                  onChange={(e) =>
                    setDraft({ ...draft, endsOn: e.target.value })
                  }
                />
              )}
            </Field>
          </div>
          <Field label={t.fields.goal} hint={t.fields.goalHint}>
            {(a) => (
              <Textarea
                {...a}
                maxLength={LIMITS.sprintGoal}
                rows={2}
                value={draft.goal}
                onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
              />
            )}
          </Field>
          <Field
            label={t.fields.capacity}
            hint={t.fields.capacityHint}
            error={show(errors.capacity)}
          >
            {(a) => (
              <Input
                {...a}
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                className="max-w-32"
                value={draft.capacity}
                onChange={(e) =>
                  setDraft({ ...draft, capacity: e.target.value })
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
