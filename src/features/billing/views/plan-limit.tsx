import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useMessages } from '#/i18n/context'
import { billingMessages } from '#/i18n/messages/billing'

export interface PlanLimitProps {
  /** Id do aria-describedby zablokowanego przycisku albo przełącznika. */
  id: string
  children: ReactNode
}

/** Informacja o limicie planu Free z odnośnikiem do strony planu. */
export function PlanLimit({ id, children }: PlanLimitProps) {
  const t = useMessages(billingMessages).limits
  return (
    <p id={id} className="mb-4 rounded-lg bg-muted px-3.5 py-2.5 text-sm">
      {children}{' '}
      <Link
        to="/app/settings/plan"
        className="font-medium underline underline-offset-4"
      >
        {t.upgrade}
      </Link>
    </p>
  )
}
