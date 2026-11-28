import { useId } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

/** Błąd walidacji z TanStack Form (Zod zwraca obiekty z message) albo z serwera (string). */
export function errorMessages(errors: ReadonlyArray<unknown>): Array<string> {
  const messages = errors
    .map((error) =>
      typeof error === 'string'
        ? error
        : error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof error.message === 'string'
          ? error.message
          : null,
    )
    .filter((error): error is string => error !== null)
  return [...new Set(messages)]
}

type TextFieldProps = Omit<ComponentProps<typeof Input>, 'id'> & {
  label: string
  errors: Array<string>
  hint?: ReactNode
  labelAction?: ReactNode
}

/** Pole tekstowe z etykietą, podpowiedzią i błędami podpiętymi przez aria-describedby. */
export function TextField({
  label,
  errors,
  hint,
  labelAction,
  ...inputProps
}: TextFieldProps) {
  const id = useId()
  const describedBy = [
    errors.length ? `${id}-error` : null,
    hint ? `${id}-hint` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      <Input
        id={id}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint && errors.length === 0 && (
        <p id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {errors.length > 0 && (
        <ul id={`${id}-error`} className="space-y-0.5 text-sm text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export interface FormAlertProps {
  children: ReactNode
}

/** Komunikat dla całego formularza (np. zły login/hasło, brak połączenia). */
export function FormAlert({ children }: FormAlertProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
    >
      {children}
    </div>
  )
}
