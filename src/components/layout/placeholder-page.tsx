import { Link } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'

interface PlaceholderPageProps {
  title: string
  description: string
  children?: ReactNode
}

/** Ekran w budowie: mówi, co tu będzie, i kieruje do tego, co już działa (ustawienia). */
export function PlaceholderPage({
  title,
  description,
  children,
}: PlaceholderPageProps) {
  const messages = useMessages(appMessages).placeholders
  return (
    <section className="max-w-3xl space-y-6">
      <div>
        <Badge tone="info">{messages.soon}</Badge>
        <h1 className="type-display mt-3 text-4xl sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-prose text-ink-soft">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <p className="min-w-0 flex-1 text-ink-soft">{messages.setupText}</p>
        <Button asChild>
          <Link to="/app/settings">
            <Settings aria-hidden className="size-4" />
            {messages.setupCta}
          </Link>
        </Button>
      </div>
      {children}
    </section>
  )
}
