import { Check, Timer } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { CustomDurationDialog } from './custom-duration-dialog'
import { DetailFields } from './detail-fields'
import { OvertimeSection } from './overtime-section'
import { StoryPointsField } from './story-points-field'
import { TaskFields } from './task-fields'
import { TimeSection } from './time-section'
import { TypePicker } from './type-picker'
import {
  useEntryFormReady,
  useEntryFormViewModel,
} from '../../controllers/use-entry-form'
import type { EntryFormProps } from '../../controllers/use-entry-form'

export type { EntryPrefill } from '../../domain/entry-form'
export type { EntryFormProps } from '../../controllers/use-entry-form'

/**
 * Formularz wpisu czasu (widok w MVVM). Pola dopasowują się do typu pracy (link,
 * notatki, sposób podawania czasu); stan, walidacja i zapis są w `useEntryFormViewModel`,
 * a przejścia szkicu w `model.ts`.
 */
export function EntryForm(props: EntryFormProps) {
  // Szkic startuje z domyślnymi wartościami typu, więc czekamy na typy, skalę i projekty.
  if (!useEntryFormReady()) {
    return (
      <div role="status" className="space-y-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            aria-hidden
            className="h-11 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    )
  }
  return <EntryFormView {...props} />
}

function EntryFormView(props: EntryFormProps) {
  const viewModel = useEntryFormViewModel(props)
  const { messages } = viewModel
  if (!viewModel.type)
    return <p className="text-ink-soft">{messages.form.noTypes}</p>
  return (
    <>
      <form
        id={props.formId}
        noValidate
        onSubmit={viewModel.submit}
        onKeyDown={viewModel.onKeyDown}
        className="space-y-6"
      >
        <TypePicker viewModel={viewModel} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TaskFields viewModel={viewModel} />
          <TimeSection viewModel={viewModel} />
          <StoryPointsField viewModel={viewModel} />
          <DetailFields viewModel={viewModel} focusNotes={props.focusNotes} />
          <OvertimeSection viewModel={viewModel} />
        </div>
        {!props.hideSubmit && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
            <span className="hidden text-sm text-ink-soft sm:inline">
              {messages.form.saveHint}
            </span>
            <Button
              type="submit"
              size="lg"
              disabled={viewModel.pending}
              aria-busy={viewModel.pending}
            >
              {viewModel.startsTimer ? (
                <Timer aria-hidden className="size-4" />
              ) : (
                <Check aria-hidden className="size-4" />
              )}
              {viewModel.pending
                ? messages.form.saving
                : viewModel.startsTimer
                  ? messages.form.startTimer
                  : messages.form.save}
            </Button>
          </div>
        )}
      </form>
      {/* Poza <form>: zdarzenia z portalu i tak płyną drzewem Reacta, więc nie zagnieżdżamy formularzy */}
      {viewModel.customFor && (
        <CustomDurationDialog
          type={viewModel.customFor}
          onClose={viewModel.closeCustom}
          onApply={(minutes) => {
            if (viewModel.customFor)
              viewModel.quickLog(viewModel.customFor, minutes)
            viewModel.closeCustom()
          }}
        />
      )}
    </>
  )
}
