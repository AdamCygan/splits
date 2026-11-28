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
import type { TaskViewModel } from '../../controllers/use-task'
import { safeUrl } from '#/features/time-entries/domain/entries'

export interface TaskHeaderProps {
  viewModel: TaskViewModel
}

/** Rodzaj, projekt, SP i stan zadania, tytuł z linkiem oraz akcje. */
export function TaskHeader({ viewModel }: TaskHeaderProps) {
  const messages = useMessages(taskViewMessages)
  const tu = useMessages(entriesMessages).unfinished
  const format = useFormat()
  const { locale } = useI18n()
  const { latest, type, project, sp: storyPoints, finishedAt } = viewModel
  if (!latest) return null
  return (
    <header className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <ColorDot color={viewModel.color} />
          {type?.name}
          {project && (
            <>
              <span aria-hidden>·</span>
              <ColorDot color={project.color} />
              {project.name}
            </>
          )}
          {storyPoints !== null && (
            <>
              <span aria-hidden>·</span>
              {format.sp(storyPoints)}
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
            href={safeUrl(latest.link)}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex max-w-full items-center gap-1.5 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            <ExternalLink aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{latest.link}</span>
            <span className="sr-only">({messages.openLink})</span>
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={viewModel.finishing}
          onClick={viewModel.toggleFinished}
        >
          {finishedAt ? <RotateCcw aria-hidden /> : <Check aria-hidden />}
          {finishedAt ? tu.reopen : tu.finish}
        </Button>
        <Button variant="outline" onClick={viewModel.openSummary}>
          <ClipboardCopy aria-hidden />
          {messages.summary}
        </Button>
        <Button disabled={viewModel.resuming} onClick={viewModel.resume}>
          <Play aria-hidden fill="currentColor" className="size-3.5" />
          {messages.continue}
        </Button>
      </div>
    </header>
  )
}
