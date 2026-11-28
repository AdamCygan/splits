import { Link2 } from 'lucide-react'
import { Input } from '#/components/ui/input'
import { ENTRY_LIMITS } from '#/features/time-entries/domain/entries'
import { fmt } from '#/i18n/format'
import { FieldError, FieldLabel, fieldA11y } from './fields'
import type { EntryFormViewModel } from '../../controllers/use-entry-form'

export interface TaskFieldsProps {
  viewModel: EntryFormViewModel
}

/** Tytuł zadania i link (link wg ustawień typu: ukryty, opcjonalny albo wymagany). */
export function TaskFields({ viewModel }: TaskFieldsProps) {
  const { messages, type, draft } = viewModel
  if (!type) return null
  const linkHint = Boolean(viewModel.taskKey) && !viewModel.issueText('link')
  return (
    <>
      <div className="sm:col-span-2">
        <FieldLabel
          htmlFor={viewModel.fieldId('title')}
          note={messages.form.required}
        >
          {type.titleLabel}
        </FieldLabel>
        <Input
          ref={viewModel.titleRef}
          {...fieldA11y(viewModel, 'title')}
          className="mt-2"
          autoComplete="off"
          maxLength={ENTRY_LIMITS.title}
          value={draft.title}
          onChange={(event) => viewModel.update({ title: event.target.value })}
        />
        <FieldError viewModel={viewModel} field="title" />
      </div>

      {type.linkRequirement !== 'hidden' && (
        <div className="sm:col-span-2">
          <FieldLabel
            htmlFor={viewModel.fieldId('link')}
            note={
              type.linkRequirement === 'required'
                ? messages.form.required
                : messages.form.optional
            }
          >
            {type.linkLabel || messages.form.link}
          </FieldLabel>
          <div className="relative mt-2">
            <Link2
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft"
            />
            <Input
              {...fieldA11y(viewModel, 'link', Boolean(viewModel.taskKey))}
              type="url"
              inputMode="url"
              className="pl-10"
              placeholder="https://"
              spellCheck={false}
              value={draft.link}
              onChange={(event) =>
                viewModel.update({ link: event.target.value })
              }
            />
          </div>
          {linkHint && viewModel.taskKey && (
            <p
              id={`${viewModel.fieldId('link')}-hint`}
              className="mt-1.5 text-sm text-ink-soft"
            >
              {fmt(messages.form.detected, { key: viewModel.taskKey })}
            </p>
          )}
          <FieldError viewModel={viewModel} field="link" />
        </div>
      )}
    </>
  )
}
