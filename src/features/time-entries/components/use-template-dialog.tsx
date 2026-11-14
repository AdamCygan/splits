import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '#/components/ui/button'
import { Field, Select, Textarea } from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import type { Project, QuickTemplate, TaskType } from '#/data/types'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { entriesMessages } from '#/i18n/messages/entries'

export type TemplateChoice = {
  projectId: string | null
  link: string | null
  note: string | null
}

const URL_RE = /^https?:\/\/\S+$/i

/** Czego brakuje, żeby szablon zapisał wpis jednym kliknięciem. */
export function templateNeeds(
  template: QuickTemplate,
  type: TaskType | undefined,
  projects: Array<Project>,
) {
  return {
    project: template.askProject && projects.length > 0,
    link: type?.linkRequirement === 'required',
    note: type?.descriptionRequirement === 'required',
  }
}

/**
 * Okno przed zapisem wpisu z szablonu. Sam wybór projektu: lista przycisków (klik zapisuje).
 * Gdy typ pracy wymaga linku albo notatki (np. code review i link do MR): krótki formularz.
 */
export function UseTemplateDialog({
  template,
  type,
  projects,
  pending,
  onSubmit,
  onClose,
}: {
  template: QuickTemplate
  type: TaskType | undefined
  projects: Array<Project>
  pending: boolean
  onSubmit: (choice: TemplateChoice) => void
  onClose: () => void
}) {
  const t = useMessages(entriesMessages)
  const app = useMessages(appMessages)
  const needs = templateNeeds(template, type, projects)
  const onlyProject = needs.project && !needs.link && !needs.note
  const [projectId, setProjectId] = useState(
    needs.project ? (projects[0]?.id ?? '') : (template.projectId ?? ''),
  )
  const [link, setLink] = useState('')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const linkError = !needs.link
    ? null
    : !link.trim()
      ? t.issues.link.required
      : !URL_RE.test(link.trim())
        ? t.issues.link.invalid_url
        : link.length > 2048
          ? t.issues.link.too_long
          : null
  const noteError = !needs.note
    ? null
    : !note.trim()
      ? t.issues.note.required
      : note.length > 2000
        ? t.issues.note.too_long
        : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (linkError || noteError) return
    onSubmit({
      projectId: projectId || null,
      link: needs.link ? link.trim() : null,
      note: needs.note ? note.trim() : null,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="sm"
        title={fmt(
          onlyProject ? t.templates.pickTitle : t.templates.detailsTitle,
          { name: template.label },
        )}
        description={
          onlyProject ? t.templates.pickText : t.templates.detailsText
        }
        closeLabel={app.actions.close}
        onOpenAutoFocus={(e) => {
          // Fokus od razu na pierwszym wyborze: Enter zapisuje albo przechodzi dalej.
          e.preventDefault()
          ;(e.currentTarget as HTMLElement)
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
                  ? t.form.saving
                  : template.defaultDurationMinutes === null
                    ? t.form.startTimer
                    : t.form.save}
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
                    {project?.name ?? t.form.noProject}
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
              <Field label={t.form.project}>
                {(a) => (
                  <Select
                    {...a}
                    data-first=""
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value="">{t.form.noProject}</option>
                  </Select>
                )}
              </Field>
            )}
            {needs.link && (
              <Field
                label={type?.linkLabel || t.form.link}
                error={submitted ? linkError : null}
              >
                {(a) => (
                  <Input
                    {...a}
                    data-first={needs.project ? undefined : ''}
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    spellCheck={false}
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                  />
                )}
              </Field>
            )}
            {needs.note && (
              <Field label={t.form.notes} error={submitted ? noteError : null}>
                {(a) => (
                  <Textarea
                    {...a}
                    data-first={needs.project || needs.link ? undefined : ''}
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
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
