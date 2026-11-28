import { useSaveWorkType, useWorkTypes } from '../controllers/use-work-types'
import { taskTypesQuery } from '../data/queries'
import { blankType } from '../domain/work-type-draft'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import {
  Badge,
  ColorDot,
  ColorPicker,
  Field,
  Select,
  Switch,
} from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Segmented } from '#/components/ui/segmented'
import { PlanLimit } from '#/features/billing/views/plan-limit'
import type { TimeInputMode } from '#/features/settings/data/dto'
import { usePalette, withCurrent } from '#/features/settings/domain/palette'
import {
  QueryView,
  SectionHeader,
  SettingsCard,
} from '#/features/settings/views/ui'
import { scaleQuery } from '#/features/story-points/data/queries'
import type {
  FieldRequirement,
  TaskType,
  TaskTypeInput,
} from '#/features/task-types/data/dto'
import { LIMITS } from '#/features/task-types/domain/rules'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { billingMessages } from '#/i18n/messages/billing'
import { settingsMessages } from '#/i18n/messages/settings'
import { cn } from '#/lib/utils'
import { mutationFieldError } from '#/shared/data/mutations'
import { splitArchived } from '#/shared/domain/archive'
import { Archive, ArchiveRestore, Check, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

export function WorkTypeSettings() {
  const messages = useMessages(settingsMessages).workTypes
  const app = useMessages(appMessages)
  const format = useFormat()
  const limits = useMessages(billingMessages).limits
  const [editing, setEditing] = useState<TaskType | 'new' | null>(null)

  const workTypes = useWorkTypes()
  const { archive } = workTypes

  return (
    <div>
      <SectionHeader title={messages.title} lead={messages.lead} />
      <QueryView query={taskTypesQuery} skeletonRows={5}>
        {(types) => {
          const { active, archived } = splitArchived(types)
          const customCount = active.filter(
            (archivable) => !archivable.isSystem,
          ).length
          const atLimit = workTypes.atLimit(customCount)

          return (
            <div className="space-y-6">
              <SettingsCard
                title={messages.title}
                actions={
                  <Button
                    onClick={() => setEditing('new')}
                    disabled={atLimit}
                    aria-describedby={atLimit ? 'type-limit' : undefined}
                  >
                    <Plus aria-hidden className="size-4" />
                    {messages.add}
                  </Button>
                }
              >
                {atLimit && (
                  <PlanLimit id="type-limit">{limits.workTypes}</PlanLimit>
                )}
                <ul className="divide-y divide-line">
                  {active.map((type) => (
                    <li
                      key={type.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                    >
                      <ColorDot color={type.color} className="size-4" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{type.name}</h3>
                          <Badge tone={type.isSystem ? 'muted' : 'info'}>
                            {type.isSystem ? messages.builtIn : messages.custom}
                          </Badge>
                          {!type.countsAsFocusWork && (
                            <Badge tone="muted">{messages.notFocus}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-ink-soft">
                          {messages.summary.link[type.linkRequirement]},{' '}
                          {messages.summary.time[type.defaultTimeInput]},{' '}
                          {type.storyPointsRequirement === 'hidden'
                            ? messages.summary.spHidden
                            : fmt(
                                messages.summary.sp[
                                  type.storyPointsRequirement
                                ],
                                {
                                  sp:
                                    type.defaultStoryPoints === null
                                      ? messages.summary.spNoDefault
                                      : format.sp(type.defaultStoryPoints),
                                },
                              )}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(type)}
                        >
                          <Pencil aria-hidden className="size-4" />
                          {app.actions.edit}
                          <span className="sr-only">: {type.name}</span>
                        </Button>
                        {!type.isSystem && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={archive.pending}
                            onClick={() => archive.archive(type)}
                          >
                            <Archive aria-hidden className="size-4" />
                            {app.actions.archive}
                            <span className="sr-only">: {type.name}</span>
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {archived.length > 0 && (
                  <details className="mt-4">
                    <summary className="w-fit cursor-pointer rounded-md text-sm font-medium">
                      {fmt(messages.archivedTitle, { count: archived.length })}
                    </summary>
                    <ul className="mt-2 divide-y divide-line">
                      {archived.map((type) => (
                        <li
                          key={type.id}
                          className="flex items-center gap-3 py-2.5 text-ink-soft"
                        >
                          <ColorDot color={type.color} />
                          <span className="flex-1">{type.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={archive.pending || atLimit}
                            onClick={() => archive.restore(type)}
                          >
                            <ArchiveRestore aria-hidden className="size-4" />
                            {app.actions.restore}
                            <span className="sr-only">: {type.name}</span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </SettingsCard>
            </div>
          )
        }}
      </QueryView>
      {editing && (
        <WorkTypeDialog
          type={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

interface WorkTypeDialogProps {
  type: TaskType | null
  onClose: () => void
}

function WorkTypeDialog({ type, onClose }: WorkTypeDialogProps) {
  const messages = useMessages(settingsMessages).workTypes
  const app = useMessages(appMessages)
  const format = useFormat()
  const palette = usePalette()
  const scale = useQuery(scaleQuery).data ?? []
  const [draft, setDraft] = useState<TaskTypeInput>(() =>
    type ? { ...type } : blankType(messages.previewTitle),
  )
  const [submitted, setSubmitted] = useState(false)

  const save = useSaveWorkType({ type, onSaved: onClose })

  const errors = {
    name:
      draft.name.trim() && draft.name.length <= LIMITS.taskTypeName
        ? mutationFieldError(save.error, 'name')
        : messages.nameError,
    titleLabel:
      draft.titleLabel.trim() && draft.titleLabel.length <= LIMITS.linkLabel
        ? null
        : messages.labelError,
    linkLabel:
      draft.linkRequirement === 'hidden' ||
      (draft.linkLabel.trim() && draft.linkLabel.length <= LIMITS.linkLabel)
        ? null
        : messages.labelError,
  }
  const invalid =
    !draft.name.trim() ||
    draft.name.length > LIMITS.taskTypeName ||
    errors.titleLabel !== null ||
    errors.linkLabel !== null
  const show = (error: string | null) => (submitted ? error : null)
  const requirementOptions = (['hidden', 'optional', 'required'] as const).map(
    (value) => ({ value, label: messages.requirement[value] }),
  )
  const spOptions =
    draft.defaultStoryPoints === null ||
    scale.some((step) => step.points === draft.defaultStoryPoints)
      ? scale
      : [
          ...scale,
          { id: 'current', points: draft.defaultStoryPoints, maxMinutes: 0 },
        ]
  const setSpRequirement = (storyPointsRequirement: FieldRequirement) =>
    setDraft({
      ...draft,
      storyPointsRequirement,
      // Wymagane SP potrzebują wartości domyślnej, a typ bez SP nie ma żadnej.
      defaultStoryPoints:
        storyPointsRequirement === 'hidden'
          ? null
          : storyPointsRequirement === 'required'
            ? (draft.defaultStoryPoints ?? scale[0]?.points ?? 1)
            : draft.defaultStoryPoints,
    })

  const onSubmit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    setSubmitted(true)
    if (!invalid)
      save.mutate({
        ...draft,
        name: draft.name.trim(),
        titleLabel: draft.titleLabel.trim(),
        linkLabel: draft.linkLabel.trim() || 'Link',
      })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="lg"
        title={
          type
            ? fmt(messages.dialog.editTitle, { name: type.name })
            : messages.dialog.addTitle
        }
        description={messages.dialog.description}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="work-type-form"
              disabled={save.isPending}
              aria-busy={save.isPending}
            >
              {save.isPending
                ? app.actions.saving
                : type
                  ? app.actions.save
                  : messages.add}
            </Button>
          </>
        }
      >
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
          <form
            id="work-type-form"
            noValidate
            onSubmit={onSubmit}
            className="space-y-6"
          >
            <Field label={messages.fields.name} error={show(errors.name)}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  autoFocus
                  maxLength={LIMITS.taskTypeName}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              )}
            </Field>
            <ColorPicker
              legend={messages.fields.color}
              value={draft.color}
              onChange={(color) => setDraft({ ...draft, color })}
              swatches={withCurrent(palette, draft.color)}
            />
            <Field
              label={messages.fields.titleLabel}
              hint={messages.fields.titleLabelHint}
              error={show(errors.titleLabel)}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  maxLength={LIMITS.linkLabel}
                  value={draft.titleLabel}
                  onChange={(event) =>
                    setDraft({ ...draft, titleLabel: event.target.value })
                  }
                />
              )}
            </Field>
            <Segmented<FieldRequirement>
              label={messages.fields.link}
              value={draft.linkRequirement}
              onChange={(linkRequirement) =>
                setDraft({ ...draft, linkRequirement })
              }
              options={requirementOptions}
              size="sm"
            />
            {draft.linkRequirement !== 'hidden' && (
              <Field
                label={messages.fields.linkLabel}
                hint={messages.fields.linkLabelHint}
                error={show(errors.linkLabel)}
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    maxLength={LIMITS.linkLabel}
                    value={draft.linkLabel}
                    onChange={(event) =>
                      setDraft({ ...draft, linkLabel: event.target.value })
                    }
                  />
                )}
              </Field>
            )}
            <Segmented<FieldRequirement>
              label={messages.fields.description}
              value={draft.descriptionRequirement}
              onChange={(descriptionRequirement) =>
                setDraft({ ...draft, descriptionRequirement })
              }
              options={requirementOptions}
              size="sm"
            />
            <Segmented<TimeInputMode>
              label={messages.fields.timeInput}
              value={draft.defaultTimeInput}
              onChange={(defaultTimeInput) =>
                setDraft({ ...draft, defaultTimeInput })
              }
              options={(['range', 'duration'] as const).map((value) => ({
                value,
                label: messages.timeInput[value],
              }))}
              size="sm"
            />
            <div>
              <Segmented<FieldRequirement>
                label={messages.fields.sp}
                value={draft.storyPointsRequirement}
                onChange={setSpRequirement}
                options={(['hidden', 'optional', 'required'] as const).map(
                  (value) => ({ value, label: messages.spRequirement[value] }),
                )}
                size="sm"
              />
              <p className="mt-1.5 text-sm text-ink-soft">
                {messages.spRequirementHint[draft.storyPointsRequirement]}
              </p>
            </div>
            {draft.storyPointsRequirement !== 'hidden' && (
              <Field
                label={messages.fields.defaultSp}
                hint={messages.fields.defaultSpHint}
              >
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    value={draft.defaultStoryPoints ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        defaultStoryPoints:
                          event.target.value === ''
                            ? null
                            : Number(event.target.value),
                      })
                    }
                  >
                    {draft.storyPointsRequirement === 'optional' && (
                      <option value="">{messages.noSpOption}</option>
                    )}
                    {spOptions.map((spOption) => (
                      <option key={spOption.points} value={spOption.points}>
                        {format.sp(spOption.points)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Switch
              label={messages.fields.focus}
              description={messages.fields.focusHint}
              checked={draft.countsAsFocusWork}
              onCheckedChange={(countsAsFocusWork) =>
                setDraft({ ...draft, countsAsFocusWork })
              }
            />
          </form>

          <EntryPreview
            draft={draft}
            scale={scale.map((step) => step.points)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface EntryPreviewProps {
  draft: TaskTypeInput
  scale: Array<number>
}

/** Podgląd formularza wpisu na żywo — widać od razu, co zobaczy użytkownik przy logowaniu czasu. */
function EntryPreview({ draft, scale }: EntryPreviewProps) {
  const messages = useMessages(settingsMessages).workTypes
  const app = useMessages(appMessages)
  const label = (text: string, requirement: FieldRequirement) => (
    <p className="mb-1 text-xs font-medium">
      {text}
      {requirement === 'required' && (
        <span className="text-ink-soft"> {app.status.required}</span>
      )}
      {requirement === 'optional' && (
        <span className="text-ink-soft"> {app.status.optional}</span>
      )}
    </p>
  )
  const box = <div className="h-8 rounded-md border border-input bg-surface" />

  return (
    <aside
      aria-label={messages.preview}
      className="self-start rounded-xl border border-line bg-paper p-4 md:sticky md:top-0"
    >
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ColorDot color={draft.color} />
        {draft.name || messages.preview}
      </p>
      <div className="space-y-3" aria-hidden>
        <div>
          {label(draft.titleLabel || messages.previewTitle, 'required')}
          {box}
        </div>
        {draft.linkRequirement !== 'hidden' && (
          <div>
            {label(draft.linkLabel || 'Link', draft.linkRequirement)}
            {box}
          </div>
        )}
        {draft.defaultTimeInput === 'range' ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              {label(messages.previewStart, 'required')}
              {box}
            </div>
            <div>
              {label(messages.previewEnd, 'required')}
              {box}
            </div>
          </div>
        ) : (
          <div>
            {label(messages.previewDuration, 'required')}
            {box}
          </div>
        )}
        {draft.storyPointsRequirement !== 'hidden' && (
          <div>
            {label('SP', draft.storyPointsRequirement)}
            <div className="flex flex-wrap gap-1">
              {draft.storyPointsRequirement === 'optional' && (
                <span
                  className={cn(
                    'rounded border px-1.5 py-0.5 text-xs',
                    draft.defaultStoryPoints === null
                      ? 'border-[var(--selected)] bg-[var(--selected)] text-[var(--on-selected)]'
                      : 'border-line text-ink-soft',
                  )}
                >
                  {messages.noSpOption}
                </span>
              )}
              {scale.map((points) => (
                <span
                  key={points}
                  className={cn(
                    'rounded border px-1.5 py-0.5 text-xs',
                    points === draft.defaultStoryPoints
                      ? 'border-[var(--selected)] bg-[var(--selected)] text-[var(--on-selected)]'
                      : 'border-line text-ink-soft',
                  )}
                >
                  {points}
                </span>
              ))}
            </div>
          </div>
        )}
        {draft.descriptionRequirement !== 'hidden' && (
          <div>
            {label(messages.previewDescription, draft.descriptionRequirement)}
            <div className="h-14 rounded-md border border-input bg-surface" />
          </div>
        )}
        <div className="flex justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--selected)] px-2.5 py-1.5 text-xs font-medium text-[var(--on-selected)]">
            <Check className="size-3" />
            {messages.previewSave}
          </span>
        </div>
      </div>
    </aside>
  )
}
