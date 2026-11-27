import { Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { NoteEditor } from '#/components/note/note-editor'
import { ENTRY_LIMITS, parseDuration } from '#/domain/entries'
import { fmt } from '#/i18n/format'
import { cn } from '#/lib/utils'
import { FieldError, FieldLabel, fieldA11y } from './fields'
import type { EntryFormViewModel } from './use-entry-form'

export interface DetailFieldsProps {
  vm: EntryFormViewModel
  focusNotes?: boolean
}

/** Projekt, estymata zadania (nie dla spotkań) i notatki. */
export function DetailFields({ vm, focusNotes }: DetailFieldsProps) {
  const { t, format, type, draft } = vm
  if (!type) return null
  const estimateMinutes = draft.estimate.trim()
    ? parseDuration(draft.estimate)
    : null
  const noteLength = draft.note.length
  const nearLimit = noteLength > ENTRY_LIMITS.note * 0.9
  return (
    <>
      {vm.projects.length > 0 && (
        <div>
          <FieldLabel htmlFor={vm.fieldId('project')}>
            {t.form.project}
          </FieldLabel>
          <Select
            id={vm.fieldId('project')}
            className="mt-2"
            value={draft.projectId}
            onChange={(e) => vm.update({ projectId: e.target.value })}
          >
            <option value="">{t.form.noProject}</option>
            {vm.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key ? `${p.name} (${p.key})` : p.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Estymata całego zadania: raport porówna ją z prawdziwym czasem */}
      {type.kind !== 'meeting' && (
        <div>
          <FieldLabel htmlFor={vm.fieldId('estimate')} note={t.form.optional}>
            {t.form.estimate}
          </FieldLabel>
          <Input
            {...fieldA11y(vm, 'estimate', !vm.issueText('estimate'))}
            className="mt-2"
            inputMode="text"
            autoComplete="off"
            placeholder={t.form.estimatePlaceholder}
            value={draft.estimate}
            onChange={(e) => vm.update({ estimate: e.target.value })}
          />
          {vm.issueText('estimate') ? (
            <FieldError vm={vm} field="estimate" />
          ) : (
            <p
              id={`${vm.fieldId('estimate')}-hint`}
              className="mt-1.5 text-sm text-ink-soft"
            >
              {estimateMinutes ? `= ${format.minutes(estimateMinutes)}. ` : ''}
              {t.form.estimateHint}
            </p>
          )}
        </div>
      )}

      {/* Notatki: co konkretnie zostało zrobione */}
      {type.descriptionRequirement !== 'hidden' && (
        <div className="sm:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel
              htmlFor={vm.fieldId('note')}
              note={
                type.descriptionRequirement === 'required'
                  ? t.form.required
                  : t.form.optional
              }
            >
              {t.form.notes}
            </FieldLabel>
            <span
              className={cn(
                'text-xs tabular-nums',
                nearLimit ? 'font-medium text-destructive' : 'text-ink-soft',
              )}
              aria-hidden
            >
              {noteLength}/{ENTRY_LIMITS.note}
            </span>
          </div>
          <NoteEditor
            {...fieldA11y(vm, 'note', true)}
            rows={5}
            autoFocus={focusNotes}
            maxLength={ENTRY_LIMITS.note}
            placeholder={t.form.notesPlaceholder}
            className="mt-2"
            value={draft.note}
            onValueChange={(note) => vm.update({ note })}
          />
          <p
            id={`${vm.fieldId('note')}-hint`}
            className="mt-1.5 text-sm text-ink-soft"
          >
            {t.form.notesHint}
            {nearLimit && (
              <span className="sr-only">
                {' '}
                {fmt(t.form.notesCount, {
                  count: noteLength,
                  max: ENTRY_LIMITS.note,
                })}
              </span>
            )}
          </p>
          <FieldError vm={vm} field="note" />
        </div>
      )}
    </>
  )
}
