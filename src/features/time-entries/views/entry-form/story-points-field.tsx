import { Wand2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { fmt } from '#/i18n/format'
import { FieldError } from './fields'
import type { EntryFormViewModel } from '../../controllers/use-entry-form'

const optionClass =
  'grid h-10 cursor-pointer place-items-center rounded-lg border border-line text-sm hover:border-ink/40 has-checked:border-transparent has-checked:bg-[var(--selected)] has-checked:text-[var(--on-selected)] has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40'

export interface StoryPointsFieldProps {
  viewModel: EntryFormViewModel
}

/** Story pointy ze skali; typ pracy decyduje, czy są wymagane, opcjonalne, czy ukryte. */
export function StoryPointsField({ viewModel }: StoryPointsFieldProps) {
  const { messages, format, userId, type, chosenSp, suggestedSp } = viewModel
  const requirement = type?.storyPointsRequirement
  const isHidden = !requirement || requirement === 'hidden'
  if (isHidden) return null
  const optional = requirement === 'optional'
  const fieldId = viewModel.fieldId('storyPoints')
  return (
    <fieldset
      className="sm:col-span-2"
      aria-describedby={
        viewModel.issueText('storyPoints') ? `${fieldId}-error` : undefined
      }
    >
      <legend className="mb-2 text-sm font-medium">
        {messages.form.spLegend}{' '}
        <span className="font-normal text-ink-soft">
          {optional ? messages.form.optional : messages.form.required}
        </span>
      </legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {optional && (
          <label className={`${optionClass} px-3 font-medium`}>
            <input
              id={fieldId}
              type="radio"
              name={`${userId}-sp`}
              className="sr-only"
              checked={viewModel.draft.storyPoints === ''}
              onChange={() => viewModel.update({ storyPoints: '' })}
            />
            {messages.form.spNone}
          </label>
        )}
        {viewModel.spOptions.map((spScaleStep, index) => (
          <label
            key={spScaleStep.points}
            className={`${optionClass} min-w-11 px-2.5 font-semibold tabular-nums`}
          >
            <input
              id={index === 0 && !optional ? fieldId : undefined}
              type="radio"
              name={`${userId}-sp`}
              className="sr-only"
              checked={chosenSp === spScaleStep.points}
              onChange={() =>
                viewModel.update({ storyPoints: String(spScaleStep.points) })
              }
            />
            {format.number(spScaleStep.points)}
            <span className="sr-only"> SP</span>
          </label>
        ))}
        {suggestedSp !== null && suggestedSp !== chosenSp && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              viewModel.update({ storyPoints: String(suggestedSp) })
            }
          >
            <Wand2 aria-hidden className="size-4" />
            {fmt(messages.form.spSuggest, { sp: format.sp(suggestedSp) })}
          </Button>
        )}
      </div>
      <FieldError viewModel={viewModel} field="storyPoints" />
    </fieldset>
  )
}
