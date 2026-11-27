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
        {[0, 1, 2].map((i) => (
          <div
            key={i}
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
  const vm = useEntryFormViewModel(props)
  const { t } = vm
  if (!vm.type) return <p className="text-ink-soft">{t.form.noTypes}</p>
  return (
    <>
      <form
        id={props.formId}
        noValidate
        onSubmit={vm.submit}
        onKeyDown={vm.onKeyDown}
        className="space-y-6"
      >
        <TypePicker vm={vm} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TaskFields vm={vm} />
          <TimeSection vm={vm} />
          <StoryPointsField vm={vm} />
          <DetailFields vm={vm} focusNotes={props.focusNotes} />
          <OvertimeSection vm={vm} />
        </div>
        {!props.hideSubmit && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
            <span className="hidden text-sm text-ink-soft sm:inline">
              {t.form.saveHint}
            </span>
            <Button
              type="submit"
              size="lg"
              disabled={vm.pending}
              aria-busy={vm.pending}
            >
              {vm.startsTimer ? (
                <Timer aria-hidden className="size-4" />
              ) : (
                <Check aria-hidden className="size-4" />
              )}
              {vm.pending
                ? t.form.saving
                : vm.startsTimer
                  ? t.form.startTimer
                  : t.form.save}
            </Button>
          </div>
        )}
      </form>
      {/* Poza <form>: zdarzenia z portalu i tak płyną drzewem Reacta, więc nie zagnieżdżamy formularzy */}
      {vm.customFor && (
        <CustomDurationDialog
          type={vm.customFor}
          onClose={vm.closeCustom}
          onApply={(m) => {
            if (vm.customFor) vm.quickLog(vm.customFor, m)
            vm.closeCustom()
          }}
        />
      )}
    </>
  )
}
