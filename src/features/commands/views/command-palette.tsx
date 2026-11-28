import { Dialog as DialogPrimitive } from 'radix-ui'
import { CornerDownLeft, Keyboard, Search } from 'lucide-react'
import { Kbd } from '#/components/ui/kbd'
import { cn } from '#/lib/utils'
import { ORDER } from '../controllers/commands'
import { ShortcutsHelp } from './shortcuts-help'
import { useCommandPaletteViewModel } from '../controllers/use-command-palette'
import type { CommandPaletteViewModel } from '../controllers/use-command-palette'

export { openCommandPalette, shortcutLabel } from '../domain/open'

/**
 * Paleta poleceń (Ctrl+K / ⌘K) — widok w MVVM. Wzorzec ARIA combobox + listbox:
 * fokus zostaje w polu, strzałki przesuwają aktywną opcję (aria-activedescendant),
 * Enter ją uruchamia. Stan i polecenia: `useCommandPaletteViewModel` i `model.ts`.
 */
export function CommandPalette() {
  const viewModel = useCommandPaletteViewModel()
  return (
    <DialogPrimitive.Root
      open={viewModel.open}
      onOpenChange={(isOpen) =>
        isOpen ? viewModel.openPalette() : viewModel.close()
      }
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(20,22,43,0.45)] data-[state=open]:animate-[fade-in_120ms_ease-out]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            viewModel.onOpened()
          }}
          onCloseAutoFocus={(event) => {
            if (viewModel.keepFocusAfterClose()) event.preventDefault()
          }}
          className="fixed top-[10dvh] left-1/2 z-50 flex max-h-[76dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_80px_-20px_rgba(20,22,43,0.45)] outline-none data-[state=open]:animate-[dialog-in_160ms_cubic-bezier(0.2,0.7,0.2,1)]"
        >
          <DialogPrimitive.Title className="sr-only">
            {viewModel.messages.menu.commands}
          </DialogPrimitive.Title>
          {viewModel.help ? (
            <ShortcutsHelp modifierKey={viewModel.modifierKey} onBack={viewModel.hideHelp} />
          ) : (
            <>
              <SearchField viewModel={viewModel} />
              <Results viewModel={viewModel} />
              <Footer viewModel={viewModel} />
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

interface SearchFieldProps {
  viewModel: CommandPaletteViewModel
}

function SearchField({ viewModel }: SearchFieldProps) {
  const commands = viewModel.messages.commands
  return (
    <div className="flex items-center gap-3 border-b border-line px-4">
      <Search aria-hidden className="size-4 shrink-0 text-ink-soft" />
      <input
        ref={viewModel.inputRef}
        role="combobox"
        aria-expanded
        aria-controls={viewModel.listId}
        aria-autocomplete="list"
        aria-activedescendant={
          viewModel.results.length
            ? viewModel.optionId(viewModel.active)
            : undefined
        }
        aria-label={commands.label}
        placeholder={commands.placeholder}
        autoComplete="off"
        spellCheck={false}
        value={viewModel.query}
        onChange={(event) => viewModel.setQuery(event.target.value)}
        onKeyDown={viewModel.onInputKeyDown}
        className="h-14 w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
      />
      <kbd className="hidden shrink-0 rounded border border-line px-1.5 text-[0.6875rem] text-ink-soft sm:block">
        Esc
      </kbd>
    </div>
  )
}

interface ResultsProps {
  viewModel: CommandPaletteViewModel
}

/** Wyniki w grupach (role="group"), każda opcja z id dla aria-activedescendant. */
function Results({ viewModel }: ResultsProps) {
  const commands = viewModel.messages.commands
  return (
    <ul
      ref={viewModel.listRef}
      id={viewModel.listId}
      role="listbox"
      aria-label={commands.results}
      aria-busy={viewModel.searchingNow}
      className="min-h-0 flex-1 overflow-y-auto p-1.5"
    >
      {ORDER.map((group) => {
        const items = viewModel.results
          .map((command, index) => ({ command, index }))
          .filter(({ command }) => command.group === group)
        if (items.length === 0) return null
        const groupId = `${viewModel.listId}-${group}`
        return (
          <li key={group} role="presentation">
            <ul role="group" aria-labelledby={groupId}>
              <li
                role="presentation"
                id={groupId}
                className="px-3 pt-2.5 pb-1 text-xs font-medium text-ink-faint"
              >
                {commands.groups[group]}
              </li>
              {items.map(({ command, index }) => (
                <li
                  key={command.id}
                  id={viewModel.optionId(index)}
                  role="option"
                  aria-selected={index === viewModel.active}
                  data-index={index}
                  onMouseMove={() => viewModel.setActive(index)}
                  onClick={(event) =>
                    viewModel.run(command, event.ctrlKey || event.metaKey)
                  }
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-sm',
                    index === viewModel.active && 'bg-muted',
                  )}
                >
                  {command.color ? (
                    <span
                      aria-hidden
                      className="mx-1 mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ background: command.color }}
                    />
                  ) : (
                    <command.icon
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-ink-soft"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {command.label}
                    </span>
                    {command.detail && (
                      <span className="mt-0.5 block truncate text-xs text-ink-soft">
                        {command.detail}
                      </span>
                    )}
                  </span>
                  {command.hint && (
                    <span className="mt-0.5 hidden max-w-[45%] shrink-0 truncate text-xs text-ink-soft sm:block">
                      {command.hint}
                    </span>
                  )}
                  {index === viewModel.active && (
                    <CornerDownLeft
                      aria-hidden
                      className="mt-0.5 size-3.5 shrink-0 text-ink-soft"
                    />
                  )}
                </li>
              ))}
            </ul>
          </li>
        )
      })}
      {viewModel.results.length === 0 && (
        <li
          role="presentation"
          className="px-3 py-6 text-center text-sm text-ink-soft"
        >
          {commands.empty}
        </li>
      )}
    </ul>
  )
}

interface FooterProps {
  viewModel: CommandPaletteViewModel
}

/** Podpowiedzi klawiszy i wejście do listy skrótów. */
function Footer({ viewModel }: FooterProps) {
  const commands = viewModel.messages.commands
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-ink-soft">
      <p aria-hidden className="flex flex-wrap gap-x-4 gap-y-1">
        {viewModel.searchingNow ? (
          <span>{commands.searching}</span>
        ) : (
          <>
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> {commands.hints.move}
            </span>
            <span>
              <Kbd>↵</Kbd> {commands.hints.open}
            </span>
            {viewModel.activeCommand?.alt && (
              <span>
                <Kbd>{viewModel.modifierKey}</Kbd> <Kbd>↵</Kbd>{' '}
                {commands.hints.continue}
              </span>
            )}
          </>
        )}
      </p>
      <button
        type="button"
        onClick={viewModel.showHelp}
        className="ml-auto inline-flex min-h-6 items-center gap-1.5 rounded hover:text-ink"
      >
        <Keyboard aria-hidden className="size-3.5" />
        {commands.shortcuts}
      </button>
    </div>
  )
}
