import { Bug, HelpCircle, Lightbulb, MessageSquarePlus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import { site } from '#/config/site'
import { SectionHeader, SettingsCard } from '#/features/settings/views/ui'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { feedbackMessages } from '#/i18n/messages/feedback'
import { openFeedback } from '../controllers/open-feedback'
import { useMyFeedback } from '../controllers/use-feedback'
import type { Feedback } from '../data/dto'
import type { FeedbackStatus } from '../domain/feedback'

const KIND_ICONS = { bug: Bug, idea: Lightbulb, question: HelpCircle } as const

export const STATUS_TONES = {
  new: 'info',
  in_progress: 'warning',
  done: 'success',
  dismissed: 'muted',
} as const satisfies Record<FeedbackStatus, string>

/** Ustawienia → Pomoc: zgłoszenie problemu albo pomysłu i odpowiedzi na wcześniejsze. */
export function HelpSettings() {
  const messages = useMessages(feedbackMessages)
  const reports = useMyFeedback()
  return (
    <div>
      <SectionHeader title={messages.help.title} lead={messages.help.lead} />
      <div className="space-y-6">
        <SettingsCard
          title={messages.help.reportsTitle}
          actions={
            <Button onClick={() => openFeedback('bug')}>
              <MessageSquarePlus aria-hidden className="size-4" />
              {messages.open}
            </Button>
          }
        >
          {reports.isPending ? (
            <p className="text-ink-soft">…</p>
          ) : (reports.data ?? []).length === 0 ? (
            <p className="text-ink-soft">{messages.help.empty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {reports.data!.map((report) => (
                <ReportItem key={report.id} report={report} />
              ))}
            </ul>
          )}
        </SettingsCard>
        <SettingsCard title={messages.help.contactTitle}>
          <p className="text-ink-soft">
            {fmt(messages.help.contactLead, { email: site.supportEmail })}
          </p>
        </SettingsCard>
      </div>
    </div>
  )
}

interface ReportItemProps {
  report: Feedback
}

function ReportItem({ report }: ReportItemProps) {
  const messages = useMessages(feedbackMessages)
  const format = useFormat()
  const Icon = KIND_ICONS[report.kind]
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Icon aria-hidden className="size-4 text-ink-soft" />
        <span className="font-medium">
          {messages.dialog.kinds[report.kind]}
        </span>
        <Badge tone={STATUS_TONES[report.status]}>
          {messages.statuses[report.status]}
        </Badge>
        <span className="text-ink-soft">
          {fmt(messages.help.sentOn, {
            date: format.day(report.createdAt.slice(0, 10), { year: true }),
          })}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words">{report.message}</p>
      {report.reply && (
        <div className="mt-3 rounded-lg border-l-4 border-[var(--accent)] bg-muted px-4 py-3">
          <p className="text-sm font-medium">{messages.help.reply}</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{report.reply}</p>
        </div>
      )}
    </li>
  )
}
