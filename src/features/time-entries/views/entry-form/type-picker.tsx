import { Clock, Play, Wand2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '#/components/ui/context-menu'
import { fmt } from '#/i18n/format'
import { QUICK_DURATIONS } from '../../domain/entry-form'
import type { EntryFormViewModel } from '../../controllers/use-entry-form'

export interface TypePickerProps {
  viewModel: EntryFormViewModel
}

/**
 * Rodzaj pracy: natywne radio (strzałki, Tab i czytniki ekranu działają same),
 * a prawy przycisk otwiera szybkie czasy dla danego rodzaju.
 */
export function TypePicker({ viewModel }: TypePickerProps) {
  const { messages, format, userId, type } = viewModel
  if (!type) return null
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        {messages.form.typeLegend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {viewModel.types.map((archivable) => (
          <ContextMenu key={archivable.id}>
            <ContextMenuTrigger asChild>
              <label className="relative flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors select-none hover:border-ink/40 hover:text-ink has-checked:border-transparent has-checked:bg-[var(--selected)] has-checked:text-[var(--on-selected)] has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40 data-[state=open]:ring-[3px] data-[state=open]:ring-ring/40">
                <input
                  type="radio"
                  name={`${userId}-type`}
                  className="sr-only"
                  aria-describedby={`${userId}-quick-hint`}
                  checked={archivable.id === type.id}
                  onChange={() => viewModel.changeType(archivable)}
                />
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ background: archivable.color }}
                />
                {archivable.name}
              </label>
            </ContextMenuTrigger>
            <ContextMenuContent
              onCloseAutoFocus={(event) => event.preventDefault()}
              aria-label={fmt(messages.form.quickMenu.label, {
                name: archivable.name,
              })}
            >
              <ContextMenuLabel>
                <span
                  aria-hidden
                  className="mr-1.5 inline-block size-2 rounded-full"
                  style={{ background: archivable.color }}
                />
                {archivable.name}
              </ContextMenuLabel>
              {QUICK_DURATIONS.map((quickDuration) => (
                <ContextMenuItem
                  key={quickDuration}
                  onSelect={() => viewModel.quickLog(archivable, quickDuration)}
                >
                  <Clock aria-hidden />
                  {fmt(messages.form.quickMenu.log, {
                    time: format.minutes(quickDuration),
                  })}
                </ContextMenuItem>
              ))}
              <ContextMenuItem
                onSelect={() => viewModel.openCustom(archivable)}
              >
                <Wand2 aria-hidden />
                {messages.form.quickMenu.custom}
              </ContextMenuItem>
              {!viewModel.editing && viewModel.timerAllowed && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => viewModel.quickLog(archivable, 'timer')}
                  >
                    <Play aria-hidden />
                    {messages.form.quickMenu.timer}
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
      <p id={`${userId}-quick-hint`} className="mt-2 text-sm text-ink-soft">
        {messages.form.quickHint}
      </p>
    </fieldset>
  )
}
