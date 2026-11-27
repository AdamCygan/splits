import { selectable } from '#/domain/archive'
import { notePlainText } from '#/domain/markdown'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CalendarDays, Pencil, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, Field, Select } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { data } from '#/data'
import type {
  TaskRef,
  TaskType,
  TimeEntry,
  TaskUpdateInput,
} from '#/data/types'
import { ENTRY_LIMITS, isUrl, parseDuration } from '#/domain/entries'
import { maxEstimate, maxPoints } from '#/domain/summary'
import {
  mutationFieldError,
  projectsQuery,
  scaleQuery,
  taskTypesQuery,
  useDataMutation,
} from '#/features/settings/queries'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { unwrap } from '#/lib/api-client'
import { entryKeys } from '../queries'
import { EntryForm } from './entry-form'

export const taskQueryKey = (ref: TaskRef) =>
  [...entryKeys.all, 'task', ref.taskTypeId, ref.link ?? '', ref.title] as const

export interface TaskDialogProps {
  task: TaskRef
  onClose: () => void
}

/**
 * Zadanie z raportu: wspólne dane (tytuł, link, projekt, SP) zmieniane we wszystkich
 * sesjach naraz oraz lista sesji z edycją czasu, usuwaniem i przejściem do dnia.
 */
export function TaskDialog({ task, onClose }: TaskDialogProps) {
  const t = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const format = useFormat()
  // Po zmianie tytułu albo linku zadanie ma nowy „adres”: śledzimy go dalej.
  const [ref, setRef] = useState<TaskRef>(task)
  const type = (useQuery(taskTypesQuery).data ?? []).find(
    (x) => x.id === ref.taskTypeId,
  )
  const sessions = useQuery({
    queryKey: taskQueryKey(ref),
    queryFn: () => unwrap(data.entries.forTask(ref)),
  })
  const list = sessions.data ?? []
  const total = list.reduce((sum, e) => sum + e.durationMinutes, 0)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="lg"
        title={t.task.title}
        description={
          list.length
            ? `${ref.title}. ${fmt(t.task.total, {
                sessions: format.plural(t.task.sessions, list.length),
                time: format.minutes(total),
              })}`
            : ref.title
        }
        closeLabel={app.actions.close}
      >
        {sessions.isPending ? (
          <div aria-hidden className="h-48 animate-pulse rounded-lg bg-muted" />
        ) : list.length === 0 ? (
          <p className="text-ink-soft">{t.task.empty}</p>
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
  const t = useMessages(entriesMessages)
  const format = useFormat()
  const latest = entries.at(-1)!
  const projects = selectable(
    useQuery(projectsQuery).data ?? [],
    latest.projectId,
  )
  const scale = useQuery(scaleQuery).data ?? []
  const sp = maxPoints(entries)
  const estimate = maxEstimate(entries)
  const actual = entries.reduce((sum, e) => sum + e.durationMinutes, 0)
  const [draft, setDraft] = useState({
    title: latest.title,
    link: latest.link ?? '',
    projectId: latest.projectId ?? '',
    storyPoints: sp === null ? '' : String(sp),
    estimate: estimate === null ? '' : String(estimate),
  })
  const [submitted, setSubmitted] = useState(false)
  const ref: TaskRef = {
    title: latest.title,
    link: latest.link,
    taskTypeId: latest.taskTypeId,
  }

  const save = useDataMutation(
    (input: TaskUpdateInput) => data.entries.updateTask(ref, input),
    {
      invalidate: [entryKeys.all],
      success: t.task.saved,
      onSuccess: (saved) => {
        setSubmitted(false)
        onSaved(saved)
      },
    },
  )

  const spMode = type?.storyPointsRequirement ?? 'optional'
  const linkMode = type?.linkRequirement ?? 'optional'
  const errors = {
    title: !draft.title.trim()
      ? t.issues.title.required
      : draft.title.trim().length > 200
        ? t.issues.title.too_long
        : null,
    link:
      linkMode === 'required' && !draft.link.trim()
        ? t.issues.link.required
        : draft.link.trim() && !isUrl(draft.link)
          ? t.issues.link.invalid_url
          : null,
    storyPoints:
      spMode === 'required' && draft.storyPoints === ''
        ? t.issues.storyPoints.required
        : null,
    estimate:
      draft.estimate.trim() &&
      !(
        (parseDuration(draft.estimate) ?? 0) >= 1 &&
        (parseDuration(draft.estimate) ?? 0) <= ENTRY_LIMITS.maxEstimate
      )
        ? t.issues.estimate.invalid
        : null,
  }
  const estimateMinutes = draft.estimate.trim()
    ? parseDuration(draft.estimate)
    : null
  const show = (field: keyof typeof errors) =>
    submitted ? (errors[field] ?? mutationFieldError(save.error, field)) : null
  const points = [
    ...new Set([...scale.map((s) => s.points), ...(sp === null ? [] : [sp])]),
  ].sort((a, b) => a - b)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) return
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
        {t.task.details}
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        {format.plural(t.task.applyAll, entries.length)}
      </p>
      <form noValidate onSubmit={submit} className="mt-4 space-y-5">
        <Field
          label={type?.titleLabel || t.task.titleField}
          error={show('title')}
        >
          {(a) => (
            <Input
              {...a}
              maxLength={200}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          )}
        </Field>
        {linkMode !== 'hidden' && (
          <Field label={type?.linkLabel || t.form.link} error={show('link')}>
            {(a) => (
              <Input
                {...a}
                type="url"
                inputMode="url"
                placeholder="https://"
                spellCheck={false}
                value={draft.link}
                onChange={(e) => setDraft({ ...draft, link: e.target.value })}
              />
            )}
          </Field>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.form.project}>
            {(a) => (
              <Select
                {...a}
                value={draft.projectId}
                onChange={(e) =>
                  setDraft({ ...draft, projectId: e.target.value })
                }
              >
                <option value="">{t.form.noProject}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {spMode !== 'hidden' && (
            <Field label={t.task.sp} error={show('storyPoints')}>
              {(a) => (
                <Select
                  {...a}
                  value={draft.storyPoints}
                  onChange={(e) =>
                    setDraft({ ...draft, storyPoints: e.target.value })
                  }
                >
                  {spMode !== 'required' && (
                    <option value="">{t.form.spNone}</option>
                  )}
                  {points.map((p) => (
                    <option key={p} value={p}>
                      {format.sp(p)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {type?.kind !== 'meeting' && (
            <Field
              label={t.form.estimate}
              hint={
                estimateMinutes
                  ? fmt(t.task.estimateVs, {
                      actual: format.minutes(actual),
                      estimate: format.minutes(estimateMinutes),
                    })
                  : t.form.estimateHint
              }
              error={show('estimate')}
            >
              {(a) => (
                <Input
                  {...a}
                  inputMode="text"
                  autoComplete="off"
                  placeholder={t.form.estimatePlaceholder}
                  value={draft.estimate}
                  onChange={(e) =>
                    setDraft({ ...draft, estimate: e.target.value })
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
          {save.isPending ? t.form.saving : t.task.save}
        </Button>
      </form>
    </section>
  )
}

export interface SessionsProps {
  entries: Array<TimeEntry>
}

export function Sessions({ entries }: SessionsProps) {
  const t = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const format = useFormat()
  const [editing, setEditing] = useState<TimeEntry | null>(null)
  const [deleting, setDeleting] = useState<TimeEntry | null>(null)
  const dayLabel = (entry: TimeEntry) =>
    format.day(entry.workDate, { year: true })

  const remove = useDataMutation((id: string) => data.entries.remove(id), {
    invalidate: [entryKeys.all],
    success: t.task.deleted,
    onSuccess: () => setDeleting(null),
  })

  return (
    <section aria-labelledby="task-sessions">
      <h3 id="task-sessions" className="type-heading text-xl">
        {t.task.time}
      </h3>
      <p className="mt-1 text-sm text-ink-soft">{t.task.timeHint}</p>
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
                      {fmt(t.extension.badge, {
                        time: format.minutes(entry.extensionMinutes),
                      })}
                    </Badge>
                  )}
                  {entry.overtimeMinutes !== null && (
                    <Badge tone="muted">
                      {fmt(t.form.overtime.badge, {
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
                  aria-label={fmt(t.task.editSession, { date: day })}
                  onClick={() => setEditing(entry)}
                >
                  <Pencil aria-hidden className="size-4" />
                  {t.task.edit}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={fmt(t.task.removeSession, { date: day })}
                  onClick={() => setDeleting(entry)}
                >
                  <Trash2 aria-hidden className="size-4" />
                  {t.task.remove}
                </Button>
                <Link
                  to="/app"
                  search={{ date: entry.workDate }}
                  aria-label={fmt(t.task.openDayOf, { date: day })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium hover:bg-muted"
                >
                  <CalendarDays aria-hidden className="size-4" />
                  {t.task.openDay}
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
            title={fmt(t.task.editSession, { date: dayLabel(editing) })}
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
        title={fmt(t.task.deleteTitle, {
          date: deleting ? dayLabel(deleting) : '',
        })}
        description={t.task.deleteText}
        confirmLabel={t.task.remove}
        cancelLabel={app.actions.cancel}
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </section>
  )
}
