import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/controls'
import { data } from '#/data'
import type { UserSettings } from '#/data/types'
import {
  SUMMARY_PLACEHOLDERS,
  SUMMARY_TEMPLATE_MAX,
  renderSummary,
  unknownPlaceholders,
} from '#/domain/summary'
import type { SummaryPlaceholder } from '#/domain/summary'
import {
  defaultSummaryTemplate,
  sampleValues,
} from '#/features/time-entries/summary'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { settingsMessages } from '#/i18n/messages/settings'
import { keys, settingsQuery, useDataMutation } from '../queries'
import {
  QueryView,
  SaveBar,
  SectionHeader,
  SettingsCard,
  useUnsavedWarning,
} from './ui'

export function SummarySettings() {
  const t = useMessages(settingsMessages).summaries
  return (
    <div>
      <SectionHeader title={t.title} lead={t.lead} />
      <QueryView query={settingsQuery} skeletonRows={4}>
        {(settings) => <TemplateEditor settings={settings} />}
      </QueryView>
    </div>
  )
}

function TemplateEditor({ settings }: { settings: UserSettings }) {
  const t = useMessages(settingsMessages).summaries
  const { locale } = useI18n()
  const fallback = defaultSummaryTemplate(locale)
  const saved = settings.summaryTemplate ?? fallback
  const [value, setValue] = useState(saved)
  const [submitted, setSubmitted] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => setValue(saved), [saved])

  const save = useDataMutation(
    (template: string | null) =>
      data.settings.update({ ...settings, summaryTemplate: template }),
    { invalidate: [keys.settings], success: t.saved },
  )

  const dirty = value !== saved
  useUnsavedWarning(dirty)
  const tooLong = value.length > SUMMARY_TEMPLATE_MAX
  const unknown = unknownPlaceholders(value)
  const preview = renderSummary(value, sampleValues(locale))

  /** Wstawia {pole} w miejscu kursora i zostawia kursor za nim. */
  const insert = (name: SummaryPlaceholder) => {
    const el = ref.current
    const token = `{${name}}`
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    setValue(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (tooLong) return
    // Szablon równy domyślnemu zapisujemy jako null: zmieni się razem z językiem.
    save.mutate(value.trim() === fallback ? null : value)
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      <SettingsCard
        title={t.editorTitle}
        lead={t.editorLead}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => setValue(fallback)}
            disabled={value === fallback}
          >
            <RotateCcw aria-hidden className="size-4" />
            {t.reset}
          </Button>
        }
      >
        <div
          role="group"
          aria-label={t.fieldsLabel}
          className="flex flex-wrap gap-1.5"
        >
          {SUMMARY_PLACEHOLDERS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => insert(name)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm hover:border-ink/40"
            >
              <code className="font-mono text-xs text-ink-soft">{`{${name}}`}</code>
              <span className="font-medium">{t.fields[name]}</span>
            </button>
          ))}
        </div>
        <label
          htmlFor="summary-template"
          className="mt-5 block text-sm font-medium"
        >
          {t.label}
        </label>
        <Textarea
          ref={ref}
          id="summary-template"
          rows={7}
          spellCheck
          className="mt-2 font-mono text-sm leading-relaxed"
          aria-invalid={submitted && tooLong ? true : undefined}
          aria-describedby="summary-template-status"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <p
          id="summary-template-status"
          className={
            submitted && tooLong
              ? 'mt-1.5 text-sm text-destructive'
              : 'mt-1.5 text-sm text-ink-soft'
          }
        >
          {submitted && tooLong
            ? t.tooLong
            : unknown.length
              ? fmt(t.unknown, {
                  names: unknown.map((n) => `{${n}}`).join(', '),
                })
              : `${value.length}/${SUMMARY_TEMPLATE_MAX}`}
        </p>
      </SettingsCard>

      <SettingsCard title={t.previewTitle} lead={t.previewLead}>
        <pre
          aria-live="polite"
          className="rounded-lg border border-line bg-muted/40 px-4 py-3 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink"
        >
          {preview}
        </pre>
      </SettingsCard>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        onDiscard={() => {
          setValue(saved)
          setSubmitted(false)
        }}
      />
    </form>
  )
}
