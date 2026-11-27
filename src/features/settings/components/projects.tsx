import { useState } from 'react'
import type { FormEvent } from 'react'
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge, ColorDot, ColorPicker, Field } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { data } from '#/data'
import { splitArchived } from '#/domain/archive'
import type { Project, ProjectInput, Tag, TagInput } from '#/data/types'
import { LIMITS, PROJECT_KEY_RE } from '#/domain/rules'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import {
  keys,
  mutationFieldError,
  projectsQuery,
  tagsQuery,
  useDataMutation,
} from '../queries'
import { useArchive } from '../use-archive'
import { usePalette, withCurrent } from './palette'
import { QueryView, SectionHeader, SettingsCard } from './ui'
import { useQuery } from '@tanstack/react-query'
import { FREE_LIMITS } from '#/features/billing/plans'
import {
  PlanLimit,
  useFreePlan,
} from '#/features/billing/components/plan-limit'
import { billingMessages } from '#/i18n/messages/billing'

export function ProjectSettings() {
  const t = useMessages(settingsMessages)
  return (
    <div className="space-y-6">
      <SectionHeader title={t.sections.projects.title} lead={t.projects.lead} />
      <Projects />
      <Tags />
    </div>
  )
}

function Projects() {
  const t = useMessages(settingsMessages).projects
  const app = useMessages(appMessages)
  const limits = useMessages(billingMessages).limits
  const [editing, setEditing] = useState<Project | 'new' | null>(null)
  const isFree = useFreePlan()
  const activeCount = splitArchived(useQuery(projectsQuery).data ?? []).active
    .length
  const atLimit = isFree && activeCount >= FREE_LIMITS.projects
  const archive = useArchive(data.projects.setArchived, {
    invalidate: keys.projects,
    messages: t,
  })

  return (
    <SettingsCard
      title={t.title}
      actions={
        <Button
          onClick={() => setEditing('new')}
          disabled={atLimit}
          aria-describedby={atLimit ? 'project-limit' : undefined}
        >
          <Plus aria-hidden className="size-4" />
          {t.add}
        </Button>
      }
    >
      {atLimit && <PlanLimit id="project-limit">{limits.projects}</PlanLimit>}
      <QueryView query={projectsQuery}>
        {(projects) => {
          const { active, archived } = splitArchived(projects)
          return (
            <>
              {active.length === 0 ? (
                <p className="text-ink-soft">{t.empty}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {active.map((project) => (
                    <li
                      key={project.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                    >
                      <ColorDot color={project.color} className="size-4" />
                      <h3 className="min-w-0 flex-1 font-semibold">
                        {project.name}{' '}
                        {project.key && (
                          <Badge tone="muted">{project.key}</Badge>
                        )}
                      </h3>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(project)}
                        >
                          <Pencil aria-hidden className="size-4" />
                          {app.actions.edit}
                          <span className="sr-only">: {project.name}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => archive.archive(project)}
                        >
                          <Archive aria-hidden className="size-4" />
                          {app.actions.archive}
                          <span className="sr-only">: {project.name}</span>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {archived.length > 0 && (
                <details className="mt-4">
                  <summary className="w-fit cursor-pointer rounded-md text-sm font-medium">
                    {fmt(t.archivedTitle, { count: archived.length })}
                  </summary>
                  <ul className="mt-2 divide-y divide-line">
                    {archived.map((project) => (
                      <li
                        key={project.id}
                        className="flex items-center gap-3 py-2.5 text-ink-soft"
                      >
                        <ColorDot color={project.color} />
                        <span className="flex-1">{project.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => archive.restore(project)}
                        >
                          <ArchiveRestore aria-hidden className="size-4" />
                          {app.actions.restore}
                          <span className="sr-only">: {project.name}</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )
        }}
      </QueryView>
      {editing && (
        <ProjectDialog
          project={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </SettingsCard>
  )
}

interface ProjectDialogProps {
  project: Project | null
  onClose: () => void
}

function ProjectDialog({ project, onClose }: ProjectDialogProps) {
  const t = useMessages(settingsMessages).projects
  const app = useMessages(appMessages)
  const palette = usePalette()
  const [draft, setDraft] = useState({
    name: project?.name ?? '',
    key: project?.key ?? '',
    color: project?.color ?? '#2C8FD6',
  })
  const [submitted, setSubmitted] = useState(false)
  const save = useDataMutation(
    (input: ProjectInput) =>
      project
        ? data.projects.update(project.id, input)
        : data.projects.create(input),
    {
      invalidate: [keys.projects],
      success: project ? app.status.saved : t.created,
      onSuccess: onClose,
    },
  )
  const nameOk =
    draft.name.trim().length > 0 && draft.name.length <= LIMITS.projectName
  const keyOk = draft.key === '' || PROJECT_KEY_RE.test(draft.key)
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (nameOk && keyOk)
      save.mutate({
        name: draft.name.trim(),
        key: draft.key || null,
        color: draft.color,
      })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={
          project
            ? fmt(t.dialog.editTitle, { name: project.name })
            : t.dialog.addTitle
        }
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="project-form"
              disabled={save.isPending}
              aria-busy={save.isPending}
            >
              {save.isPending
                ? app.actions.saving
                : project
                  ? app.actions.save
                  : t.add}
            </Button>
          </>
        }
      >
        <form
          id="project-form"
          noValidate
          onSubmit={onSubmit}
          className="space-y-6"
        >
          <Field
            label={t.fields.name}
            error={
              submitted
                ? nameOk
                  ? mutationFieldError(save.error, 'name')
                  : t.nameError
                : null
            }
          >
            {(a) => (
              <Input
                {...a}
                autoFocus
                maxLength={LIMITS.projectName}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            )}
          </Field>
          <Field
            label={t.fields.key}
            hint={t.fields.keyHint}
            error={
              submitted
                ? keyOk
                  ? mutationFieldError(save.error, 'key')
                  : t.keyError
                : null
            }
          >
            {(a) => (
              <Input
                {...a}
                maxLength={10}
                autoCapitalize="characters"
                spellCheck={false}
                className="max-w-40 uppercase"
                value={draft.key}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                  })
                }
              />
            )}
          </Field>
          <ColorPicker
            legend={t.fields.color}
            value={draft.color}
            onChange={(color) => setDraft({ ...draft, color })}
            swatches={withCurrent(palette, draft.color)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Tags() {
  const t = useMessages(settingsMessages).projects
  const app = useMessages(appMessages)
  const palette = usePalette()
  const [draft, setDraft] = useState<TagInput>({
    name: '',
    color: palette[1]!.value,
  })
  const [submitted, setSubmitted] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [deleting, setDeleting] = useState<Tag | null>(null)

  const create = useDataMutation((input: TagInput) => data.tags.create(input), {
    invalidate: [keys.tags],
    success: t.tagCreated,
    onSuccess: () => {
      setDraft({ name: '', color: draft.color })
      setSubmitted(false)
    },
  })
  const remove = useDataMutation((id: string) => data.tags.remove(id), {
    invalidate: [keys.tags],
    success: t.tagDeleted,
    onSuccess: () => setDeleting(null),
  })
  const nameOk =
    draft.name.trim().length > 0 && draft.name.length <= LIMITS.tagName

  return (
    <SettingsCard title={t.tagsTitle} lead={t.tagsLead}>
      <QueryView query={tagsQuery}>
        {(tags) =>
          tags.length === 0 ? (
            <p className="text-ink-soft">{t.tagsEmpty}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pr-1 pl-3 text-sm"
                >
                  <ColorDot color={tag.color} className="size-2.5" />
                  <span className="ml-1 font-medium">{tag.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full"
                    aria-label={fmt(t.editTag, { name: tag.name })}
                    onClick={() => setEditing(tag)}
                  >
                    <Pencil aria-hidden className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full"
                    aria-label={fmt(t.deleteTag, { name: tag.name })}
                    onClick={() => setDeleting(tag)}
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )
        }
      </QueryView>

      <form
        noValidate
        className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(true)
          if (nameOk)
            create.mutate({ name: draft.name.trim(), color: draft.color })
        }}
      >
        <Field
          label={t.tagName}
          error={
            submitted
              ? nameOk
                ? mutationFieldError(create.error, 'name')
                : t.tagNameError
              : null
          }
        >
          {(a) => (
            <Input
              {...a}
              maxLength={LIMITS.tagName}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          )}
        </Field>
        <ColorPicker
          legend={t.tagColor}
          value={draft.color}
          onChange={(color) => setDraft({ ...draft, color })}
          swatches={palette}
        />
        <Button
          type="submit"
          disabled={create.isPending}
          aria-busy={create.isPending}
        >
          <Plus aria-hidden className="size-4" />
          {t.addTag}
        </Button>
      </form>

      {editing && <TagDialog tag={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={fmt(t.deleteTagTitle, { name: deleting?.name ?? '' })}
        description={t.deleteTagText}
        confirmLabel={app.actions.delete}
        cancelLabel={app.actions.cancel}
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </SettingsCard>
  )
}

interface TagDialogProps {
  tag: Tag
  onClose: () => void
}

function TagDialog({ tag, onClose }: TagDialogProps) {
  const t = useMessages(settingsMessages).projects
  const app = useMessages(appMessages)
  const palette = usePalette()
  const [draft, setDraft] = useState<TagInput>({
    name: tag.name,
    color: tag.color,
  })
  const [submitted, setSubmitted] = useState(false)
  const save = useDataMutation(
    (input: TagInput) => data.tags.update(tag.id, input),
    { invalidate: [keys.tags], success: app.status.saved, onSuccess: onClose },
  )
  const nameOk =
    draft.name.trim().length > 0 && draft.name.length <= LIMITS.tagName
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="sm"
        title={fmt(t.editTag, { name: tag.name })}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button type="submit" form="tag-form" disabled={save.isPending}>
              {save.isPending ? app.actions.saving : app.actions.save}
            </Button>
          </>
        }
      >
        <form
          id="tag-form"
          noValidate
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            setSubmitted(true)
            if (nameOk)
              save.mutate({ name: draft.name.trim(), color: draft.color })
          }}
        >
          <Field
            label={t.tagName}
            error={
              submitted
                ? nameOk
                  ? mutationFieldError(save.error, 'name')
                  : t.tagNameError
                : null
            }
          >
            {(a) => (
              <Input
                {...a}
                autoFocus
                maxLength={LIMITS.tagName}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            )}
          </Field>
          <ColorPicker
            legend={t.tagColor}
            value={draft.color}
            onChange={(color) => setDraft({ ...draft, color })}
            swatches={withCurrent(palette, draft.color)}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
