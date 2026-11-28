import { Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { NoteEditor } from '#/components/note/note-editor'
import {
  ENTRY_LIMITS,
  parseDuration,
} from '#/features/time-entries/domain/entries'
import { fmt } from '#/i18n/format'
import { cn } from '#/lib/utils'
import { FieldError, FieldLabel, fieldA11y } from './fields'
import type { EntryFormViewModel } from '../../controllers/use-entry-form'

export interface DetailFieldsProps {
  viewModel: EntryFormViewModel
  focusNotes?: boolean
}

/** Projekt, estymata zadania (nie dla spotkań) i notatki. */
export function DetailFields({ viewModel, focusNotes }: DetailFieldsProps) {
  const { messages, format, type, draft } = viewModel
  if (!type) return null
  const estimateMinutes = draft.estimate.trim()
    ? parseDuration(draft.estimate)
    : null
  const noteLength = draft.note.length
  const nearLimit = noteLength > ENTRY_LIMITS.note * 0.9
  return (
    <>
      {viewModel.projects.length > 0 && (
        <div>
          <FieldLabel htmlFor={viewModel.fieldId('project')}>
            {messages.form.project}
          </FieldLabel>
          <Select
            id={viewModel.fieldId('project')}
            className="mt-2"
            value={draft.projectId}
            onChange={(event) =>
              viewModel.update({ projectId: event.target.value })
            }
          >
            <option value="">{messages.form.noProject}</option>
            {viewModel.projects.map((archivable) => (
              <option key={archivable.id} value={archivable.id}>
                {archivable.key
                  ? `${archivable.name} (${archivable.key})`
                  : archivable.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Estymata całego zadania: raport porówna ją z prawdziwym czasem */}
      {type.kind !== 'meeting' && (
        <div>
          <FieldLabel
            htmlFor={viewModel.fieldId('estimate')}
            note={messages.form.optional}
          >
            {messages.form.estimate}
          </FieldLabel>
          <Input
            {...fieldA11y(
              viewModel,
              'estimate',
              !viewModel.issueText('estimate'),
            )}
            className="mt-2"
            inputMode="text"
            autoComplete="off"
            placeholder={messages.form.estimatePlaceholder}
            value={draft.estimate}
            onChange={(event) =>
              viewModel.update({ estimate: event.target.value })
            }
          />
          {viewModel.issueText('estimate') ? (
            <FieldError viewModel={viewModel} field="estimate" />
          ) : (
            <p
              id={`${viewModel.fieldId('estimate')}-hint`}
              className="mt-1.5 text-sm text-ink-soft"
            >
              {estimateMinutes ? `= ${format.minutes(estimateMinutes)}. ` : ''}
              {messages.form.estimateHint}
            </p>
          )}
        </div>
      )}

      {/* Notatki: co konkretnie zostało zrobione */}
      {type.descriptionRequirement !== 'hidden' && (
        <div className="sm:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel
              htmlFor={viewModel.fieldId('note')}
              note={
                type.descriptionRequirement === 'required'
                  ? messages.form.required
                  : messages.form.optional
              }
            >
              {messages.form.notes}
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
            {...fieldA11y(viewModel, 'note', true)}
            rows={5}
            autoFocus={focusNotes}
            maxLength={ENTRY_LIMITS.note}
            placeholder={messages.form.notesPlaceholder}
            className="mt-2"
            value={draft.note}
            onValueChange={(note) => viewModel.update({ note })}
          />
          <p
            id={`${viewModel.fieldId('note')}-hint`}
            className="mt-1.5 text-sm text-ink-soft"
          >
            {messages.form.notesHint}
            {nearLimit && (
              <span className="sr-only">
                {' '}
                {fmt(messages.form.notesCount, {
                  count: noteLength,
                  max: ENTRY_LIMITS.note,
                })}
              </span>
            )}
          </p>
          <FieldError viewModel={viewModel} field="note" />
        </div>
      )}
    </>
  )
}
