import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Badge, Field, Select, Textarea } from '#/components/ui/controls'
import { Pagination } from '#/features/admin/views/pagination'
import { SectionHeader } from '#/features/settings/views/ui'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { feedbackMessages } from '#/i18n/messages/feedback'
import {
  useFeedbackInbox,
  useUpdateFeedback,
} from '../controllers/use-feedback-inbox'
import type { FeedbackInboxOptions } from '../controllers/use-feedback-inbox'
import type { AdminFeedback, AdminFeedbackFilter } from '../data/dto'
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  browserLabel,
} from '../domain/feedback'
import type { FeedbackStatus } from '../domain/feedback'
import { STATUS_TONES } from './help-settings'

export type FeedbackInboxProps = FeedbackInboxOptions

/** Panel admina → Zgłoszenia: problemy i pomysły z aplikacji, odpowiedź idzie mailem. */
export function FeedbackInbox(props: FeedbackInboxProps) {
  const t = useMessages(feedbackMessages)
  const vm = useFeedbackInbox(props)
  return (
    <>
      <SectionHeader title={t.admin.title} lead={t.admin.lead} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label={t.admin.filters.status} className="w-44">
          {(control) => (
            <Select
              {...control}
              value={vm.filter.status ?? ''}
              onChange={(e) =>
                vm.setStatus(
                  (e.target.value ||
                    undefined) as AdminFeedbackFilter['status'],
                )
              }
            >
              <option value="">{t.admin.filters.allStatuses}</option>
              <option value="open">{t.admin.filters.open}</option>
              {FEEDBACK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t.statuses[status]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.admin.filters.kind} className="w-48">
          {(control) => (
            <Select
              {...control}
              value={vm.filter.kind ?? ''}
              onChange={(e) =>
                vm.setKind(
                  (e.target.value || undefined) as AdminFeedbackFilter['kind'],
                )
              }
            >
              <option value="">{t.admin.filters.allKinds}</option>
              {FEEDBACK_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t.dialog.kinds[kind]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p role="status" className="pb-2 text-sm text-ink-soft">
          {fmt(t.admin.count, {
            new: vm.open.new,
            inProgress: vm.open.inProgress,
          })}
        </p>
      </div>
      {vm.pending ? (
        <div aria-hidden className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : vm.items.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-6 py-8 text-ink-soft">
          {t.admin.empty}
        </p>
      ) : (
        <ul className="space-y-4">
          {vm.items.map((report) => (
            <ReportCard
              key={`${report.id}-${report.updatedAt}`}
              report={report}
            />
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <Pagination page={vm.page} pages={vm.pages} onPage={vm.setPage} />
      </div>
    </>
  )
}

interface ReportCardProps {
  report: AdminFeedback
}

function ReportCard({ report }: ReportCardProps) {
  const t = useMessages(feedbackMessages)
  const format = useFormat()
  const save = useUpdateFeedback(report)
  const [status, setStatus] = useState<FeedbackStatus>(report.status)
  const [reply, setReply] = useState(report.reply ?? '')
  const [note, setNote] = useState(report.note ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate({
      status,
      reply: reply.trim() || null,
      note: note.trim() || null,
    })
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={STATUS_TONES[report.status]}>
          {t.statuses[report.status]}
        </Badge>
        <span className="font-medium">{t.dialog.kinds[report.kind]}</span>
        <span className="text-ink-soft">
          {format.day(report.createdAt.slice(0, 10), { year: true })}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words">{report.message}</p>
      <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-soft">{t.admin.from}</dt>
        <dd>
          <Link
            to="/app/admin/users/$id"
            params={{ id: report.user.id }}
            className="underline underline-offset-4"
          >
            {report.user.email}
          </Link>{' '}
          <span className="text-ink-soft">({report.user.plan})</span>
        </dd>
        {report.page && (
          <>
            <dt className="text-ink-soft">{t.admin.page}</dt>
            <dd className="break-all">{report.page}</dd>
          </>
        )}
        {report.userAgent && (
          <>
            <dt className="text-ink-soft">{t.admin.browser}</dt>
            <dd title={report.userAgent}>{browserLabel(report.userAgent)}</dd>
          </>
        )}
      </dl>
      <form
        onSubmit={submit}
        className="mt-5 grid gap-4 border-t border-line pt-5 lg:grid-cols-[12rem_1fr_1fr]"
      >
        <Field label={t.admin.status}>
          {(control) => (
            <Select
              {...control}
              value={status}
              onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
            >
              {FEEDBACK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.statuses[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.admin.reply} hint={t.admin.replyHint}>
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              maxLength={4000}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
          )}
        </Field>
        <Field label={t.admin.note} hint={t.admin.noteHint}>
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        <div className="lg:col-span-3">
          <Button
            type="submit"
            disabled={save.isPending}
            aria-busy={save.isPending}
          >
            {t.admin.save}
          </Button>
        </div>
      </form>
    </li>
  )
}
