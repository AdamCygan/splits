import { useId } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '#/lib/utils'

/** Wspólna oprawa pola: etykieta, podpowiedź i błędy podpięte przez aria-describedby. */
interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  /** Render-prop dostaje id i atrybuty ARIA do podpięcia pod kontrolkę. */
  children: (control: {
    id: string
    'aria-describedby'?: string
    'aria-invalid'?: true
  }) => ReactNode
  className?: string
  required?: boolean
  requiredLabel?: string
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  required,
  requiredLabel,
}: FieldProps) {
  const id = useId()
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && requiredLabel && (
          <span className="font-normal text-ink-soft"> {requiredLabel}</span>
        )}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

const controlBase =
  'w-full min-w-0 rounded-lg border border-input bg-surface text-base shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive disabled:opacity-50'

/** Natywny <select>: najlepsza obsługa klawiatury, czytników ekranu i telefonów. */
export function Select({
  className,
  children,
  ...props
}: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          controlBase,
          'h-11 cursor-pointer appearance-none pr-10 pl-3.5',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-soft"
      />
    </div>
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      className={cn(controlBase, 'min-h-24 px-3.5 py-2.5', className)}
    />
  )
}

interface SwitchProps {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

/** Przełącznik z etykietą i opisem — całe pole jest klikalne, Spacja przełącza. */
export function Switch({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: SwitchProps) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer font-medium">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 text-sm text-ink-soft">
            {description}
          </p>
        )}
      </div>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors data-[state=checked]:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SwitchPrimitive.Thumb className="pointer-events-none flex size-5 items-center justify-center rounded-full bg-surface shadow-sm transition-transform data-[state=checked]:translate-x-5">
          {checked && (
            <Check aria-hidden className="size-3 text-ink" strokeWidth={3} />
          )}
        </SwitchPrimitive.Thumb>
      </SwitchPrimitive.Root>
    </div>
  )
}

interface CheckboxGroupProps<T extends string | number> {
  legend: string
  hint?: string
  error?: string | null
  options: ReadonlyArray<{ value: T; label: string }>
  value: ReadonlyArray<T>
  onChange: (value: Array<T>) => void
}

/** Grupa checkboxów jako przyciski-pigułki (np. dni robocze). */
export function CheckboxGroup<T extends string | number>({
  legend,
  hint,
  error,
  options,
  value,
  onChange,
}: CheckboxGroupProps<T>) {
  const id = useId()
  return (
    <fieldset
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
    >
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = value.includes(option.value)
          const optionId = `${id}-${option.value}`
          return (
            <div key={String(option.value)}>
              <input
                type="checkbox"
                id={optionId}
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? value.filter((selected) => selected !== option.value)
                      : [...value, option.value],
                  )
                }
                className="peer sr-only"
              />
              <label
                htmlFor={optionId}
                className="flex h-10 min-w-12 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-soft select-none peer-checked:border-[var(--selected)] peer-checked:bg-[var(--selected)] peer-checked:text-[var(--on-selected)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
              >
                {checked && (
                  <Check aria-hidden className="size-3.5" strokeWidth={3} />
                )}
                {option.label}
              </label>
            </div>
          )
        })}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-2 text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}

interface Swatch {
  value: string
  label: string
}

export interface ColorPickerProps {
  legend: string
  value: string
  onChange: (value: string) => void
  swatches: ReadonlyArray<Swatch>
}

/** Wybór koloru jako grupa radio: każdy kolor ma nazwę dla czytnika ekranu. */
export function ColorPicker({
  legend,
  value,
  onChange,
  swatches,
}: ColorPickerProps) {
  const id = useId()
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {swatches.map((swatch) => {
          const optionId = `${id}-${swatch.value}`
          const checked = value.toLowerCase() === swatch.value.toLowerCase()
          return (
            <div key={swatch.value}>
              <input
                type="radio"
                id={optionId}
                name={id}
                checked={checked}
                onChange={() => onChange(swatch.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={optionId}
                title={swatch.label}
                className="grid size-9 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring"
                style={{ background: swatch.value }}
              >
                <span className="sr-only">{swatch.label}</span>
                {checked && (
                  <Check
                    aria-hidden
                    className="size-4 text-white drop-shadow"
                    strokeWidth={3}
                  />
                )}
              </label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

export interface BadgeProps {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'info' | 'warning' | 'muted'
  className?: string
}

/** Plakietka statusu — zawsze z tekstem, kolor jest tylko dodatkiem. */
export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  const tones = {
    neutral: 'bg-muted text-ink',
    success: 'bg-[color-mix(in_oklab,var(--wt-pair)_14%,white)] text-[#0b6b5b]',
    info: 'bg-[color-mix(in_oklab,var(--wt-task)_12%,white)] text-[#2a28b8]',
    warning:
      'bg-[color-mix(in_oklab,var(--wt-review)_20%,white)] text-[#7a4f0c]',
    muted: 'bg-transparent text-ink-soft ring-1 ring-line',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export interface ColorDotProps {
  color: string
  className?: string
}

/** Kolorowa kropka z tekstem obok (kolor nigdy nie jest jedyną informacją). */
export function ColorDot({ color, className }: ColorDotProps) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-3 shrink-0 rounded-full', className)}
      style={{ background: color }}
    />
  )
}
