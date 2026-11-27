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
} from '#/domain/markdown'
import type { TextState } from '#/domain/markdown'
import { useMessages } from '#/i18n/context'
import { entriesMessages } from '#/i18n/messages/entries'
import { markdownLines } from '#/domain/highlight'
import type { MarkdownLine, Part } from '#/domain/highlight'
import { isApplePlatform } from '#/lib/platform'
import { cn } from '#/lib/utils'
import { NoteMarkdown } from './note-markdown'

interface Action {
  id: string
  icon: LucideIcon
  label: string
  keys?: string
  run: (s: TextState) => TextState
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
  const t = useMessages(entriesMessages).noteEditor
  const ref = useRef<HTMLTextAreaElement>(null)
  const pending = useRef<{ start: number; end: number } | null>(null)
  const [preview, setPreview] = useState(false)
  const mod = isApplePlatform() ? '⌘' : 'Ctrl+'

  // Zaznaczenie po zmianie, gdy tekst poszedł przez stan Reacta (bez insertText).
  useLayoutEffect(() => {
    const sel = pending.current
    const el = ref.current
    if (!sel || !el || el.value !== value) return
    pending.current = null
    el.setSelectionRange(sel.start, sel.end)
  }, [value])

  function apply(next: TextState) {
    const el = ref.current
    if (!el) return
    const old = el.value
    let p = 0
    while (p < old.length && p < next.value.length && old[p] === next.value[p])
      p++
    let q = 0
    while (
      q < old.length - p &&
      q < next.value.length - p &&
      old[old.length - 1 - q] === next.value[next.value.length - 1 - q]
    )
      q++
    const insert = next.value.slice(p, next.value.length - q)
    el.focus()
    el.setSelectionRange(p, old.length - q)
    // insertText trzyma historię cofania przeglądarki; gdy jej nie ma, ustawiamy wartość sami.
    const ok =
      insert === ''
        ? p === old.length - q || document.execCommand('delete')
        : document.execCommand('insertText', false, insert)
    if (ok && el.value === next.value) {
      el.setSelectionRange(next.start, next.end)
    } else {
      pending.current = { start: next.start, end: next.end }
      onValueChange(next.value)
    }
  }

  function run(action: Action) {
    const el = ref.current
    if (!el) return
    apply(
      action.run({
        value: el.value,
        start: el.selectionStart,
        end: el.selectionEnd,
      }),
    )
  }

  const actions: Array<Action> = [
    {
      id: 'heading',
      icon: Heading,
      label: t.heading,
      run: (s) => toggleLinePrefix(s, '## '),
    },
    {
      id: 'bold',
      icon: Bold,
      label: t.bold,
      keys: 'B',
      run: (s) => toggleWrap(s, '**', t.boldText),
    },
    {
      id: 'italic',
      icon: Italic,
      label: t.italic,
      keys: 'I',
      run: (s) => toggleWrap(s, '_', t.italicText),
    },
    {
      id: 'bullets',
      icon: List,
      label: t.bullets,
      run: (s) => toggleLinePrefix(s, '- '),
    },
    {
      id: 'numbers',
      icon: ListOrdered,
      label: t.numbers,
      run: (s) => toggleLinePrefix(s, '1. '),
    },
    {
      id: 'checklist',
      icon: ListChecks,
      label: t.checklist,
      run: (s) => toggleLinePrefix(s, '- [ ] '),
    },
    {
      id: 'indent',
      icon: IndentIncrease,
      label: t.indent,
      run: (s) => indentList(s, 1) ?? s,
    },
    {
      id: 'outdent',
      icon: IndentDecrease,
      label: t.outdent,
      run: (s) => indentList(s, -1) ?? s,
    },
    {
      id: 'code',
      icon: Code,
      label: t.code,
      keys: 'E',
      run: (s) => toggleWrap(s, '`', t.codeText),
    },
    {
      id: 'codeBlock',
      icon: SquareCode,
      label: t.codeBlock,
      run: (s) => insertCodeBlock(s),
    },
  ]

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    textarea.onKeyDown?.(e)
    if (e.defaultPrevented || e.nativeEvent.isComposing) return
    const el = e.currentTarget
    const state = {
      value: el.value,
      start: el.selectionStart,
      end: el.selectionEnd,
    }
    // Tab w liście zmienia poziom pozycji; poza listą przenosi fokus jak zwykle.
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const next = indentList(state, e.shiftKey ? -1 : 1)
      if (next) {
        e.preventDefault()
        apply(next)
      }
      return
    }
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.altKey &&
      !e.ctrlKey &&
      !e.metaKey
    ) {
      const next = continueList(state)
      if (next) {
        e.preventDefault()
        apply(next)
      }
      return
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      const action = actions.find(
        (a) => a.keys?.toLowerCase() === e.key.toLowerCase(),
      )
      if (action) {
        e.preventDefault()
        run(action)
      }
    }
  }

  // Pasek narzędzi: Tab wchodzi raz, strzałki chodzą po przyciskach (wzorzec ARIA toolbar).
  const [focusIndex, setFocusIndex] = useState(0)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  function onToolbarKey(e: KeyboardEvent<HTMLDivElement>) {
    const step =
      e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowLeft'
          ? -1
          : e.key === 'Home'
            ? -99
            : e.key === 'End'
              ? 99
              : 0
    if (!step) return
    e.preventDefault()
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
        aria-label={t.toolbar}
        aria-controls={
          textarea.id && (preview ? `${textarea.id}-preview` : textarea.id)
        }
        onKeyDown={onToolbarKey}
        className="flex flex-wrap items-center gap-0.5 border-b border-line bg-muted/40 px-1.5 py-1"
      >
        {actions.map((action, i) => {
          const Icon = action.icon
          const shortcut = action.keys ? `${mod}${action.keys}` : null
          return (
            <button
              key={action.id}
              ref={(el) => {
                buttons.current[i] = el
              }}
              type="button"
              tabIndex={focusIndex === i ? 0 : -1}
              disabled={preview}
              aria-label={action.label}
              aria-keyshortcuts={
                action.keys
                  ? `${isApplePlatform() ? 'Meta' : 'Control'}+${action.keys}`
                  : undefined
              }
              title={shortcut ? `${action.label} (${shortcut})` : action.label}
              onFocus={() => setFocusIndex(i)}
              // Przycisk nie zabiera fokusu z pola, więc zaznaczenie zostaje na miejscu.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(action)}
              className={toolButton}
            >
              <Icon aria-hidden className="size-4" />
            </button>
          )
        })}
        <button
          ref={(el) => {
            buttons.current[actions.length] = el
          }}
          type="button"
          tabIndex={focusIndex === actions.length ? 0 : -1}
          aria-pressed={preview}
          onFocus={() => setFocusIndex(actions.length)}
          onClick={() => setPreview((p) => !p)}
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
          {t.preview}
        </button>
      </div>
      {preview ? (
        <div
          className="min-h-36 px-3.5 py-2.5"
          id={textarea.id && `${textarea.id}-preview`}
          aria-live="polite"
          aria-label={t.previewLabel}
          role="region"
        >
          {value.trim() ? (
            <NoteMarkdown
              text={value}
              headingLevel={headingLevel}
              onChange={onValueChange}
            />
          ) : (
            <p className="text-sm text-ink-soft">{t.empty}</p>
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
            {markdownLines(value).map((line, i) => (
              <EditorLine key={i} line={line} />
            ))}
          </div>
          <textarea
            {...textarea}
            ref={ref}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
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
  const empty = line.parts.every((p) => p.text === '')
  return (
    <span
      className={cn(
        'block',
        line.kind !== 'text' && '-mx-3.5 bg-ink/[0.06] px-3.5',
      )}
    >
      {line.parts.map((p, i) =>
        p.kind ? (
          <span key={i} className={PART_CLASS[p.kind]}>
            {p.text}
          </span>
        ) : (
          p.text
        ),
      )}
      {empty && '\u200b'}
    </span>
  )
}
