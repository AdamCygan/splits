import { useState } from 'react'
import { CheckableNote } from '#/components/note/note-markdown'

/** Notatka w Markdown; długa zwija się z przyciskiem „pokaż całość”. Checkboxy odhacza się w miejscu. */
export function Notes({
  text,
  moreLabel,
  onSave,
}: {
  text: string
  moreLabel: string
  onSave?: (next: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  // Krótka lista kontrolna mieści się bez zwijania, żeby dało się ją odhaczać od razu.
  const long = text.length > 500 || text.split('\n').length > 8
  const folded = long && !open
  return (
    <>
      <div
        // Zwinięta notatka jest nieaktywna (bez ukrytych linków i checkboxów pod Tabem), aż do „pokaż całość”.
        inert={folded}
        className={
          folded
            ? 'max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]'
            : undefined
        }
      >
        <CheckableNote text={text} headingLevel={4} onSave={onSave} />
      </div>
      {folded && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 text-sm font-medium underline underline-offset-4"
        >
          {moreLabel}
        </button>
      )}
    </>
  )
}
