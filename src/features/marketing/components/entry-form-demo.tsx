import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import { workKindColors } from '#/config/work-types'
import type { WorkKind } from '#/config/work-types'
import { useMessages } from '#/i18n/context'
import { commonMessages } from '#/i18n/messages/common'
import { marketingMessages } from '#/i18n/messages/marketing'
import type { MarketingMessages } from '#/i18n/messages/marketing'
import { cn } from '#/lib/utils'

/**
 * Formularz, który zmienia się z typem pracy.
 * Odzwierciedla konfigurację typów pracy (link wymagany/opcjonalny, opis, czas).
 * Zakładki obsługują strzałki ← → (wzorzec WAI-ARIA Tabs).
 */

type Copy = MarketingMessages['formDemo']

type FieldSpec =
  | { kind: 'text'; label: string; value: string; required?: boolean }
  | { kind: 'sp'; value: number }
  | { kind: 'range'; from: string; to: string }
  | { kind: 'duration'; value: string }
  | { kind: 'toggles' }

type FormKind = Exclude<WorkKind, 'meeting'>

function buildForms(t: Copy, tabLabel: (k: FormKind) => string) {
  const f = t.fields
  const v = t.values
  return (
    [
      [
        'task',
        [
          { kind: 'text', label: f.title, value: v.taskTitle, required: true },
          {
            kind: 'text',
            label: f.taskLink,
            value: 'https://jira.example.com/browse/PAY-142',
          },
          { kind: 'sp', value: 3 },
          { kind: 'range', from: '09:15', to: '11:25' },
          { kind: 'text', label: f.description, value: v.description },
        ],
      ],
      [
        'code_review',
        [
          {
            kind: 'text',
            label: f.mrLink,
            value: 'https://gitlab.example.com/shop/-/merge_requests/481',
            required: true,
          },
          { kind: 'duration', value: '25 min' },
          { kind: 'sp', value: 0.5 },
        ],
      ],
      [
        'pair_programming',
        [
          { kind: 'text', label: f.title, value: v.pairTitle, required: true },
          { kind: 'duration', value: '1 h' },
          { kind: 'sp', value: 1 },
        ],
      ],
      [
        'additional_work',
        [
          { kind: 'text', label: f.title, value: v.extraTitle, required: true },
          { kind: 'duration', value: '40 min' },
          { kind: 'sp', value: 0.5 },
        ],
      ],
      [
        'custom',
        [
          {
            kind: 'text',
            label: f.typeName,
            value: v.customTitle,
            required: true,
          },
          { kind: 'toggles' },
        ],
      ],
    ] as Array<[FormKind, Array<FieldSpec>]>
  ).map(([kind, fields]) => ({
    kind,
    tab: tabLabel(kind),
    note: t.notes[kind],
    fields,
  }))
}

const spScale = [0.5, 1, 2, 3, 5, 8, 13]

interface FakeInputProps {
  label: string
  value: string
  required?: boolean
  requiredLabel: string
}

function FakeInput({ label, value, required, requiredLabel }: FakeInputProps) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">
        {label}
        {required && <span className="text-ink-soft"> {requiredLabel}</span>}
      </p>
      <p className="truncate rounded-lg border border-input bg-surface px-3 py-2 text-[0.9375rem]">
        {value}
      </p>
    </div>
  )
}

interface FieldProps {
  spec: FieldSpec
  t: Copy
}

function Field({ spec, t }: FieldProps) {
  switch (spec.kind) {
    case 'text':
      return (
        <FakeInput
          label={spec.label}
          value={spec.value}
          required={spec.required}
          requiredLabel={t.required}
        />
      )
    case 'duration':
      return (
        <FakeInput
          label={t.duration}
          value={spec.value}
          required
          requiredLabel={t.required}
        />
      )
    case 'range':
      return (
        <div className="grid grid-cols-2 gap-3">
          <FakeInput
            label={t.start}
            value={spec.from}
            required
            requiredLabel={t.required}
          />
          <FakeInput
            label={t.end}
            value={spec.to}
            required
            requiredLabel={t.required}
          />
        </div>
      )
    case 'sp':
      return (
        <div>
          <p className="mb-1 text-sm font-medium">{t.storyPoints}</p>
          <div className="flex flex-wrap gap-1.5">
            {spScale.map((p) => (
              <span
                key={p}
                className={cn(
                  'min-w-10 rounded-md border px-2 py-1 text-center text-sm',
                  p === spec.value
                    ? 'border-ink bg-ink font-semibold text-white'
                    : 'border-line text-ink-soft',
                )}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )
    case 'toggles':
      return (
        <ul className="space-y-2 text-sm">
          {t.toggles.map(([name, value]) => (
            <li
              key={name}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
            >
              <span>{name}</span>
              <span className="font-medium">{value}</span>
            </li>
          ))}
        </ul>
      )
  }
}

export function EntryFormDemo() {
  const t = useMessages(marketingMessages).formDemo
  const workTypes = useMessages(commonMessages).workTypes
  const forms = buildForms(t, (k) =>
    k === 'custom' ? t.customTab : workTypes[k],
  )
  const [active, setActive] = useState(0)
  const form = forms[active] ?? forms[0]!

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
    let next: number | null = null
    if (e.key in keys)
      next = (active + (keys[e.key] ?? 0) + forms.length) % forms.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = forms.length - 1
    if (next === null) return
    e.preventDefault()
    setActive(next)
    e.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus()
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div
        role="tablist"
        aria-label={t.tabsLabel}
        onKeyDown={onKeyDown}
        className="-mx-1 flex gap-1 overflow-x-auto pb-1"
      >
        {forms.map((f, i) => (
          <button
            key={f.kind}
            id={`entry-tab-${f.kind}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls="entry-form-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              i === active
                ? 'bg-ink text-white'
                : 'text-ink-soft hover:bg-muted hover:text-ink',
            )}
          >
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: workKindColors[f.kind].color }}
            />
            {f.tab}
          </button>
        ))}
      </div>

      <div
        id="entry-form-panel"
        role="tabpanel"
        aria-labelledby={`entry-tab-${form.kind}`}
        className="mt-5 space-y-4"
      >
        <p className="text-[0.9375rem] text-ink-soft">{form.note}</p>
        {form.fields.map((spec, i) => (
          <Field key={`${form.kind}-${i}`} spec={spec} t={t} />
        ))}
        <div className="flex items-center justify-end gap-2 pt-1">
          <span className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
            <Check aria-hidden className="size-4" />
            {t.save}
          </span>
        </div>
      </div>
    </div>
  )
}
