import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Copy, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '#/components/ui/button'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { entriesApi } from '../data/api'
import type { TaskType } from '#/features/task-types/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { renderSummary, taskStats } from '#/domain/summary'
import { settingsQuery } from '#/features/settings/queries'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'
import { unwrap } from '#/lib/api-client'
import { defaultSummaryTemplate, summaryValues } from '../summary'

export interface SummaryDialogProps {
  entry: TimeEntry
  type: TaskType | undefined
  onClose: () => void
}

/** Podsumowanie zadania z wszystkich jego wpisów, według szablonu użytkownika. */
export function SummaryDialog({ entry, type, onClose }: SummaryDialogProps) {
  const t = useMessages(entriesMessages).taskSummary
  const app = useMessages(appMessages)
  const { locale } = useI18n()
  const template =
    useQuery(settingsQuery).data?.summaryTemplate ??
    defaultSummaryTemplate(locale)
  const related = useQuery({
    queryKey: [
      'time-entries',
      'task',
      entry.taskTypeId,
      entry.link ?? '',
      entry.title,
    ],
    queryFn: () =>
      unwrap(
        entriesApi.forTask({
          title: entry.title,
          link: entry.link,
          taskTypeId: entry.taskTypeId,
        }),
      ),
  })
  const entries = related.data ?? []
  const text = entries.length
    ? renderSummary(
        template,
        summaryValues(locale, taskStats(entries), entry, type),
      )
    : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t.copied)
    } catch {
      toast.error(t.copyFailed)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="lg"
        title={fmt(t.title, { name: entry.title })}
        description={t.description}
        closeLabel={app.actions.close}
        footer={
          <>
            <Link
              to="/app/settings/summaries"
              className={buttonVariants({ variant: 'ghost' })}
            >
              <Settings2 aria-hidden className="size-4" />
              {t.editTemplate}
            </Link>
            <Button onClick={() => void copy()} disabled={!text}>
              <Copy aria-hidden className="size-4" />
              {t.copy}
            </Button>
          </>
        }
      >
        {related.isPending ? (
          <div aria-hidden className="h-40 animate-pulse rounded-lg bg-muted" />
        ) : (
          <>
            <label htmlFor="summary-text" className="sr-only">
              {t.textLabel}
            </label>
            <textarea
              id="summary-text"
              readOnly
              rows={Math.min(
                16,
                Math.max(
                  8,
                  text.split('\n').length + Math.ceil(text.length / 90),
                ),
              )}
              value={text}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full resize-y rounded-lg border border-line bg-muted/40 px-4 py-3 font-mono text-sm leading-relaxed text-ink"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
