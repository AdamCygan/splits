import { Wand2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { fmt } from '#/i18n/format'
import { FieldError } from './fields'
import type { EntryFormViewModel } from '../../controllers/use-entry-form'

const optionClass =
  'grid h-10 cursor-pointer place-items-center rounded-lg border border-line text-sm hover:border-ink/40 has-checked:border-transparent has-checked:bg-[var(--selected)] has-checked:text-[var(--on-selected)] has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40'

export interface StoryPointsFieldProps {
  vm: EntryFormViewModel
}

/** Story pointy ze skali; typ pracy decyduje, czy są wymagane, opcjonalne, czy ukryte. */
export function StoryPointsField({ vm }: StoryPointsFieldProps) {
  const { t, format, uid, type, chosenSp, suggestedSp } = vm
  const requirement = type?.storyPointsRequirement
  if (!requirement || requirement === 'hidden') return null
  const optional = requirement === 'optional'
  const fieldId = vm.fieldId('storyPoints')
  return (
    <fieldset
      className="sm:col-span-2"
      aria-describedby={
        vm.issueText('storyPoints') ? `${fieldId}-error` : undefined
      }
    >
      <legend className="mb-2 text-sm font-medium">
        {t.form.spLegend}{' '}
        <span className="font-normal text-ink-soft">
          {optional ? t.form.optional : t.form.required}
        </span>
      </legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {optional && (
          <label className={`${optionClass} px-3 font-medium`}>
            <input
              id={fieldId}
              type="radio"
              name={`${uid}-sp`}
              className="sr-only"
              checked={vm.draft.storyPoints === ''}
              onChange={() => vm.update({ storyPoints: '' })}
            />
            {t.form.spNone}
          </label>
        )}
        {vm.spOptions.map((s, i) => (
          <label
            key={s.points}
            className={`${optionClass} min-w-11 px-2.5 font-semibold tabular-nums`}
          >
            <input
              id={i === 0 && !optional ? fieldId : undefined}
              type="radio"
              name={`${uid}-sp`}
              className="sr-only"
              checked={chosenSp === s.points}
              onChange={() => vm.update({ storyPoints: String(s.points) })}
            />
            {format.number(s.points)}
            <span className="sr-only"> SP</span>
          </label>
        ))}
        {suggestedSp !== null && suggestedSp !== chosenSp && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => vm.update({ storyPoints: String(suggestedSp) })}
          >
            <Wand2 aria-hidden className="size-4" />
            {fmt(t.form.spSuggest, { sp: format.sp(suggestedSp) })}
          </Button>
        )}
      </div>
      <FieldError vm={vm} field="storyPoints" />
    </fieldset>
  )
}
