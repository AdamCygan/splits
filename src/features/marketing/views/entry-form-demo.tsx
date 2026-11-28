import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import { workKindColors } from '#/features/task-types/domain/work-types'
import type { WorkKind } from '#/features/task-types/domain/work-types'
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

function buildForms(copy: Copy, tabLabel: (formKind: FormKind) => string) {
  const fieldLabels = copy.fields
  const values = copy.values
  return (
    [
      [
        'task',
        [
          {
            kind: 'text',
            label: fieldLabels.title,
            value: values.taskTitle,
            required: true,
          },
          {
            kind: 'text',
            label: fieldLabels.taskLink,
            value: 'https://jira.example.com/browse/PAY-142',
          },
          { kind: 'sp', value: 3 },
          { kind: 'range', from: '09:15', to: '11:25' },
          {
            kind: 'text',
            label: fieldLabels.description,
            value: values.description,
          },
        ],
      ],
      [
        'code_review',
        [
          {
            kind: 'text',
            label: fieldLabels.mrLink,
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
          {
            kind: 'text',
            label: fieldLabels.title,
            value: values.pairTitle,
            required: true,
          },
          { kind: 'duration', value: '1 h' },
          { kind: 'sp', value: 1 },
        ],
      ],
      [
        'additional_work',
        [
          {
            kind: 'text',
            label: fieldLabels.title,
            value: values.extraTitle,
            required: true,
          },
          { kind: 'duration', value: '40 min' },
          { kind: 'sp', value: 0.5 },
        ],
      ],
      [
        'custom',
        [
          {
            kind: 'text',
            label: fieldLabels.typeName,
            value: values.customTitle,
            required: true,
          },
          { kind: 'toggles' },
        ],
      ],
    ] as Array<[FormKind, Array<FieldSpec>]>
  ).map(([kind, fields]) => ({
    kind,
    tab: tabLabel(kind),
    note: copy.notes[kind],
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
  messages: Copy
}

function Field({ spec, messages }: FieldProps) {
  switch (spec.kind) {
    case 'text':
      return (
        <FakeInput
          label={spec.label}
          value={spec.value}
          required={spec.required}
          requiredLabel={messages.required}
        />
      )
    case 'duration':
      return (
        <FakeInput
          label={messages.duration}
          value={spec.value}
          required
          requiredLabel={messages.required}
        />
      )
    case 'range':
      return (
        <div className="grid grid-cols-2 gap-3">
          <FakeInput
            label={messages.start}
            value={spec.from}
            required
            requiredLabel={messages.required}
          />
          <FakeInput
            label={messages.end}
            value={spec.to}
            required
            requiredLabel={messages.required}
          />
        </div>
      )
    case 'sp':
      return (
        <div>
          <p className="mb-1 text-sm font-medium">{messages.storyPoints}</p>
          <div className="flex flex-wrap gap-1.5">
            {spScale.map((points) => (
              <span
                key={points}
                className={cn(
                  'min-w-10 rounded-md border px-2 py-1 text-center text-sm',
                  points === spec.value
                    ? 'border-ink bg-ink font-semibold text-white'
                    : 'border-line text-ink-soft',
                )}
              >
                {points}
              </span>
            ))}
          </div>
        </div>
      )
    case 'toggles':
      return (
        <ul className="space-y-2 text-sm">
          {messages.toggles.map(([name, value]) => (
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
  const messages = useMessages(marketingMessages).formDemo
  const workTypes = useMessages(commonMessages).workTypes
  const forms = buildForms(messages, (kind) =>
    kind === 'custom' ? messages.customTab : workTypes[kind],
  )
  const [active, setActive] = useState(0)
  const form = forms[active] ?? forms[0]!

  const onKeyDown = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
    let next: number | null = null
    const isNavigationKey = keyboardEvent.key in keys
    if (isNavigationKey)
      next =
        (active + (keys[keyboardEvent.key] ?? 0) + forms.length) % forms.length
    const isHomeKey = keyboardEvent.key === 'Home'
    if (isHomeKey) next = 0
    const isEndKey = keyboardEvent.key === 'End'
    if (isEndKey) next = forms.length - 1
    const target = next
    const isUnhandledKey = target === null
    if (isUnhandledKey) return
    keyboardEvent.preventDefault()
    setActive(target)
    keyboardEvent.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [target]?.focus()
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div
        role="tablist"
        aria-label={messages.tabsLabel}
        onKeyDown={onKeyDown}
        className="-mx-1 flex gap-1 overflow-x-auto pb-1"
      >
        {forms.map((demoForm, index) => (
          <button
            key={demoForm.kind}
            id={`entry-tab-${demoForm.kind}`}
            role="tab"
            type="button"
            aria-selected={index === active}
            aria-controls="entry-form-panel"
            tabIndex={index === active ? 0 : -1}
            onClick={() => setActive(index)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              index === active
                ? 'bg-ink text-white'
                : 'text-ink-soft hover:bg-muted hover:text-ink',
            )}
          >
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: workKindColors[demoForm.kind].color }}
            />
            {demoForm.tab}
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
        {form.fields.map((spec, index) => (
          <Field
            key={`${form.kind}-${index}`}
            spec={spec}
            messages={messages}
          />
        ))}
        <div className="flex items-center justify-end gap-2 pt-1">
          <span className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
            <Check aria-hidden className="size-4" />
            {messages.save}
          </span>
        </div>
      </div>
    </div>
  )
}
