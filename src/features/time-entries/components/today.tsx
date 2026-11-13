import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ExternalLink,
  NotebookPen,
  Pause,
  ScrollText,
  Pencil,
  Play,
  Square,
  Trash2,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { data } from '#/data'
import type { TaskType, TimeEntry } from '#/data/types'
import { nowTimeIn, todayIn } from '#/domain/dates'
import { groupTasks, spForType, taskGroupKey, totalsOf } from '#/domain/report'
import { maxPoints } from '#/domain/summary'
import { extractTaskKey } from '#/domain/rules'
import {
  projectsQuery,
  settingsQuery,
  taskTypesQuery,
  templatesQuery,
  useDataMutation,
} from '#/features/settings/queries'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { entriesQuery, entryKeys } from '../queries'
import { EntryForm } from './entry-form'
import { SummaryDialog } from './summary-dialog'
import {
  clockTime,
  formatClock,
  useElapsed,
  usePauseTimer,
  useResumeTask,
  useStopTimer,
} from './timer'

export function TodayPage() {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  const { tag } = useI18n()
  const settings = useQuery(settingsQuery).data
  const workDate = todayIn(settings?.timezone)
  const entries = useQuery(entriesQuery(workDate))
  const list = entries.data ?? []
  const types = useQuery(taskTypesQuery).data ?? []

  const total = list.reduce((sum, e) => sum + e.durationMinutes, 0)
  // SP opisują zadanie: kilka sesji tego samego zadania liczy się raz.
  const points = totalsOf(groupTasks(list, types)).storyPoints
  const target = settings?.workdayTargetMinutes ?? 0
  const progress =
    target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0
  const dateLabel = new Intl.DateTimeFormat(tag, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${workDate}T00:00:00Z`))

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="text-sm font-medium text-ink-soft">{dateLabel}</p>
        <h1 className="type-display text-4xl sm:text-5xl">{t.pageTitle}</h1>
      </header>

      <dl className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        <div className="bg-surface px-4 py-3 sm:px-5">
          <dt className="text-sm text-ink-soft">{t.summary.logged}</dt>
          <dd className="type-heading mt-0.5 text-xl tabular-nums sm:text-2xl">
            {target > 0
              ? fmt(t.summary.ofTarget, {
                  time: format.minutes(total),
                  target: format.minutes(target),
                })
              : format.minutes(total)}
          </dd>
          {target > 0 && (
            <div
              aria-hidden
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-[var(--ink-fixed)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        <div className="bg-surface px-4 py-3 sm:px-5">
          <dt className="text-sm text-ink-soft">{t.summary.points}</dt>
          <dd className="type-heading mt-0.5 text-xl tabular-nums sm:text-2xl">
            {format.number(points)}
          </dd>
        </div>
        <div className="bg-surface px-4 py-3 sm:px-5">
          <dt className="text-sm text-ink-soft">{t.summary.entries}</dt>
          <dd className="type-heading mt-0.5 text-xl tabular-nums sm:text-2xl">
            {list.length}
          </dd>
        </div>
      </dl>

      <QuickTemplates workDate={workDate} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="log-time"
          className="rounded-2xl border border-line bg-surface"
        >
          <header className="border-b border-line px-5 py-4 sm:px-6">
            <h2 id="log-time" className="type-heading text-2xl">
              {t.form.title}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{t.form.lead}</p>
          </header>
          <div className="px-5 py-5 sm:px-6">
            <EntryForm workDate={workDate} />
          </div>
        </section>

        <section
          aria-labelledby="today-entries"
          className="rounded-2xl border border-line bg-surface"
        >
          <header className="border-b border-line px-5 py-4 sm:px-6">
            <h2 id="today-entries" className="type-heading text-2xl">
              {t.list.title}
            </h2>
          </header>
          {list.length === 0 ? (
            <p className="px-5 py-6 text-ink-soft sm:px-6">
              {entries.isPending ? '…' : t.list.empty}
            </p>
          ) : (
            <EntryList entries={list} workDate={workDate} />
          )}
        </section>
      </div>
    </div>
  )
}

function EntryList({
  entries,
  workDate,
}: {
  entries: Array<TimeEntry>
  workDate: string
}) {
  const t = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const format = useFormat()
  const { tag } = useI18n()
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = useQuery(projectsQuery).data ?? []
  const [editing, setEditing] = useState<{
    entry: TimeEntry
    notes: boolean
  } | null>(null)
  const [deleting, setDeleting] = useState<TimeEntry | null>(null)
  const [summarizing, setSummarizing] = useState<TimeEntry | null>(null)
  const remove = useDataMutation((id: string) => data.entries.remove(id), {
    invalidate: [entryKeys.all],
    success: t.list.deleted,
    onSuccess: () => setDeleting(null),
  })

  const clock = (time: string) => clockTime(tag, time)
  const stop = useStopTimer()
  const pause = usePauseTimer()
  const resume = useResumeTask()
  const busy = stop.isPending || pause.isPending || resume.isPending
  const groups = groupByTask(entries)

  return (
    <>
      <ul className="divide-y divide-line">
        {groups.map(({ key: groupKey, sessions }) => {
          const latest = sessions.at(-1)!
          const running = sessions.find((e) => e.running)
          const paused = !running && sessions.some((e) => e.paused)
          const type: TaskType | undefined = types.find(
            (x) => x.id === latest.taskTypeId,
          )
          const project = projects.find((p) => p.id === latest.projectId)
          const key = latest.link ? extractTaskKey(latest.link) : null
          const done = sessions.reduce((sum, e) => sum + e.durationMinutes, 0)
          const storyPoints = maxPoints(sessions)
          const canNote = type?.descriptionRequirement !== 'hidden'
          return (
            <li key={groupKey} className="px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ background: type?.color ?? 'var(--ink-faint)' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="min-w-0 font-semibold break-words">
                      {latest.title}
                    </h3>
                    <p className="flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums">
                      {running && (
                        <Badge tone="success">{t.timer.running}</Badge>
                      )}
                      {paused && <Badge tone="warning">{t.timer.paused}</Badge>}
                      <TaskTotal done={done} running={running} />
                    </p>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
                    <span>{type?.name}</span>
                    {storyPoints !== null && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{format.sp(storyPoints)}</span>
                      </>
                    )}
                    {project && (
                      <Badge tone="muted">{project.key ?? project.name}</Badge>
                    )}
                    {latest.link && (
                      <a
                        href={latest.link}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline"
                      >
                        <ExternalLink aria-hidden className="size-3.5" />
                        {key ?? 'Link'}
                        <span className="sr-only">
                          : {fmt(t.list.openLink, { name: latest.title })}
                        </span>
                      </a>
                    )}
                  </p>

                  {/* Odcinki czasu tego zadania, od najwcześniejszego: np. 6:40–7:20, potem 9:00–10:00 */}
                  <ol
                    aria-label={fmt(t.list.sessions, { name: latest.title })}
                    className="mt-3 space-y-2 border-l-2 border-line pl-3"
                  >
                    {sessions.map((entry) => {
                      const interval =
                        entry.startTime && (entry.endTime || entry.running)
                          ? `${clock(entry.startTime)}–${entry.endTime ? clock(entry.endTime) : '…'}`
                          : t.list.durationOnly
                      const label = fmt(t.list.sessionLabel, {
                        name: entry.title,
                        interval,
                      })
                      return (
                        <li key={entry.id}>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-sm font-medium tabular-nums">
                              {interval}
                            </span>
                            <span className="text-sm text-ink-soft tabular-nums">
                              {entry.running ? (
                                <RunningClock entry={entry} />
                              ) : (
                                format.minutes(entry.durationMinutes)
                              )}
                            </span>
                            {entry.overtimeMinutes !== null && (
                              <Badge tone="warning">
                                {fmt(t.form.overtime.badge, {
                                  time: format.minutes(entry.overtimeMinutes),
                                })}
                              </Badge>
                            )}
                            <span className="ml-auto flex items-center">
                              {!entry.note && canNote && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setEditing({ entry, notes: true })
                                  }
                                >
                                  <NotebookPen aria-hidden className="size-4" />
                                  {t.list.addNotes}
                                  <span className="sr-only">: {label}</span>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                title={app.actions.edit}
                                aria-label={`${app.actions.edit}: ${label}`}
                                onClick={() =>
                                  setEditing({ entry, notes: false })
                                }
                              >
                                <Pencil aria-hidden className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                title={app.actions.delete}
                                aria-label={`${app.actions.delete}: ${label}`}
                                onClick={() => setDeleting(entry)}
                              >
                                <Trash2 aria-hidden className="size-4" />
                              </Button>
                            </span>
                          </div>
                          {entry.note ? (
                            <div className="mt-1.5 rounded-lg bg-muted/60 px-3.5 py-2.5">
                              <p className="sr-only">{t.list.notesLabel}:</p>
                              <Notes
                                text={entry.note}
                                moreLabel={t.list.showNotes}
                              />
                            </div>
                          ) : null}
                          {entry.overtimeNote ? (
                            <div className="mt-1.5 rounded-lg border-l-4 border-wt-review bg-wt-review/10 px-3.5 py-2.5">
                              <p className="text-sm font-semibold">
                                {t.form.overtime.listLabel}
                              </p>
                              <Notes
                                text={entry.overtimeNote}
                                moreLabel={t.list.showNotes}
                              />
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ol>

                  <div className="mt-3 -ml-2.5 flex flex-wrap gap-1">
                    {running ? (
                      <>
                        <Button
                          size="sm"
                          className="ml-2.5"
                          disabled={busy}
                          onClick={() => pause.mutate(running.id)}
                        >
                          <Pause
                            aria-hidden
                            className="size-3.5"
                            fill="currentColor"
                          />
                          {t.timer.pause}
                          <span className="sr-only">: {latest.title}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => stop.mutate(running.id)}
                        >
                          <Square
                            aria-hidden
                            className="size-3.5"
                            fill="currentColor"
                          />
                          {t.timer.stop}
                          <span className="sr-only">: {latest.title}</span>
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant={paused ? 'default' : 'ghost'}
                        size="sm"
                        className={paused ? 'ml-2.5' : undefined}
                        disabled={busy}
                        onClick={() => resume.mutate(latest.id)}
                      >
                        <Play aria-hidden className="size-4" />
                        {paused ? t.timer.resume : t.timer.startAgain}
                        <span className="sr-only">: {latest.title}</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSummarizing(latest)}
                    >
                      <ScrollText aria-hidden className="size-4" />
                      {t.taskSummary.open}
                      <span className="sr-only">: {latest.title}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent
            size="lg"
            title={t.form.editTitle}
            description={editing.entry.title}
            closeLabel={app.actions.close}
            footer={
              <>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  {app.actions.cancel}
                </Button>
                <Button type="submit" form="edit-entry-form">
                  {app.actions.save}
                </Button>
              </>
            }
          >
            <EntryForm
              formId="edit-entry-form"
              hideSubmit
              workDate={workDate}
              entry={editing.entry}
              focusNotes={editing.notes}
              onSaved={() => setEditing(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {summarizing && (
        <SummaryDialog
          entry={summarizing}
          type={types.find((x) => x.id === summarizing.taskTypeId)}
          onClose={() => setSummarizing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={fmt(t.list.deleteTitle, { name: deleting?.title ?? '' })}
        description={t.list.deleteText}
        confirmLabel={app.actions.delete}
        cancelLabel={app.actions.cancel}
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}

/** Notatka z zachowanymi akapitami; długa zwija się do 4 linii z przyciskiem „pokaż całość”. */
function Notes({ text, moreLabel }: { text: string; moreLabel: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 220 || text.split('\n').length > 4
  return (
    <>
      <p
        className={
          long && !open
            ? 'line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap'
            : 'text-sm leading-relaxed whitespace-pre-wrap'
        }
      >
        {text}
      </p>
      {long && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 text-sm font-medium underline underline-offset-4"
        >
          {moreLabel}
        </button>
      )}
    </>
  )
}

/** Czas działającego odcinka (role="timer", bez ogłaszania co sekundę). */
function RunningClock({ entry }: { entry: TimeEntry }) {
  const seconds = useElapsed(entry)
  return <span role="timer">{formatClock(seconds)}</span>
}

/** Suma czasu zadania dziś: zakończone odcinki plus działający (odświeżany co sekundę). */
function TaskTotal({
  done,
  running,
}: {
  done: number
  running: TimeEntry | undefined
}) {
  const format = useFormat()
  const seconds = useElapsed(running)
  return <span>{format.minutes(done + Math.floor(seconds / 60))}</span>
}

/**
 * Wpisy dnia pogrupowane w zadania (ten sam link albo typ i tytuł). Odcinki w zadaniu idą
 * chronologicznie, a zadania od ostatnio ruszanego (działające na górze).
 */
function groupByTask(entries: ReadonlyArray<TimeEntry>) {
  const groups = new Map<string, Array<TimeEntry>>()
  for (const entry of entries) {
    const key = taskGroupKey(entry)
    const list = groups.get(key)
    if (list) list.push(entry)
    else groups.set(key, [entry])
  }
  const order = (e: TimeEntry) => `${e.startTime ?? '99:99'}|${e.createdAt}`
  return [...groups]
    .map(([key, sessions]) => ({
      key,
      sessions: [...sessions].sort((a, b) => order(a).localeCompare(order(b))),
      running: sessions.some((e) => e.running),
      latest: sessions.reduce(
        (max, e) => (e.createdAt > max ? e.createdAt : max),
        '',
      ),
    }))
    .sort(
      (a, b) =>
        Number(b.running) - Number(a.running) ||
        b.latest.localeCompare(a.latest),
    )
}

/**
 * Szybkie szablony nad formularzem: klik albo Alt+1…9 zapisuje wpis od razu.
 * Szablon bez czasu startuje timer.
 */
function QuickTemplates({ workDate }: { workDate: string }) {
  const t = useMessages(entriesMessages)
  const format = useFormat()
  const templates = useQuery(templatesQuery).data ?? []
  const types = useQuery(taskTypesQuery).data ?? []
  const timeZone = useQuery(settingsQuery).data?.timezone

  const apply = useDataMutation(
    async (template: (typeof templates)[number]) => {
      const type = types.find((x) => x.id === template.taskTypeId)
      const base = {
        taskTypeId: template.taskTypeId,
        projectId: template.projectId,
        title: template.title,
        link: null,
        storyPoints: spForType(type, template.storyPoints),
        workDate,
        note: null,
      }
      if (template.defaultDurationMinutes === null) {
        const result = await data.entries.start({
          ...base,
          startTime: nowTimeIn(timeZone),
        })
        return result.ok ? { ...result, value: result.value.started } : result
      }
      return data.entries.create({
        ...base,
        startTime: null,
        endTime: null,
        durationMinutes: template.defaultDurationMinutes,
        overtimeMinutes: null,
        overtimeNote: null,
        running: false,
      })
    },
    {
      invalidate: [entryKeys.all],
      success: (entry) =>
        entry.running
          ? `${t.form.timerStarted}: ${entry.title}`
          : fmt(t.templates.logged, {
              name: entry.title,
              time: format.minutes(entry.durationMinutes),
            }),
    },
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || !/^Digit[1-9]$/.test(e.code))
        return
      const template = templates.find(
        (x) => x.hotkey === Number(e.code.slice(5)),
      )
      if (!template) return
      e.preventDefault()
      apply.mutate(template)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [templates, apply])

  if (templates.length === 0) return null
  return (
    <section aria-labelledby="quick-templates" className="mb-6">
      <h2
        id="quick-templates"
        className="mb-2 text-sm font-medium text-ink-soft"
      >
        {t.templates.title}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {templates.map((template) => {
          const type = types.find((x) => x.id === template.taskTypeId)
          return (
            <li key={template.id}>
              <button
                type="button"
                disabled={apply.isPending}
                onClick={() => apply.mutate(template)}
                aria-keyshortcuts={
                  template.hotkey ? `Alt+${template.hotkey}` : undefined
                }
                className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface pr-2 pl-3.5 text-sm font-medium hover:border-ink/40 disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ background: type?.color }}
                />
                {template.label}
                <span className="text-ink-soft">
                  {template.defaultDurationMinutes
                    ? format.minutes(template.defaultDurationMinutes)
                    : t.form.timeModes.timer}
                </span>
                {template.hotkey && (
                  <kbd className="rounded-md border border-line border-b-2 px-1.5 py-0.5 font-sans text-xs text-ink-soft">
                    Alt+{template.hotkey}
                  </kbd>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
