import { ArrowLeft } from 'lucide-react'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'

/** Lista skrótów klawiszowych w palecie (polecenie „Skróty klawiszowe”). */
export function ShortcutsHelp({
  mod,
  onBack,
}: {
  mod: string
  onBack: () => void
}) {
  const c = useMessages(appMessages).commands
  const rows: Array<[string, string]> = [
    [`${mod} K`, c.keys.palette],
    ['Alt 1–9', c.keys.template],
    [`${mod} Enter`, c.keys.save],
    ['↑ ↓', c.keys.time],
    ['Enter', c.keys.open],
    [`${mod} Enter`, c.keys.continue],
    ['Esc', c.keys.close],
  ]
  return (
    <div className="overflow-y-auto p-5">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid size-9 place-items-center rounded-lg hover:bg-muted"
          aria-label={c.back}
          // Fokus na powrocie, żeby Esc/Enter od razu działały w tym widoku.
          autoFocus
        >
          <ArrowLeft aria-hidden className="size-4" />
        </button>
        <h2 className="type-heading text-xl">{c.shortcutsTitle}</h2>
      </div>
      <dl className="divide-y divide-line">
        {rows.map(([keys, label]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 py-2.5"
          >
            <dt className="text-sm">{label}</dt>
            <dd className="shrink-0">
              <kbd className="rounded border border-line px-2 py-0.5 text-xs text-ink-soft">
                {keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
