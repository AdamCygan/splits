import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '#/components/ui/button'
import { NoteEditor } from '#/components/note/note-editor'
import { Field, Select } from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import type { Project } from '#/features/projects/data/dto'
import type { QuickTemplate } from '#/features/templates/data/dto'
import type { TaskType } from '#/features/task-types/data/dto'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { isUrl, parseDuration } from '#/features/time-entries/domain/entries'
import { templateNeeds } from '#/features/templates/domain/templates'
import type { TemplateChoice } from '#/features/templates/domain/templates'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'

export type { TemplateChoice } from '#/features/templates/domain/templates'

export interface UseTemplateDialogProps {
  template: QuickTemplate
  type: TaskType | undefined
  projects: Array<Project>
  isToday: boolean
  pending: boolean
  onSubmit: (choice: TemplateChoice) => void
  onClose: () => void
}

/**
 * Okno przed zapisem wpisu z szablonu. Sam wybór projektu: lista przycisków (klik zapisuje).
 * Gdy typ pracy wymaga linku albo notatki (np. code review i link do MR) albo trzeba podać czas
 * (dzień z przeszłości, a szablon zwykle włącza timer): krótki formularz.
 */
export function UseTemplateDialog({
  template,
  type,
  projects,
  isToday,
  pending,
  onSubmit,
  onClose,
}: UseTemplateDialogProps) {
  const messages = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const needs = templateNeeds(template, type, projects, isToday)
  const onlyProject =
    needs.project && !needs.link && !needs.note && !needs.duration
  const onlyDuration =
    needs.duration && !needs.project && !needs.link && !needs.note
  const first = needs.project
    ? 'project'
    : needs.duration
      ? 'duration'
      : needs.link
        ? 'link'
        : 'note'
  const [projectId, setProjectId] = useState(
    needs.project ? (projects[0]?.id ?? '') : (template.projectId ?? ''),
  )
  const [link, setLink] = useState('')
  const [note, setNote] = useState('')
  const [duration, setDuration] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const linkError = !needs.link
    ? null
    : !link.trim()
      ? messages.issues.link.required
      : !isUrl(link)
        ? messages.issues.link.invalid_url
        : link.length > 2048
          ? messages.issues.link.too_long
          : null
  const noteError = !needs.note
    ? null
    : !note.trim()
      ? messages.issues.note.required
      : note.length > 2000
        ? messages.issues.note.too_long
        : null

  const minutes = needs.duration ? parseDuration(duration) : null
  const durationError =
    needs.duration && (minutes === null || minutes < 1 || minutes > 24 * 60)
      ? messages.issues.time.duration_range
      : null

  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    setSubmitted(true)
    const hasErrors = linkError || noteError || durationError
    if (hasErrors) return
    onSubmit({
      projectId: projectId || null,
      link: needs.link ? link.trim() : null,
      note: needs.note ? note.trim() : null,
      minutes,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="sm"
        title={fmt(
          onlyProject
            ? messages.templates.pickTitle
            : onlyDuration
              ? messages.templates.pastTitle
              : messages.templates.detailsTitle,
          { name: template.label },
        )}
        description={
          onlyProject
            ? messages.templates.pickText
            : onlyDuration
              ? messages.templates.pastText
              : messages.templates.detailsText
        }
        closeLabel={app.actions.close}
        onOpenAutoFocus={(event) => {
          // Fokus od razu na pierwszym wyborze: Enter zapisuje albo przechodzi dalej.
          event.preventDefault()
          ;(event.currentTarget as HTMLElement)
            .querySelector<HTMLElement>('[data-first]')
            ?.focus()
        }}
        footer={
          onlyProject ? undefined : (
            <>
              <Button variant="outline" onClick={onClose}>
                {app.actions.cancel}
              </Button>
              <Button
                type="submit"
                form="use-template-form"
                disabled={pending}
                aria-busy={pending}
              >
                {pending
                  ? messages.form.saving
                  : template.defaultDurationMinutes === null && isToday
                    ? messages.form.startTimer
                    : messages.form.save}
              </Button>
            </>
          )
        }
      >
        {onlyProject ? (
          <ul className="grid gap-2" aria-busy={pending}>
            {[...projects, null].map((project, index) => (
              <li key={project?.id ?? 'none'}>
                <button
                  type="button"
                  data-first={index === 0 ? '' : undefined}
                  disabled={pending}
                  onClick={() =>
                    onSubmit({
                      projectId: project?.id ?? null,
                      link: null,
                      note: null,
                      minutes: null,
                    })
                  }
                  className="flex h-11 w-full items-center gap-3 rounded-lg border border-line bg-surface px-3.5 text-left text-sm font-medium hover:border-ink/40 disabled:opacity-60"
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      background: project?.color ?? 'transparent',
                      boxShadow: project
                        ? undefined
                        : 'inset 0 0 0 1.5px currentColor',
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {project?.name ?? messages.form.noProject}
                  </span>
                  {project?.key && (
                    <span className="text-xs text-ink-soft">{project.key}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <form
            id="use-template-form"
            noValidate
            onSubmit={submit}
            className="space-y-5"
          >
            {needs.project && (
              <Field label={messages.form.project}>
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    data-first=""
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                    <option value="">{messages.form.noProject}</option>
                  </Select>
                )}
              </Field>
            )}
            {needs.duration && (
              <Field
                label={messages.templates.duration}
                hint={messages.templates.durationHint}
                error={submitted ? durationError : null}
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    data-first={first === 'duration' ? '' : undefined}
                    inputMode="text"
                    autoComplete="off"
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                  />
                )}
              </Field>
            )}
            {needs.link && (
              <Field
                label={type?.linkLabel || messages.form.link}
                error={submitted ? linkError : null}
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    data-first={first === 'link' ? '' : undefined}
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    spellCheck={false}
                    value={link}
                    onChange={(event) => setLink(event.target.value)}
                  />
                )}
              </Field>
            )}
            {needs.note && (
              <Field
                label={messages.form.notes}
                error={submitted ? noteError : null}
              >
                {(fieldProps) => (
                  <NoteEditor
                    {...fieldProps}
                    data-first={first === 'note' ? '' : undefined}
                    rows={3}
                    value={note}
                    onValueChange={setNote}
                  />
                )}
              </Field>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
