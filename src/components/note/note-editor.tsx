import {
  Bold,
  Code,
  Eye,
  Heading,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  PenLine,
  SquareCode,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ComponentProps, KeyboardEvent } from 'react'
import {
  continueList,
  indentList,
  insertCodeBlock,
  toggleLinePrefix,
  toggleWrap,
} from '#/shared/domain/markdown'
import type { TextState } from '#/shared/domain/markdown'
import { useMessages } from '#/i18n/context'
import { entriesMessages } from '#/i18n/messages/entries'
import { markdownLines } from '#/shared/domain/highlight'
import type { MarkdownLine, Part } from '#/shared/domain/highlight'
import { isApplePlatform } from '#/lib/platform'
import { cn } from '#/lib/utils'
import { NoteMarkdown } from './note-markdown'

interface Action {
  id: string
  icon: LucideIcon
  label: string
  keys?: string
  run: (textState: TextState) => TextState
}

/**
 * Pole notatki z paskiem formatowania (Markdown): nagłówek, pogrubienie, kursywa, listy,
 * checkboxy, kod. Zmiany idą przez `insertText`, więc Ctrl+Z cofa je jak zwykłe pisanie.
 * Enter w liście dodaje kolejną pozycję; „Podgląd” pokazuje notatkę tak jak na liście.
 */
export function NoteEditor({
  value,
  onValueChange,
  headingLevel = 3,
  className,
  ...textarea
}: Omit<ComponentProps<'textarea'>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (next: string) => void
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
}) {
  const messages = useMessages(entriesMessages).noteEditor
  const ref = useRef<HTMLTextAreaElement>(null)
  const pending = useRef<{ start: number; end: number } | null>(null)
  const [preview, setPreview] = useState(false)
  const module = isApplePlatform() ? '⌘' : 'Ctrl+'

  // Zaznaczenie po zmianie, gdy tekst poszedł przez stan Reacta (bez insertText).
  useLayoutEffect(() => {
    const selection = pending.current
    const element = ref.current
    if (!selection || !element || element.value !== value) return
    pending.current = null
    element.setSelectionRange(selection.start, selection.end)
  }, [value])

  function apply(next: TextState) {
    const element = ref.current
    if (!element) return
    const old = element.value
    let commonPrefix = 0
    while (
      commonPrefix < old.length &&
      commonPrefix < next.value.length &&
      old[commonPrefix] === next.value[commonPrefix]
    )
      commonPrefix++
    let commonSuffix = 0
    while (
      commonSuffix < old.length - commonPrefix &&
      commonSuffix < next.value.length - commonPrefix &&
      old[old.length - 1 - commonSuffix] ===
        next.value[next.value.length - 1 - commonSuffix]
    )
      commonSuffix++
    const insert = next.value.slice(
      commonPrefix,
      next.value.length - commonSuffix,
    )
    element.focus()
    element.setSelectionRange(commonPrefix, old.length - commonSuffix)
    // insertText trzyma historię cofania przeglądarki; gdy jej nie ma, ustawiamy wartość sami.
    const ok =
      insert === ''
        ? commonPrefix === old.length - commonSuffix ||
          document.execCommand('delete')
        : document.execCommand('insertText', false, insert)
    if (ok && element.value === next.value) {
      element.setSelectionRange(next.start, next.end)
    } else {
      pending.current = { start: next.start, end: next.end }
      onValueChange(next.value)
    }
  }

  function run(action: Action) {
    const element = ref.current
    if (!element) return
    apply(
      action.run({
        value: element.value,
        start: element.selectionStart,
        end: element.selectionEnd,
      }),
    )
  }

  const actions: Array<Action> = [
    {
      id: 'heading',
      icon: Heading,
      label: messages.heading,
      run: (textState) => toggleLinePrefix(textState, '## '),
    },
    {
      id: 'bold',
      icon: Bold,
      label: messages.bold,
      keys: 'B',
      run: (textState) => toggleWrap(textState, '**', messages.boldText),
    },
    {
      id: 'italic',
      icon: Italic,
      label: messages.italic,
      keys: 'I',
      run: (textState) => toggleWrap(textState, '_', messages.italicText),
    },
    {
      id: 'bullets',
      icon: List,
      label: messages.bullets,
      run: (textState) => toggleLinePrefix(textState, '- '),
    },
    {
      id: 'numbers',
      icon: ListOrdered,
      label: messages.numbers,
      run: (textState) => toggleLinePrefix(textState, '1. '),
    },
    {
      id: 'checklist',
      icon: ListChecks,
      label: messages.checklist,
      run: (textState) => toggleLinePrefix(textState, '- [ ] '),
    },
    {
      id: 'indent',
      icon: IndentIncrease,
      label: messages.indent,
      run: (textState) => indentList(textState, 1) ?? textState,
    },
    {
      id: 'outdent',
      icon: IndentDecrease,
      label: messages.outdent,
      run: (textState) => indentList(textState, -1) ?? textState,
    },
    {
      id: 'code',
      icon: Code,
      label: messages.code,
      keys: 'E',
      run: (textState) => toggleWrap(textState, '`', messages.codeText),
    },
    {
      id: 'codeBlock',
      icon: SquareCode,
      label: messages.codeBlock,
      run: (textState) => insertCodeBlock(textState),
    },
  ]

  function onKeyDown(keyboardEvent: KeyboardEvent<HTMLTextAreaElement>) {
    textarea.onKeyDown?.(keyboardEvent)
    if (keyboardEvent.defaultPrevented || keyboardEvent.nativeEvent.isComposing)
      return
    const element = keyboardEvent.currentTarget
    const state = {
      value: element.value,
      start: element.selectionStart,
      end: element.selectionEnd,
    }
    // Tab w liście zmienia poziom pozycji; poza listą przenosi fokus jak zwykle.
    if (
      keyboardEvent.key === 'Tab' &&
      !keyboardEvent.altKey &&
      !keyboardEvent.ctrlKey &&
      !keyboardEvent.metaKey
    ) {
      const next = indentList(state, keyboardEvent.shiftKey ? -1 : 1)
      if (next) {
        keyboardEvent.preventDefault()
        apply(next)
      }
      return
    }
    if (
      keyboardEvent.key === 'Enter' &&
      !keyboardEvent.shiftKey &&
      !keyboardEvent.altKey &&
      !keyboardEvent.ctrlKey &&
      !keyboardEvent.metaKey
    ) {
      const next = continueList(state)
      if (next) {
        keyboardEvent.preventDefault()
        apply(next)
      }
      return
    }
    if (
      (keyboardEvent.ctrlKey || keyboardEvent.metaKey) &&
      !keyboardEvent.altKey &&
      !keyboardEvent.shiftKey
    ) {
      const action = actions.find(
        (editorAction) =>
          editorAction.keys?.toLowerCase() === keyboardEvent.key.toLowerCase(),
      )
      if (action) {
        keyboardEvent.preventDefault()
        run(action)
      }
    }
  }

  // Pasek narzędzi: Tab wchodzi raz, strzałki chodzą po przyciskach (wzorzec ARIA toolbar).
  const [focusIndex, setFocusIndex] = useState(0)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  function onToolbarKey(keyboardEvent: KeyboardEvent<HTMLDivElement>) {
    const step =
      keyboardEvent.key === 'ArrowRight'
        ? 1
        : keyboardEvent.key === 'ArrowLeft'
          ? -1
          : keyboardEvent.key === 'Home'
            ? -99
            : keyboardEvent.key === 'End'
              ? 99
              : 0
    if (!step) return
    keyboardEvent.preventDefault()
    const count = actions.length + 1
    const next =
      Math.abs(step) === 99
        ? step > 0
          ? count - 1
          : 0
        : (focusIndex + step + count) % count
    setFocusIndex(next)
    buttons.current[next]?.focus()
  }

  const toolButton =
    'inline-flex size-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40'

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-input bg-surface shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25 has-aria-invalid:border-destructive',
        className,
      )}
    >
      <div
        role="toolbar"
        aria-label={messages.toolbar}
        aria-controls={
          textarea.id && (preview ? `${textarea.id}-preview` : textarea.id)
        }
        onKeyDown={onToolbarKey}
        className="flex flex-wrap items-center gap-0.5 border-b border-line bg-muted/40 px-1.5 py-1"
      >
        {actions.map((action, index) => {
          const Icon = action.icon
          const shortcut = action.keys ? `${module}${action.keys}` : null
          return (
            <button
              key={action.id}
              ref={(element) => {
                buttons.current[index] = element
              }}
              type="button"
              tabIndex={focusIndex === index ? 0 : -1}
              disabled={preview}
              aria-label={action.label}
              aria-keyshortcuts={
                action.keys
                  ? `${isApplePlatform() ? 'Meta' : 'Control'}+${action.keys}`
                  : undefined
              }
              title={shortcut ? `${action.label} (${shortcut})` : action.label}
              onFocus={() => setFocusIndex(index)}
              // Przycisk nie zabiera fokusu z pola, więc zaznaczenie zostaje na miejscu.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => run(action)}
              className={toolButton}
            >
              <Icon aria-hidden className="size-4" />
            </button>
          )
        })}
        <button
          ref={(element) => {
            buttons.current[actions.length] = element
          }}
          type="button"
          tabIndex={focusIndex === actions.length ? 0 : -1}
          aria-pressed={preview}
          onFocus={() => setFocusIndex(actions.length)}
          onClick={() => setPreview((currentPreview) => !currentPreview)}
          className={cn(
            toolButton,
            'ml-auto w-auto gap-1.5 px-2.5 text-sm font-medium',
            preview && 'bg-surface text-ink shadow-xs',
          )}
        >
          {preview ? (
            <PenLine aria-hidden className="size-4" />
          ) : (
            <Eye aria-hidden className="size-4" />
          )}
          {messages.preview}
        </button>
      </div>
      {preview ? (
        <div
          className="min-h-36 px-3.5 py-2.5"
          id={textarea.id && `${textarea.id}-preview`}
          aria-live="polite"
          aria-label={messages.previewLabel}
          role="region"
        >
          {value.trim() ? (
            <NoteMarkdown
              text={value}
              headingLevel={headingLevel}
              onChange={onValueChange}
            />
          ) : (
            <p className="text-sm text-ink-soft">{messages.empty}</p>
          )}
        </div>
      ) : (
        // Pole tekstowe ma przezroczysty tekst nad warstwą z podświetleniem; obie mają ten sam
        // font (stałej szerokości), odstępy i zawijanie, więc znaki leżą dokładnie na sobie.
        // Pole rośnie razem z warstwą, więc nie ma własnego przewijania do zsynchronizowania.
        <div className="grid">
          <div
            aria-hidden
            className={cn(EDITOR_TEXT, 'pointer-events-none text-ink')}
          >
            {markdownLines(value).map((line, index) => (
              <EditorLine key={index} line={line} />
            ))}
          </div>
          <textarea
            {...textarea}
            ref={ref}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={onKeyDown}
            className={cn(
              EDITOR_TEXT,
              'min-h-36 resize-none overflow-hidden bg-transparent text-transparent caret-ink outline-none placeholder:text-ink-faint selection:bg-ring/30 selection:text-transparent',
            )}
          />
        </div>
      )}
    </div>
  )
}

/** Wspólne dla pola i warstwy podświetlenia: każda różnica rozjedzie znaki. */
const EDITOR_TEXT =
  '[grid-area:1/1] m-0 block w-full border-0 px-3.5 py-2.5 font-mono text-[0.875rem] leading-relaxed tracking-normal whitespace-pre-wrap break-words [tab-size:4]'

const PART_CLASS: Record<NonNullable<Part['kind']>, string> = {
  marker: 'text-ink-faint',
  bold: 'font-bold',
  italic: 'italic',
  code: 'rounded-sm bg-ink/10',
  link: 'text-[var(--tok-type)] underline underline-offset-2',
  heading: 'font-bold',
  done: 'text-ink-soft line-through',
  checkbox: 'font-bold text-ink-soft',
  quote: 'text-ink-soft',
  keyword: 'tok-keyword',
  string: 'tok-string',
  comment: 'tok-comment',
  number: 'tok-number',
  type: 'tok-type',
}

interface EditorLineProps {
  line: MarkdownLine
}

/** Jedna linia warstwy podświetlenia; pusta linia dostaje znak zerowej szerokości (wysokość). */
function EditorLine({ line }: EditorLineProps) {
  const empty = line.parts.every((part) => part.text === '')
  return (
    <span
      className={cn(
        'block',
        line.kind !== 'text' && '-mx-3.5 bg-ink/[0.06] px-3.5',
      )}
    >
      {line.parts.map((part, index) =>
        part.kind ? (
          <span key={index} className={PART_CLASS[part.kind]}>
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
      {empty && '\u200b'}
    </span>
  )
}
