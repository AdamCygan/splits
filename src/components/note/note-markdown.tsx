import { useState } from 'react'
import type { ComponentProps, PropsWithChildren } from 'react'
import Markdown from 'react-markdown'
import type { Components, ExtraProps } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import type { PluggableList, Plugin } from 'unified'
import { cn } from '#/lib/utils'
import { highlightCodeLine } from '#/shared/domain/highlight'
import { toggleTaskAt } from '#/shared/domain/markdown'

interface HastNode {
  type: string
  value?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: Array<HastNode>
}

/**
 * Wyłącza konstrukcje, które w starych notatkach (zwykły tekst) łatwo złapać przypadkiem:
 * wcięcie 4 spacjami nie robi bloku kodu, a linia `---` pod tekstem nie robi z niego nagłówka.
 */
const remarkPlainTextSafe: Plugin = function () {
  const data = this.data() as { micromarkExtensions?: Array<unknown> }
  ;(data.micromarkExtensions ??= []).push({
    disable: { null: ['codeIndented', 'setextUnderline'] },
  })
}

const plugins: PluggableList = [remarkGfm, remarkBreaks, remarkPlainTextSafe]

const textOf = (node: HastNode | undefined): string =>
  !node
    ? ''
    : node.type === 'text'
      ? (node.value ?? '')
      : (node.children ?? []).map(textOf).join('')

type Level = 1 | 2 | 3 | 4 | 5 | 6

export interface NoteMarkdownProps {
  text: string
  headingLevel?: Level
  onChange?: (next: string) => void
  className?: string
}

/**
 * Notatka w Markdown: nagłówki, pogrubienie, kursywa, listy, checkboxy, kod, linki.
 * `headingLevel` to poziom, od którego zaczynają się nagłówki notatki (żeby nie łamać
 * struktury strony). Z `onChange` checkboxy da się odhaczać bez otwierania edytora.
 */
export function NoteMarkdown({
  text,
  headingLevel = 4,
  onChange,
  className,
}: NoteMarkdownProps) {
  const heading =
    (depth: number) =>
    ({ children }: PropsWithChildren) => {
      // # i ## to ten sam poziom (pasek wstawia ##), ### i dalej schodzą niżej.
      const level = Math.min(6, headingLevel + Math.max(0, depth - 2))
      const Tag = `h${level}` as 'h4'
      return (
        <Tag
          className={cn(
            'mt-3 mb-1 font-semibold text-ink first:mt-0',
            depth === 1 ? 'text-base' : 'text-[0.9375rem]',
          )}
        >
          {children}
        </Tag>
      )
    }

  const components: Components = {
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    h5: heading(5),
    h6: heading(6),
    p: ({ children }) => (
      <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium break-words underline underline-offset-4"
      >
        {children}
      </a>
    ),
    // Obrazy w notatkach pokazujemy jako link (nic nie ładuje się samo z zewnątrz).
    img: ({ src: source, alt: alternative }) => (
      <a
        href={typeof source === 'string' ? source : undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium break-words underline underline-offset-4"
      >
        {alternative || (typeof source === 'string' ? source : '')}
      </a>
    ),
    // Zagnieżdżone listy wcinają się o szerokość znacznika; checkbox stoi w miejscu kropki.
    ul: ({ children }) => (
      <ul className="my-1.5 list-disc space-y-0.5 pl-5 [&_ol]:my-0.5 [&_ul]:my-0.5">
        {children}
      </ul>
    ),
    ol: ({ children, start }) => (
      <ol
        start={start}
        className="my-1.5 list-decimal space-y-0.5 pl-5 [&_ol]:my-0.5 [&_ul]:my-0.5"
      >
        {children}
      </ol>
    ),
    li: (props) => <ListItem {...props} text={text} onTaskToggle={onChange} />,
    // Checkbox rysuje ListItem (z pozycją w tekście, żeby dało się go przełączyć).
    input: ({ type, ...rest }) =>
      type === 'checkbox' ? null : <input type={type} {...rest} />,
    blockquote: ({ children }) => (
      <blockquote className="my-1.5 border-l-4 border-line pl-3 text-ink-soft">
        {children}
      </blockquote>
    ),
    code: ({ className: language, children }) =>
      language?.startsWith('language-') || String(children).includes('\n') ? (
        <code className="font-mono text-[0.8125rem]">
          {highlighted(String(children), language?.slice('language-'.length))}
        </code>
      ) : (
        <code className="rounded bg-ink/8 px-1 py-0.5 font-mono text-[0.8125em]">
          {children}
        </code>
      ),
    pre: ({ children }) => (
      <pre
        // Długie linie kodu przewijają się w poziomie; region musi być osiągalny z klawiatury.
        tabIndex={0}
        className="code-dark my-2 relative overflow-x-auto rounded-lg bg-[var(--code-block-bg)] px-3.5 py-3 leading-relaxed text-[var(--code-block-ink)] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {children}
      </pre>
    ),
    hr: () => <hr className="my-3 border-line" />,
    table: ({ children }) => (
      <div tabIndex={0} className="my-2 relative overflow-x-auto">
        <table className="text-left text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b border-line px-2 py-1 font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-line px-2 py-1">{children}</td>
    ),
  }

  return (
    <div className={cn('text-sm leading-relaxed break-words', className)}>
      <Markdown remarkPlugins={plugins} components={components}>
        {text}
      </Markdown>
    </div>
  )
}

function ListItem({
  node,
  children,
  className,
  text,
  onTaskToggle,
}: ComponentProps<'li'> &
  ExtraProps & { text: string; onTaskToggle?: (next: string) => void }) {
  const tree = node as unknown as HastNode & {
    position?: { start: { offset?: number } }
  }
  if (!className?.includes('task-list-item')) return <li>{children}</li>
  const box = tree.children?.find((child) => child.tagName === 'input')
  const checked = Boolean(box?.properties?.checked)
  const offset = tree.position?.start.offset
  const label = textOf(tree).trim()
  const toggle =
    onTaskToggle && offset !== undefined
      ? () => {
          const next = toggleTaskAt(text, offset)
          if (next !== null) onTaskToggle(next)
        }
      : undefined
  return (
    <li className="-ml-5 flex list-none items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={!toggle}
        onChange={toggle}
        aria-label={label}
        className="mt-[0.2rem] size-4 shrink-0 accent-ink disabled:opacity-100"
      />
      <span className={cn('min-w-0', checked && 'text-ink-soft line-through')}>
        {children}
      </span>
    </li>
  )
}

/**
 * Notatka z odhaczaniem checkboxów w miejscu: zmiana widać od razu, zapis idzie w tle,
 * a gdy się nie uda, wraca poprzedni stan.
 */
export function CheckableNote({
  text,
  onSave,
  ...rest
}: Omit<ComponentProps<typeof NoteMarkdown>, 'onChange'> & {
  onSave?: (next: string) => Promise<unknown>
}) {
  const [local, setLocal] = useState<{ base: string; next: string } | null>(
    null,
  )
  // Lokalna zmiana obowiązuje tylko, dopóki serwer nie odda nowej wersji notatki.
  const shown = local && local.base === text ? local.next : text
  return (
    <NoteMarkdown
      {...rest}
      text={shown}
      onChange={
        onSave &&
        ((next) => {
          setLocal({ base: text, next })
          onSave(next).catch(() => setLocal(null))
        })
      }
    />
  )
}

/** Blok kodu z kolorowaniem składni (linia po linii, bez końcowej pustej linii). */
function highlighted(code: string, language = '') {
  const lines = code.replace(/\n$/, '').split('\n')
  return lines.map((line, index) => (
    <span key={index}>
      {highlightCodeLine(line, language).map((part, position) =>
        part.kind ? (
          <span key={position} className={`tok-${part.kind}`}>
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
      {index < lines.length - 1 && '\n'}
    </span>
  ))
}
