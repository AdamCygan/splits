import { useState } from 'react'
import type { FormEvent } from 'react'
import { Palmtree, Stethoscope, PartyPopper, CalendarOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Field } from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { useSaveDaysOff } from '../controllers/use-days-off'
import { DAY_OFF_KINDS } from '#/features/days-off/data/dto'
import type { DayOffKind } from '#/features/days-off/data/dto'
import { diffDays } from '#/shared/domain/dates'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { daysOffMessages } from '#/i18n/messages/days-off'
import { cn } from '#/lib/utils'

export const DAY_OFF_ICONS: Record<DayOffKind, LucideIcon> = {
  vacation: Palmtree,
  sick: Stethoscope,
  holiday: PartyPopper,
  other: CalendarOff,
}

/** Kolor rodzaju (kropki, ramki banerów); stałe tokeny typów pracy, czytelne w obu motywach. */
export const DAY_OFF_COLORS: Record<DayOffKind, string> = {
  vacation: 'var(--wt-pair)',
  sick: 'var(--wt-extra)',
  holiday: 'var(--wt-review)',
  other: 'var(--wt-meeting)',
}

export interface DayOffDraft {
  from: string
  to: string
  kind: DayOffKind
  note: string | null
}

export interface DayOffDialogProps {
  initial: DayOffDraft
  replacing?: { from: string; to: string }
  /** Najpóźniejsza data do wyboru (brak = bez limitu, urlop można zaplanować z góry). */
  max?: string
  onClose: () => void
}

/**
 * Oznaczenie dnia albo zakresu jako wolne. `replacing` = zakres, który zmieniamy:
 * najpierw go usuwamy, żeby skrócenie urlopu nie zostawiło starych dni.
 */
export function DayOffDialog({
  initial,
  replacing,
  max,
  onClose,
}: DayOffDialogProps) {
  const messages = useMessages(daysOffMessages)
  const app = useMessages(appMessages)
  const [draft, setDraft] = useState({ ...initial, note: initial.note ?? '' })
  const [submitted, setSubmitted] = useState(false)

  const rangeError =
    draft.to < draft.from
      ? messages.dialog.toBeforeFrom
      : diffDays(draft.from, draft.to) >= 366
        ? messages.dialog.tooLong
        : null

  const save = useSaveDaysOff({ replacing, onSaved: onClose })

  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    setSubmitted(true)
    if (rangeError) return
    save.mutate({
      from: draft.from,
      to: draft.to,
      kind: draft.kind,
      note: draft.note.trim() || null,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="md"
        title={replacing ? messages.dialog.edit : messages.dialog.title}
        description={messages.dialog.lead}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="day-off-form"
              disabled={save.isPending}
              aria-busy={save.isPending}
            >
              {messages.dialog.save}
            </Button>
          </>
        }
      >
        <form
          id="day-off-form"
          noValidate
          onSubmit={submit}
          className="space-y-5"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              {messages.dialog.kind}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {DAY_OFF_KINDS.map((kind) => {
                const Icon = DAY_OFF_ICONS[kind]
                const checked = draft.kind === kind
                return (
                  <label
                    key={kind}
                    className={cn(
                      'relative flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                      'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                      checked
                        ? 'border-ink bg-surface shadow-sm'
                        : 'border-line hover:border-ink/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="day-off-kind"
                      value={kind}
                      checked={checked}
                      onChange={() => setDraft({ ...draft, kind })}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-white"
                      style={{ background: DAY_OFF_COLORS[kind] }}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {messages.kinds[kind]}
                      </span>
                      <span className="block text-sm text-ink-soft">
                        {messages.kindHints[kind]}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <Field label={messages.dialog.from}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="date"
                  required
                  max={max}
                  value={draft.from}
                  onChange={(event) =>
                    event.target.value &&
                    setDraft({
                      ...draft,
                      from: event.target.value,
                      to:
                        draft.to < event.target.value
                          ? event.target.value
                          : draft.to,
                    })
                  }
                />
              )}
            </Field>
            <Field
              label={messages.dialog.to}
              error={submitted ? rangeError : null}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="date"
                  required
                  min={draft.from}
                  max={max}
                  value={draft.to}
                  onChange={(event) =>
                    event.target.value &&
                    setDraft({ ...draft, to: event.target.value })
                  }
                />
              )}
            </Field>
          </div>
          {draft.to !== draft.from && (
            <p className="-mt-2 text-sm text-ink-soft">
              {messages.dialog.range}
            </p>
          )}

          <Field label={`${messages.dialog.note} ${messages.dialog.optional}`}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                maxLength={200}
                placeholder={messages.dialog.notePlaceholder}
                value={draft.note}
                onChange={(event) =>
                  setDraft({ ...draft, note: event.target.value })
                }
              />
            )}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  )
}
