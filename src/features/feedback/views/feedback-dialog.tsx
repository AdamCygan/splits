import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { Bug, HelpCircle, Lightbulb } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Field, Switch, Textarea } from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { useCurrentUser } from '#/features/auth/data/session'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { feedbackMessages } from '#/i18n/messages/feedback'
import { cn } from '#/lib/utils'
import { useFeedbackRequests } from '../controllers/open-feedback'
import { useFeedbackForm } from '../controllers/use-feedback'
import { FEEDBACK_KINDS } from '../domain/feedback'
import type { FeedbackKind } from '../domain/feedback'

const KIND_ICONS = { bug: Bug, idea: Lightbulb, question: HelpCircle } as const

/** Okno zgłoszenia, otwierane z menu, palety poleceń albo strony Pomoc (openFeedback). */
export function FeedbackDialogHost() {
  const [kind, setKind] = useState<FeedbackKind | null>(null)
  useFeedbackRequests(useCallback((next) => setKind(next), []))
  if (!kind) return null
  return <FeedbackDialog initialKind={kind} onClose={() => setKind(null)} />
}

interface FeedbackDialogProps {
  initialKind: FeedbackKind
  onClose: () => void
}

function FeedbackDialog({ initialKind, onClose }: FeedbackDialogProps) {
  const messages = useMessages(feedbackMessages).dialog
  const app = useMessages(appMessages)
  const isDemo = useCurrentUser()?.isDemo === true
  const form = useFeedbackForm({ initialKind, onSent: onClose })

  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    form.submit()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="md"
        title={messages.title}
        description={isDemo ? messages.demo : messages.lead}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="feedback-form"
              disabled={form.sending}
              aria-busy={form.sending}
            >
              {messages.send}
            </Button>
          </>
        }
      >
        <form
          id="feedback-form"
          noValidate
          onSubmit={submit}
          className="space-y-5"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              {messages.kind}
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {FEEDBACK_KINDS.map((kind) => {
                const Icon = KIND_ICONS[kind]
                const checked = form.kind === kind
                return (
                  <label
                    key={kind}
                    title={messages.kindHints[kind]}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
                      'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                      checked
                        ? 'border-ink bg-surface shadow-sm'
                        : 'border-line hover:border-ink/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="feedback-kind"
                      value={kind}
                      checked={checked}
                      onChange={() => form.setKind(kind)}
                      className="sr-only"
                    />
                    <Icon aria-hidden className="size-4 shrink-0" />
                    <span className="text-sm font-medium">
                      {messages.kinds[kind]}
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              {messages.kindHints[form.kind]}
            </p>
          </fieldset>

          <Field label={messages.message} error={form.error}>
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                rows={6}
                maxLength={4000}
                autoFocus
                placeholder={messages.placeholder[form.kind]}
                value={form.message}
                onChange={(event) => form.setMessage(event.target.value)}
              />
            )}
          </Field>

          <Switch
            label={messages.context}
            description={fmt(messages.contextHint, {
              page: form.page,
              browser: form.browser,
            })}
            checked={form.withContext}
            onCheckedChange={form.setWithContext}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
