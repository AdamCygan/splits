import { Dialog as DialogPrimitive } from 'radix-ui'
import { CornerDownLeft, Keyboard, Search } from 'lucide-react'
import { Kbd } from '#/components/ui/kbd'
import { cn } from '#/lib/utils'
import { ORDER } from './model'
import { ShortcutsHelp } from './shortcuts-help'
import { useCommandPaletteViewModel } from './use-command-palette'
import type { CommandPaletteViewModel } from './use-command-palette'

export { openCommandPalette, shortcutLabel } from './open'

/**
 * Paleta poleceń (Ctrl+K / ⌘K) — widok w MVVM. Wzorzec ARIA combobox + listbox:
 * fokus zostaje w polu, strzałki przesuwają aktywną opcję (aria-activedescendant),
 * Enter ją uruchamia. Stan i polecenia: `useCommandPaletteViewModel` i `model.ts`.
 */
export function CommandPalette() {
  const vm = useCommandPaletteViewModel()
  return (
    <DialogPrimitive.Root
      open={vm.open}
      onOpenChange={(v) => (v ? vm.openPalette() : vm.close())}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(20,22,43,0.45)] data-[state=open]:animate-[fade-in_120ms_ease-out]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            vm.onOpened()
          }}
          onCloseAutoFocus={(e) => {
            if (vm.keepFocusAfterClose()) e.preventDefault()
          }}
          className="fixed top-[10dvh] left-1/2 z-50 flex max-h-[76dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_80px_-20px_rgba(20,22,43,0.45)] outline-none data-[state=open]:animate-[dialog-in_160ms_cubic-bezier(0.2,0.7,0.2,1)]"
        >
          <DialogPrimitive.Title className="sr-only">
            {vm.t.menu.commands}
          </DialogPrimitive.Title>
          {vm.help ? (
            <ShortcutsHelp mod={vm.mod} onBack={vm.hideHelp} />
          ) : (
            <>
              <SearchField vm={vm} />
              <Results vm={vm} />
              <Footer vm={vm} />
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function SearchField({ vm }: { vm: CommandPaletteViewModel }) {
  const c = vm.t.commands
  return (
    <div className="flex items-center gap-3 border-b border-line px-4">
      <Search aria-hidden className="size-4 shrink-0 text-ink-soft" />
      <input
        ref={vm.inputRef}
        role="combobox"
        aria-expanded
        aria-controls={vm.listId}
        aria-autocomplete="list"
        aria-activedescendant={
          vm.results.length ? vm.optionId(vm.active) : undefined
        }
        aria-label={c.label}
        placeholder={c.placeholder}
        autoComplete="off"
        spellCheck={false}
        value={vm.query}
        onChange={(e) => vm.setQuery(e.target.value)}
        onKeyDown={vm.onInputKeyDown}
        className="h-14 w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
      />
      <kbd className="hidden shrink-0 rounded border border-line px-1.5 text-[0.6875rem] text-ink-soft sm:block">
        Esc
      </kbd>
    </div>
  )
}

/** Wyniki w grupach (role="group"), każda opcja z id dla aria-activedescendant. */
function Results({ vm }: { vm: CommandPaletteViewModel }) {
  const c = vm.t.commands
  return (
    <ul
      ref={vm.listRef}
      id={vm.listId}
      role="listbox"
      aria-label={c.results}
      aria-busy={vm.searchingNow}
      className="min-h-0 flex-1 overflow-y-auto p-1.5"
    >
      {ORDER.map((group) => {
        const items = vm.results
          .map((cmd, i) => ({ cmd, i }))
          .filter(({ cmd }) => cmd.group === group)
        if (items.length === 0) return null
        const groupId = `${vm.listId}-${group}`
        return (
          <li key={group} role="presentation">
            <ul role="group" aria-labelledby={groupId}>
              <li
                role="presentation"
                id={groupId}
                className="px-3 pt-2.5 pb-1 text-xs font-medium text-ink-faint"
              >
                {c.groups[group]}
              </li>
              {items.map(({ cmd, i }) => (
                <li
                  key={cmd.id}
                  id={vm.optionId(i)}
                  role="option"
                  aria-selected={i === vm.active}
                  data-index={i}
                  onMouseMove={() => vm.setActive(i)}
                  onClick={(e) => vm.run(cmd, e.ctrlKey || e.metaKey)}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-sm',
                    i === vm.active && 'bg-muted',
                  )}
                >
                  {cmd.color ? (
                    <span
                      aria-hidden
                      className="mx-1 mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ background: cmd.color }}
                    />
                  ) : (
                    <cmd.icon
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-ink-soft"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {cmd.label}
                    </span>
                    {cmd.detail && (
                      <span className="mt-0.5 block truncate text-xs text-ink-soft">
                        {cmd.detail}
                      </span>
                    )}
                  </span>
                  {cmd.hint && (
                    <span className="mt-0.5 hidden max-w-[45%] shrink-0 truncate text-xs text-ink-soft sm:block">
                      {cmd.hint}
                    </span>
                  )}
                  {i === vm.active && (
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
      {vm.results.length === 0 && (
        <li
          role="presentation"
          className="px-3 py-6 text-center text-sm text-ink-soft"
        >
          {c.empty}
        </li>
      )}
    </ul>
  )
}

/** Podpowiedzi klawiszy i wejście do listy skrótów. */
function Footer({ vm }: { vm: CommandPaletteViewModel }) {
  const c = vm.t.commands
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-ink-soft">
      <p aria-hidden className="flex flex-wrap gap-x-4 gap-y-1">
        {vm.searchingNow ? (
          <span>{c.searching}</span>
        ) : (
          <>
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> {c.hints.move}
            </span>
            <span>
              <Kbd>↵</Kbd> {c.hints.open}
            </span>
            {vm.activeCommand?.alt && (
              <span>
                <Kbd>{vm.mod}</Kbd> <Kbd>↵</Kbd> {c.hints.continue}
              </span>
            )}
          </>
        )}
      </p>
      <button
        type="button"
        onClick={vm.showHelp}
        className="ml-auto inline-flex min-h-6 items-center gap-1.5 rounded hover:text-ink"
      >
        <Keyboard aria-hidden className="size-3.5" />
        {c.shortcuts}
      </button>
    </div>
  )
}
