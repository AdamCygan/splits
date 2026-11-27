import {
  Check,
  ClipboardCopy,
  ExternalLink,
  Play,
  RotateCcw,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, ColorDot } from '#/components/ui/controls'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { taskViewMessages } from '#/i18n/messages/task-view'
import type { TaskViewModel } from './use-task'

/** Rodzaj, projekt, SP i stan zadania, tytuł z linkiem oraz akcje. */
export function TaskHeader({ vm }: { vm: TaskViewModel }) {
  const t = useMessages(taskViewMessages)
  const tu = useMessages(entriesMessages).unfinished
  const format = useFormat()
  const { locale } = useI18n()
  const { latest, type, project, sp, finishedAt } = vm
  if (!latest) return null
  return (
    <header className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <ColorDot color={vm.color} />
          {type?.name}
          {project && (
            <>
              <span aria-hidden>·</span>
              <ColorDot color={project.color} />
              {project.name}
            </>
          )}
          {sp !== null && (
            <>
              <span aria-hidden>·</span>
              {format.sp(sp)}
            </>
          )}
          {finishedAt ? (
            <Badge tone="success">
              {fmt(tu.finishedOn, {
                date: formatDate(locale, new Date(finishedAt), {
                  day: 'numeric',
                  month: 'short',
                }),
              })}
            </Badge>
          ) : (
            <Badge tone="muted">{tu.statusOpen}</Badge>
          )}
        </p>
        <h1 className="type-display mt-1 text-3xl break-words sm:text-4xl">
          {latest.title}
        </h1>
        {latest.link && (
          <a
            href={latest.link}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex max-w-full items-center gap-1.5 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            <ExternalLink aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{latest.link}</span>
            <span className="sr-only">({t.openLink})</span>
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={vm.finishing}
          onClick={vm.toggleFinished}
        >
          {finishedAt ? <RotateCcw aria-hidden /> : <Check aria-hidden />}
          {finishedAt ? tu.reopen : tu.finish}
        </Button>
        <Button variant="outline" onClick={vm.openSummary}>
          <ClipboardCopy aria-hidden />
          {t.summary}
        </Button>
        <Button disabled={vm.resuming} onClick={vm.resume}>
          <Play aria-hidden fill="currentColor" className="size-3.5" />
          {t.continue}
        </Button>
      </div>
    </header>
  )
}
