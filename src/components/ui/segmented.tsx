import { useId } from 'react'
import { cn } from '#/lib/utils'

type Option<T extends string> = {
  value: T
  label: string
  description?: string
}

type SegmentedProps<T extends string> = {
  label: string
  /** Etykieta tylko dla czytników ekranu (np. gdy obok jest widoczny nagłówek). */
  hideLabel?: boolean
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<Option<T>>
  size?: 'sm' | 'md'
  className?: string
  name?: string
}

/**
 * Przełącznik segmentowy zbudowany na natywnych radio buttonach:
 * strzałki, Tab i czytniki ekranu działają bez dodatkowego JS.
 */
export function Segmented<T extends string>({
  label,
  hideLabel = false,
  value,
  onChange,
  options,
  size = 'md',
  className,
  name,
}: SegmentedProps<T>) {
  const id = useId()
  const groupName = name ?? id
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend
        className={cn('mb-2 text-sm font-medium', hideLabel && 'sr-only')}
      >
        {label}
      </legend>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-line bg-muted/60 p-1">
        {options.map((option) => {
          const optionId = `${id}-${option.value}`
          return (
            <div key={option.value} className="relative">
              <input
                type="radio"
                id={optionId}
                name={groupName}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={optionId}
                className={cn(
                  'block cursor-pointer rounded-lg font-medium text-ink-soft transition-colors select-none hover:text-ink',
                  'peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring',
                  size === 'sm'
                    ? 'px-3 py-1 text-sm'
                    : 'px-3.5 py-1.5 text-[0.9375rem]',
                )}
              >
                {option.label}
                {option.description && (
                  <span className="block text-xs font-normal text-ink-soft">
                    {option.description}
                  </span>
                )}
              </label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
