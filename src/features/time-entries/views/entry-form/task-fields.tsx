import { Link2 } from 'lucide-react'
import { Input } from '#/components/ui/input'
import { ENTRY_LIMITS } from '#/features/time-entries/domain/entries'
import { fmt } from '#/i18n/format'
import { FieldError, FieldLabel, fieldA11y } from './fields'
import type { EntryFormViewModel } from '../../controllers/use-entry-form'

export interface TaskFieldsProps {
  vm: EntryFormViewModel
}

/** Tytuł zadania i link (link wg ustawień typu: ukryty, opcjonalny albo wymagany). */
export function TaskFields({ vm }: TaskFieldsProps) {
  const { t, type, draft } = vm
  if (!type) return null
  const linkHint = Boolean(vm.taskKey) && !vm.issueText('link')
  return (
    <>
      <div className="sm:col-span-2">
        <FieldLabel htmlFor={vm.fieldId('title')} note={t.form.required}>
          {type.titleLabel}
        </FieldLabel>
        <Input
          ref={vm.titleRef}
          {...fieldA11y(vm, 'title')}
          className="mt-2"
          autoComplete="off"
          maxLength={ENTRY_LIMITS.title}
          value={draft.title}
          onChange={(e) => vm.update({ title: e.target.value })}
        />
        <FieldError vm={vm} field="title" />
      </div>

      {type.linkRequirement !== 'hidden' && (
        <div className="sm:col-span-2">
          <FieldLabel
            htmlFor={vm.fieldId('link')}
            note={
              type.linkRequirement === 'required'
                ? t.form.required
                : t.form.optional
            }
          >
            {type.linkLabel || t.form.link}
          </FieldLabel>
          <div className="relative mt-2">
            <Link2
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft"
            />
            <Input
              {...fieldA11y(vm, 'link', Boolean(vm.taskKey))}
              type="url"
              inputMode="url"
              className="pl-10"
              placeholder="https://"
              spellCheck={false}
              value={draft.link}
              onChange={(e) => vm.update({ link: e.target.value })}
            />
          </div>
          {linkHint && vm.taskKey && (
            <p
              id={`${vm.fieldId('link')}-hint`}
              className="mt-1.5 text-sm text-ink-soft"
            >
              {fmt(t.form.detected, { key: vm.taskKey })}
            </p>
          )}
          <FieldError vm={vm} field="link" />
        </div>
      )}
    </>
  )
}
