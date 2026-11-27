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
  vm: EntryFormViewModel
}

/**
 * Rodzaj pracy: natywne radio (strzałki, Tab i czytniki ekranu działają same),
 * a prawy przycisk otwiera szybkie czasy dla danego rodzaju.
 */
export function TypePicker({ vm }: TypePickerProps) {
  const { t, format, uid, type } = vm
  if (!type) return null
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{t.form.typeLegend}</legend>
      <div className="flex flex-wrap gap-2">
        {vm.types.map((x) => (
          <ContextMenu key={x.id}>
            <ContextMenuTrigger asChild>
              <label className="relative flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors select-none hover:border-ink/40 hover:text-ink has-checked:border-transparent has-checked:bg-[var(--selected)] has-checked:text-[var(--on-selected)] has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40 data-[state=open]:ring-[3px] data-[state=open]:ring-ring/40">
                <input
                  type="radio"
                  name={`${uid}-type`}
                  className="sr-only"
                  aria-describedby={`${uid}-quick-hint`}
                  checked={x.id === type.id}
                  onChange={() => vm.changeType(x)}
                />
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ background: x.color }}
                />
                {x.name}
              </label>
            </ContextMenuTrigger>
            <ContextMenuContent
              onCloseAutoFocus={(e) => e.preventDefault()}
              aria-label={fmt(t.form.quickMenu.label, { name: x.name })}
            >
              <ContextMenuLabel>
                <span
                  aria-hidden
                  className="mr-1.5 inline-block size-2 rounded-full"
                  style={{ background: x.color }}
                />
                {x.name}
              </ContextMenuLabel>
              {QUICK_DURATIONS.map((m) => (
                <ContextMenuItem key={m} onSelect={() => vm.quickLog(x, m)}>
                  <Clock aria-hidden />
                  {fmt(t.form.quickMenu.log, { time: format.minutes(m) })}
                </ContextMenuItem>
              ))}
              <ContextMenuItem onSelect={() => vm.openCustom(x)}>
                <Wand2 aria-hidden />
                {t.form.quickMenu.custom}
              </ContextMenuItem>
              {!vm.editing && vm.timerAllowed && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={() => vm.quickLog(x, 'timer')}>
                    <Play aria-hidden />
                    {t.form.quickMenu.timer}
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
      <p id={`${uid}-quick-hint`} className="mt-2 text-sm text-ink-soft">
        {t.form.quickHint}
      </p>
    </fieldset>
  )
}
