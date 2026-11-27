import { ChevronDown } from 'lucide-react'
import { useMessages } from '#/i18n/context'
import { marketingMessages } from '#/i18n/messages/marketing'

/** Pytania i odpowiedzi; te same dane trafiają do FAQPage (structured-data.ts). */
export function Faq() {
  const items = useMessages(marketingMessages).faq.items
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map(({ q, a }) => (
        <details key={q} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
            {q}
            <ChevronDown
              aria-hidden
              className="size-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="max-w-[68ch] pb-5 text-ink-soft">{a}</p>
        </details>
      ))}
    </div>
  )
}
