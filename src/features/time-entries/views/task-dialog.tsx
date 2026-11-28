import { selectable } from '#/shared/domain/archive'
import { notePlainText } from '#/shared/domain/markdown'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CalendarDays, Pencil, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, Field, Select } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import type { TaskRef, TimeEntry } from '#/features/time-entries/data/dto'
import type { TaskType } from '#/features/task-types/data/dto'
import {
  ENTRY_LIMITS,
  isUrl,
  parseDuration,
} from '#/features/time-entries/domain/entries'
import { maxEstimate, maxPoints } from '#/features/tasks/domain/summary'
import { mutationFieldError } from '#/shared/data/mutations'
import { projectsQuery } from '#/features/projects/data/queries'
import { scaleQuery } from '#/features/story-points/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { taskSessionsQuery } from '../data/queries'
import { EntryForm } from './entry-form'
import {
  useRemoveSession,
  useUpdateTask,
} from '../controllers/use-task-editing'

export interface TaskDialogProps {
  task: TaskRef
  onClose: () => void
}

/**
 * Zadanie z raportu: wspólne dane (tytuł, link, projekt, SP) zmieniane we wszystkich
 * sesjach naraz oraz lista sesji z edycją czasu, usuwaniem i przejściem do dnia.
 */
export function TaskDialog({ task, onClose }: TaskDialogProps) {
  const messages = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const format = useFormat()
  // Po zmianie tytułu albo linku zadanie ma nowy „adres”: śledzimy go dalej.
  const [ref, setRef] = useState<TaskRef>(task)
  const type = (useQuery(taskTypesQuery).data ?? []).find(
    (taskType) => taskType.id === ref.taskTypeId,
  )
  const sessions = useQuery(taskSessionsQuery(ref))
  const list = sessions.data ?? []
  const total = list.reduce((sum, entry) => sum + entry.durationMinutes, 0)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="lg"
        title={messages.task.title}
        description={
          list.length
            ? `${ref.title}. ${fmt(messages.task.total, {
                sessions: format.plural(messages.task.sessions, list.length),
                time: format.minutes(total),
              })}`
            : ref.title
        }
        closeLabel={app.actions.close}
      >
        {sessions.isPending ? (
          <div aria-hidden className="h-48 animate-pulse rounded-lg bg-muted" />
        ) : list.length === 0 ? (
          <p className="text-ink-soft">{messages.task.empty}</p>
        ) : (
          <div className="space-y-8">
            <TaskDetails
              key={`${ref.taskTypeId}|${ref.link ?? ''}|${ref.title}`}
              entries={list}
              type={type}
              onSaved={(saved) => {
                const latest = saved.at(-1)
                if (latest)
                  setRef({
                    title: latest.title,
                    link: latest.link,
                    taskTypeId: latest.taskTypeId,
                  })
              }}
            />
            <Sessions entries={list} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export interface TaskDetailsProps {
  entries: Array<TimeEntry>
  type: TaskType | undefined
  onSaved: (saved: Array<TimeEntry>) => void
}

export function TaskDetails({ entries, type, onSaved }: TaskDetailsProps) {
  const messages = useMessages(entriesMessages)
  const format = useFormat()
  const latest = entries.at(-1)!
  const projects = selectable(
    useQuery(projectsQuery).data ?? [],
    latest.projectId,
  )
  const scale = useQuery(scaleQuery).data ?? []
  const storyPoints = maxPoints(entries)
  const estimate = maxEstimate(entries)
  const actual = entries.reduce(
    (sum, timeEntry) => sum + timeEntry.durationMinutes,
    0,
  )
  const [draft, setDraft] = useState({
    title: latest.title,
    link: latest.link ?? '',
    projectId: latest.projectId ?? '',
    storyPoints: storyPoints === null ? '' : String(storyPoints),
    estimate: estimate === null ? '' : String(estimate),
  })
  const [submitted, setSubmitted] = useState(false)
  const ref: TaskRef = {
    title: latest.title,
    link: latest.link,
    taskTypeId: latest.taskTypeId,
  }

  const save = useUpdateTask({
    task: ref,
    onSaved: (saved) => {
      setSubmitted(false)
      onSaved(saved)
    },
  })

  const spMode = type?.storyPointsRequirement ?? 'optional'
  const linkMode = type?.linkRequirement ?? 'optional'
  const errors = {
    title: !draft.title.trim()
      ? messages.issues.title.required
      : draft.title.trim().length > 200
        ? messages.issues.title.too_long
        : null,
    link:
      linkMode === 'required' && !draft.link.trim()
        ? messages.issues.link.required
        : draft.link.trim() && !isUrl(draft.link)
          ? messages.issues.link.invalid_url
          : null,
    storyPoints:
      spMode === 'required' && draft.storyPoints === ''
        ? messages.issues.storyPoints.required
        : null,
    estimate:
      draft.estimate.trim() &&
      !(
        (parseDuration(draft.estimate) ?? 0) >= 1 &&
        (parseDuration(draft.estimate) ?? 0) <= ENTRY_LIMITS.maxEstimate
      )
        ? messages.issues.estimate.invalid
        : null,
  }
  const estimateMinutes = draft.estimate.trim()
    ? parseDuration(draft.estimate)
    : null
  const show = (field: keyof typeof errors) =>
    submitted ? (errors[field] ?? mutationFieldError(save.error, field)) : null
  const points = [
    ...new Set([
      ...scale.map((step) => step.points),
      ...(storyPoints === null ? [] : [storyPoints]),
    ]),
  ].sort((left, right) => left - right)

  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    setSubmitted(true)
    const hasErrors = Object.values(errors).some(Boolean)
    if (hasErrors) return
    save.mutate({
      title: draft.title.trim(),
      link: draft.link.trim() || null,
      projectId: draft.projectId || null,
      storyPoints:
        spMode === 'hidden' || draft.storyPoints === ''
          ? null
          : Number(draft.storyPoints),
      estimateMinutes,
    })
  }

  return (
    <section aria-labelledby="task-details">
      <h3 id="task-details" className="type-heading text-xl">
        {messages.task.details}
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        {format.plural(messages.task.applyAll, entries.length)}
      </p>
      <form noValidate onSubmit={submit} className="mt-4 space-y-5">
        <Field
          label={type?.titleLabel || messages.task.titleField}
          error={show('title')}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              maxLength={200}
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          )}
        </Field>
        {linkMode !== 'hidden' && (
          <Field
            label={type?.linkLabel || messages.form.link}
            error={show('link')}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="url"
                inputMode="url"
                placeholder="https://"
                spellCheck={false}
                value={draft.link}
                onChange={(event) =>
                  setDraft({ ...draft, link: event.target.value })
                }
              />
            )}
          </Field>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={messages.form.project}>
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={draft.projectId}
                onChange={(event) =>
                  setDraft({ ...draft, projectId: event.target.value })
                }
              >
                <option value="">{messages.form.noProject}</option>
                {projects.map((archivable) => (
                  <option key={archivable.id} value={archivable.id}>
                    {archivable.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {spMode !== 'hidden' && (
            <Field label={messages.task.sp} error={show('storyPoints')}>
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={draft.storyPoints}
                  onChange={(event) =>
                    setDraft({ ...draft, storyPoints: event.target.value })
                  }
                >
                  {spMode !== 'required' && (
                    <option value="">{messages.form.spNone}</option>
                  )}
                  {points.map((point) => (
                    <option key={point} value={point}>
                      {format.sp(point)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {type?.kind !== 'meeting' && (
            <Field
              label={messages.form.estimate}
              hint={
                estimateMinutes
                  ? fmt(messages.task.estimateVs, {
                      actual: format.minutes(actual),
                      estimate: format.minutes(estimateMinutes),
                    })
                  : messages.form.estimateHint
              }
              error={show('estimate')}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  inputMode="text"
                  autoComplete="off"
                  placeholder={messages.form.estimatePlaceholder}
                  value={draft.estimate}
                  onChange={(event) =>
                    setDraft({ ...draft, estimate: event.target.value })
                  }
                />
              )}
            </Field>
          )}
        </div>
        <Button
          type="submit"
          disabled={save.isPending}
          aria-busy={save.isPending}
        >
          {save.isPending ? messages.form.saving : messages.task.save}
        </Button>
      </form>
    </section>
  )
}

export interface SessionsProps {
  entries: Array<TimeEntry>
}

export function Sessions({ entries }: SessionsProps) {
  const messages = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const format = useFormat()
  const [editing, setEditing] = useState<TimeEntry | null>(null)
  const [deleting, setDeleting] = useState<TimeEntry | null>(null)
  const dayLabel = (entry: TimeEntry) =>
    format.day(entry.workDate, { year: true })

  const remove = useRemoveSession(() => setDeleting(null))

  return (
    <section aria-labelledby="task-sessions">
      <h3 id="task-sessions" className="type-heading text-xl">
        {messages.task.time}
      </h3>
      <p className="mt-1 text-sm text-ink-soft">{messages.task.timeHint}</p>
      <ol className="mt-4 divide-y divide-line rounded-xl border border-line">
        {[...entries].reverse().map((entry) => {
          const interval =
            entry.startTime && entry.endTime
              ? format.timeRange(entry.startTime, entry.endTime)
              : null
          const day = dayLabel(entry)
          return (
            <li
              key={entry.id}
              className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium">{day}</span>
                  {interval && (
                    <span className="text-sm text-ink-soft tabular-nums">
                      {interval}
                    </span>
                  )}
                  <span className="text-sm font-semibold tabular-nums">
                    {format.minutes(entry.durationMinutes)}
                  </span>
                  {entry.extensionMinutes !== null && (
                    <Badge tone="muted">
                      {fmt(messages.extension.badge, {
                        time: format.minutes(entry.extensionMinutes),
                      })}
                    </Badge>
                  )}
                  {entry.overtimeMinutes !== null && (
                    <Badge tone="muted">
                      {fmt(messages.form.overtime.badge, {
                        time: format.minutes(entry.overtimeMinutes),
                      })}
                    </Badge>
                  )}
                </p>
                {entry.note && (
                  <p className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-ink-soft">
                    {notePlainText(entry.note)}
                  </p>
                )}
              </div>
              <div className="-ml-3 flex flex-wrap gap-1 sm:ml-0">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={fmt(messages.task.editSession, { date: day })}
                  onClick={() => setEditing(entry)}
                >
                  <Pencil aria-hidden className="size-4" />
                  {messages.task.edit}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={fmt(messages.task.removeSession, { date: day })}
                  onClick={() => setDeleting(entry)}
                >
                  <Trash2 aria-hidden className="size-4" />
                  {messages.task.remove}
                </Button>
                <Link
                  to="/app"
                  search={{ date: entry.workDate }}
                  aria-label={fmt(messages.task.openDayOf, { date: day })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium hover:bg-muted"
                >
                  <CalendarDays aria-hidden className="size-4" />
                  {messages.task.openDay}
                </Link>
              </div>
            </li>
          )
        })}
      </ol>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent
            size="lg"
            title={fmt(messages.task.editSession, { date: dayLabel(editing) })}
            description={editing.title}
            closeLabel={app.actions.close}
            footer={
              <>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  {app.actions.cancel}
                </Button>
                <Button type="submit" form="task-session-form">
                  {app.actions.save}
                </Button>
              </>
            }
          >
            <EntryForm
              formId="task-session-form"
              hideSubmit
              workDate={editing.workDate}
              entry={editing}
              onSaved={() => setEditing(null)}
            />
          </DialogContent>
        </Dialog>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={fmt(messages.task.deleteTitle, {
          date: deleting ? dayLabel(deleting) : '',
        })}
        description={messages.task.deleteText}
        confirmLabel={messages.task.remove}
        cancelLabel={app.actions.cancel}
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </section>
  )
}
