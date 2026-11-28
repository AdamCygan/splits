import type { ReactNode } from 'react'
import type { EntryField } from '#/features/time-entries/domain/entries'
import type { EntryFormViewModel } from '../../controllers/use-entry-form'

export interface FieldLabelProps {
  htmlFor: string
  note?: string
  className?: string
  children: ReactNode
}

/** Etykieta pola z dopiskiem „wymagane / opcjonalne”. */
export function FieldLabel({
  htmlFor,
  note,
  className = 'block text-sm font-medium',
  children,
}: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className={className}>
      {children}
      {note && (
        <>
          {' '}
          <span className="font-normal text-ink-soft">{note}</span>
        </>
      )}
    </label>
  )
}

export interface FieldErrorProps {
  viewModel: EntryFormViewModel
  field: EntryField
}

/** Błąd pola (po próbie zapisu), powiązany z polem przez aria-describedby. */
export function FieldError({ viewModel, field }: FieldErrorProps) {
  const text = viewModel.issueText(field)
  if (!text) return null
  return (
    <p
      id={`${viewModel.fieldId(field)}-error`}
      className="mt-1.5 text-sm text-destructive"
    >
      {text}
    </p>
  )
}

/** Wspólne atrybuty dostępności pola: id, aria-invalid i aria-describedby. */
export function fieldA11y(
  viewModel: EntryFormViewModel,
  field: EntryField,
  hint?: boolean,
) {
  return {
    id: viewModel.fieldId(field),
    'aria-invalid': viewModel.issueText(field) ? true : undefined,
    'aria-describedby': viewModel.describedBy(field, hint),
  }
}

/** Przycisk-pigułka szybkiego wyboru (czas trwania, „cały czas” nadgodzin). */
export const chipClass =
  'h-9 rounded-full border border-line px-3 text-sm font-medium text-ink-soft hover:border-ink/40 hover:text-ink aria-pressed:border-transparent aria-pressed:bg-muted aria-pressed:text-ink'
