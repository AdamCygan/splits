import { Download, ExternalLink } from 'lucide-react'
import { Badge } from '#/components/ui/controls'
import { RecordCard, RecordList } from '#/components/ui/record-cards'
import { cn } from '#/lib/utils'
import type { Invoice } from '#/features/billing/data/dto'
import { SettingsCard } from '#/features/settings/views/ui'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { billingMessages } from '#/i18n/messages/billing'
import { useInvoicesViewModel } from '../../controllers/use-invoices'

export interface InvoicesCardProps {
  isDemo: boolean
}

/** Faktury ze Stripe: data, numer, kwota i status, z PDF-em i stroną faktury. */
export function InvoicesCard({ isDemo }: InvoicesCardProps) {
  const messages = useMessages(billingMessages).plan.invoices
  const viewModel = useInvoicesViewModel(isDemo)
  if (!viewModel.visible) return null
  return (
    <SettingsCard title={messages.title} lead={messages.lead}>
      {viewModel.pending ? (
        <div aria-hidden className="h-24 animate-pulse rounded-lg bg-muted" />
      ) : viewModel.invoices.length === 0 ? (
        <p className="text-ink-soft">{messages.empty}</p>
      ) : (
        <InvoicesTable invoices={viewModel.invoices} />
      )}
    </SettingsCard>
  )
}

export interface InvoicesTableProps {
  invoices: ReadonlyArray<Invoice>
  /** Podpis tabeli i obszaru przewijania; domyślnie „Twoje faktury…”. */
  caption?: string
}

/** Tabela faktur (strona planu klienta i strona konta w panelu admina). */
export function InvoicesTable({ invoices, caption }: InvoicesTableProps) {
  const messages = useMessages(billingMessages).plan.invoices
  const label = caption ?? messages.caption
  return (
    <>
      <RecordList label={label} className="-mx-5 border-y border-line">
        {invoices.map((invoice) => (
          <InvoiceCard key={invoice.id} invoice={invoice} />
        ))}
      </RecordList>
      <div
        className="relative -mx-1 hidden overflow-x-auto px-1 sm:block"
        role="region"
        tabIndex={0}
        aria-label={label}
      >
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">{label}</caption>
          <thead className="text-ink-soft">
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-3 font-medium">
                {messages.date}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {messages.number}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {messages.amount}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {messages.status}
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                {messages.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

interface InvoiceRowProps {
  invoice: Invoice
}

function InvoiceRow({ invoice }: InvoiceRowProps) {
  const messages = useMessages(billingMessages).plan.invoices
  const format = useFormat()
  const number = invoice.number ?? messages.noNumber
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-3 pr-3 whitespace-nowrap">
        {format.day(invoice.date.slice(0, 10), { year: true })}
      </td>
      <td className="px-3 py-3 font-mono text-xs">{number}</td>
      <td className="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums">
        {format.money(invoice.total, invoice.currency)}
      </td>
      <td className="px-3 py-3">
        <Badge tone={invoice.status === 'paid' ? 'success' : 'muted'}>
          {messages.statuses[invoice.status] ?? invoice.status}
        </Badge>
      </td>
      <td className="py-3 pl-3">
        <InvoiceLinks invoice={invoice} className="justify-end" />
      </td>
    </tr>
  )
}

/** Faktura na telefonie: kwota i status, data z numerem, linki do PDF-u i strony faktury. */
function InvoiceCard({ invoice }: InvoiceRowProps) {
  const messages = useMessages(billingMessages).plan.invoices
  const format = useFormat()
  const number = invoice.number ?? messages.noNumber
  const isPaid = invoice.status === 'paid'
  return (
    <RecordCard>
      <p className="flex items-center justify-between gap-3">
        <span className="font-semibold tabular-nums">
          {format.money(invoice.total, invoice.currency)}
        </span>
        <Badge tone={isPaid ? 'success' : 'muted'}>
          {messages.statuses[invoice.status] ?? invoice.status}
        </Badge>
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        {format.day(invoice.date.slice(0, 10), { year: true })}
        {', '}
        <span className="font-mono text-xs">{number}</span>
      </p>
      <InvoiceLinks invoice={invoice} className="mt-3 text-sm" />
    </RecordCard>
  )
}

interface InvoiceLinksProps {
  invoice: Invoice
  className?: string
}

function InvoiceLinks({ invoice, className }: InvoiceLinksProps) {
  const messages = useMessages(billingMessages).plan.invoices
  const number = invoice.number ?? messages.noNumber
  return (
    <span className={cn('flex flex-wrap gap-x-4 gap-y-2', className)}>
      {invoice.pdfUrl && (
        <a
          href={invoice.pdfUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          <Download aria-hidden className="size-3.5" />
          {messages.pdf}
          <span className="sr-only"> {fmt(messages.pdfOf, { number })}</span>
        </a>
      )}
      {invoice.url && (
        <a
          href={invoice.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          <ExternalLink aria-hidden className="size-3.5" />
          {messages.view}
          <span className="sr-only"> {fmt(messages.viewOf, { number })}</span>
        </a>
      )}
    </span>
  )
}
