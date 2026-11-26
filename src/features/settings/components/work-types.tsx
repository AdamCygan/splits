import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Archive, ArchiveRestore, Check, Pencil, Plus } from 'lucide-react'
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
import { data } from '#/data'
import type {
  FieldRequirement,
  TaskType,
  TaskTypeInput,
  TimeInputMode,
} from '#/data/types'
import { LIMITS } from '#/domain/rules'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/plans'
import { useCurrentUser } from '#/features/auth/session'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { cn } from '#/lib/utils'
import {
  keys,
  mutationFieldError,
  scaleQuery,
  taskTypesQuery,
  useDataMutation,
} from '../queries'
import { markSetupStep } from '../setup-progress'
import { usePalette, withCurrent } from './palette'
import { QueryView, SectionHeader, SettingsCard } from './ui'

export function WorkTypeSettings() {
  const t = useMessages(settingsMessages).workTypes
  const app = useMessages(appMessages)
  const format = useFormat()
  const user = useCurrentUser()
  const [editing, setEditing] = useState<TaskType | 'new' | null>(null)

  const archive = useDataMutation(
    ({ id, archived }: { id: string; archived: boolean; name: string }) =>
      data.taskTypes.setArchived(id, archived),
    {
      invalidate: [keys.taskTypes],
      success: (_r, v) =>
        fmt(v.archived ? t.archived : t.restored, { name: v.name }),
    },
  )

  return (
    <div>
      <SectionHeader title={t.title} lead={t.lead} />
      <QueryView query={taskTypesQuery} skeletonRows={5}>
        {(types) => {
          const active = types.filter((x) => !x.archivedAt)
          const archived = types.filter((x) => x.archivedAt)
          const customCount = active.filter((x) => !x.isSystem).length
          const limited = !hasProAccess(user)
          const atLimit = limited && customCount >= FREE_LIMITS.customWorkTypes

          return (
            <div className="space-y-6">
              <SettingsCard
                title={t.title}
                lead={
                  limited
                    ? fmt(t.freeUsage, {
                        used: customCount,
                        limit: FREE_LIMITS.customWorkTypes,
                      })
                    : undefined
                }
                actions={
                  <Button
                    onClick={() => setEditing('new')}
                    disabled={atLimit}
                    aria-describedby={atLimit ? 'type-limit' : undefined}
                  >
                    <Plus aria-hidden className="size-4" />
                    {t.add}
                  </Button>
                }
              >
                {atLimit && (
                  <p
                    id="type-limit"
                    className="mb-4 rounded-lg bg-muted px-3.5 py-2.5 text-sm"
                  >
                    <Link
                      to="/app/settings/plan"
                      className="font-medium underline underline-offset-4"
                    >
                      {t.upgrade}
                    </Link>
                  </p>
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
                            {type.isSystem ? t.builtIn : t.custom}
                          </Badge>
                          {!type.countsAsFocusWork && (
                            <Badge tone="muted">{t.notFocus}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-ink-soft">
                          {t.summary.link[type.linkRequirement]},{' '}
                          {t.summary.time[type.defaultTimeInput]},{' '}
                          {type.storyPointsRequirement === 'hidden'
                            ? t.summary.spHidden
                            : fmt(t.summary.sp[type.storyPointsRequirement], {
                                sp:
                                  type.defaultStoryPoints === null
                                    ? t.summary.spNoDefault
                                    : format.sp(type.defaultStoryPoints),
                              })}
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
                            disabled={archive.isPending}
                            onClick={() =>
                              archive.mutate({
                                id: type.id,
                                archived: true,
                                name: type.name,
                              })
                            }
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
                      {fmt(t.archivedTitle, { count: archived.length })}
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
                            disabled={archive.isPending || atLimit}
                            onClick={() =>
                              archive.mutate({
                                id: type.id,
                                archived: false,
                                name: type.name,
                              })
                            }
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

const blankType = (titleLabel: string): TaskTypeInput => ({
  name: '',
  color: '#8B5CF6',
  titleLabel,
  linkRequirement: 'optional',
  linkLabel: 'Link',
  descriptionRequirement: 'optional',
  storyPointsRequirement: 'optional',
  defaultStoryPoints: null,
  defaultTimeInput: 'duration',
  countsAsFocusWork: true,
})

function WorkTypeDialog({
  type,
  onClose,
}: {
  type: TaskType | null
  onClose: () => void
}) {
  const t = useMessages(settingsMessages).workTypes
  const app = useMessages(appMessages)
  const format = useFormat()
  const palette = usePalette()
  const scale = useQuery(scaleQuery).data ?? []
  const [draft, setDraft] = useState<TaskTypeInput>(() =>
    type ? { ...type } : blankType(t.previewTitle),
  )
  const [submitted, setSubmitted] = useState(false)

  const save = useDataMutation(
    (input: TaskTypeInput) =>
      type
        ? data.taskTypes.update(type.id, input)
        : data.taskTypes.create(input),
    {
      invalidate: [keys.taskTypes],
      success: type ? app.status.saved : t.created,
      onSuccess: () => {
        markSetupStep('workTypes')
        onClose()
      },
    },
  )

  const errors = {
    name:
      draft.name.trim() && draft.name.length <= LIMITS.taskTypeName
        ? mutationFieldError(save.error, 'name')
        : t.nameError,
    titleLabel:
      draft.titleLabel.trim() && draft.titleLabel.length <= LIMITS.linkLabel
        ? null
        : t.labelError,
    linkLabel:
      draft.linkRequirement === 'hidden' ||
      (draft.linkLabel.trim() && draft.linkLabel.length <= LIMITS.linkLabel)
        ? null
        : t.labelError,
  }
  const invalid =
    !draft.name.trim() ||
    draft.name.length > LIMITS.taskTypeName ||
    errors.titleLabel !== null ||
    errors.linkLabel !== null
  const show = (e: string | null) => (submitted ? e : null)
  const requirementOptions = (['hidden', 'optional', 'required'] as const).map(
    (value) => ({ value, label: t.requirement[value] }),
  )
  const spOptions =
    draft.defaultStoryPoints === null ||
    scale.some((s) => s.points === draft.defaultStoryPoints)
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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
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
            ? fmt(t.dialog.editTitle, { name: type.name })
            : t.dialog.addTitle
        }
        description={t.dialog.description}
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
                  : t.add}
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
            <Field label={t.fields.name} error={show(errors.name)}>
              {(a) => (
                <Input
                  {...a}
                  autoFocus
                  maxLength={LIMITS.taskTypeName}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              )}
            </Field>
            <ColorPicker
              legend={t.fields.color}
              value={draft.color}
              onChange={(color) => setDraft({ ...draft, color })}
              swatches={withCurrent(palette, draft.color)}
            />
            <Field
              label={t.fields.titleLabel}
              hint={t.fields.titleLabelHint}
              error={show(errors.titleLabel)}
            >
              {(a) => (
                <Input
                  {...a}
                  maxLength={LIMITS.linkLabel}
                  value={draft.titleLabel}
                  onChange={(e) =>
                    setDraft({ ...draft, titleLabel: e.target.value })
                  }
                />
              )}
            </Field>
            <Segmented<FieldRequirement>
              label={t.fields.link}
              value={draft.linkRequirement}
              onChange={(linkRequirement) =>
                setDraft({ ...draft, linkRequirement })
              }
              options={requirementOptions}
              size="sm"
            />
            {draft.linkRequirement !== 'hidden' && (
              <Field
                label={t.fields.linkLabel}
                hint={t.fields.linkLabelHint}
                error={show(errors.linkLabel)}
              >
                {(a) => (
                  <Input
                    {...a}
                    maxLength={LIMITS.linkLabel}
                    value={draft.linkLabel}
                    onChange={(e) =>
                      setDraft({ ...draft, linkLabel: e.target.value })
                    }
                  />
                )}
              </Field>
            )}
            <Segmented<FieldRequirement>
              label={t.fields.description}
              value={draft.descriptionRequirement}
              onChange={(descriptionRequirement) =>
                setDraft({ ...draft, descriptionRequirement })
              }
              options={requirementOptions}
              size="sm"
            />
            <Segmented<TimeInputMode>
              label={t.fields.timeInput}
              value={draft.defaultTimeInput}
              onChange={(defaultTimeInput) =>
                setDraft({ ...draft, defaultTimeInput })
              }
              options={(['range', 'duration'] as const).map((value) => ({
                value,
                label: t.timeInput[value],
              }))}
              size="sm"
            />
            <div>
              <Segmented<FieldRequirement>
                label={t.fields.sp}
                value={draft.storyPointsRequirement}
                onChange={setSpRequirement}
                options={(['hidden', 'optional', 'required'] as const).map(
                  (value) => ({ value, label: t.spRequirement[value] }),
                )}
                size="sm"
              />
              <p className="mt-1.5 text-sm text-ink-soft">
                {t.spRequirementHint[draft.storyPointsRequirement]}
              </p>
            </div>
            {draft.storyPointsRequirement !== 'hidden' && (
              <Field label={t.fields.defaultSp} hint={t.fields.defaultSpHint}>
                {(a) => (
                  <Select
                    {...a}
                    value={draft.defaultStoryPoints ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        defaultStoryPoints:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  >
                    {draft.storyPointsRequirement === 'optional' && (
                      <option value="">{t.noSpOption}</option>
                    )}
                    {spOptions.map((s) => (
                      <option key={s.points} value={s.points}>
                        {format.sp(s.points)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Switch
              label={t.fields.focus}
              description={t.fields.focusHint}
              checked={draft.countsAsFocusWork}
              onCheckedChange={(countsAsFocusWork) =>
                setDraft({ ...draft, countsAsFocusWork })
              }
            />
          </form>

          <EntryPreview draft={draft} scale={scale.map((s) => s.points)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Podgląd formularza wpisu na żywo — widać od razu, co zobaczy użytkownik przy logowaniu czasu. */
function EntryPreview({
  draft,
  scale,
}: {
  draft: TaskTypeInput
  scale: Array<number>
}) {
  const t = useMessages(settingsMessages).workTypes
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
      aria-label={t.preview}
      className="self-start rounded-xl border border-line bg-paper p-4 md:sticky md:top-0"
    >
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ColorDot color={draft.color} />
        {draft.name || t.preview}
      </p>
      <div className="space-y-3" aria-hidden>
        <div>
          {label(draft.titleLabel || t.previewTitle, 'required')}
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
              {label(t.previewStart, 'required')}
              {box}
            </div>
            <div>
              {label(t.previewEnd, 'required')}
              {box}
            </div>
          </div>
        ) : (
          <div>
            {label(t.previewDuration, 'required')}
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
                  {t.noSpOption}
                </span>
              )}
              {scale.map((p) => (
                <span
                  key={p}
                  className={cn(
                    'rounded border px-1.5 py-0.5 text-xs',
                    p === draft.defaultStoryPoints
                      ? 'border-[var(--selected)] bg-[var(--selected)] text-[var(--on-selected)]'
                      : 'border-line text-ink-soft',
                  )}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
        {draft.descriptionRequirement !== 'hidden' && (
          <div>
            {label(t.previewDescription, draft.descriptionRequirement)}
            <div className="h-14 rounded-md border border-input bg-surface" />
          </div>
        )}
        <div className="flex justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--selected)] px-2.5 py-1.5 text-xs font-medium text-[var(--on-selected)]">
            <Check className="size-3" />
            {t.previewSave}
          </span>
        </div>
      </div>
    </aside>
  )
}
