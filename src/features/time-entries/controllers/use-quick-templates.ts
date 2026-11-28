import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { entriesApi } from '../data/api'
import type { QuickTemplate } from '#/features/templates/data/dto'
import { nowTimeIn } from '#/shared/domain/dates'
import type { ScheduledMeeting } from '#/features/templates/domain/schedule'
import {
  defaultChoice,
  templateNeeds,
  templateNeedsDialog,
  templatePlan,
} from '#/features/templates/domain/templates'
import type { TemplateChoice } from '#/features/templates/domain/templates'
import { projectsQuery } from '#/features/projects/data/queries'
import { settingsQuery } from '#/features/settings/data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { templatesQuery } from '#/features/templates/data/queries'
import { useDataMutation } from '#/shared/data/mutations'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { entryKeys } from '../data/queries'

interface Picking {
  template: QuickTemplate
  at?: ScheduledMeeting
}

export interface QuickTemplatesViewModelOptions {
  workDate: string
  isToday: boolean
  /** Szablon wybrany w palecie poleceń (id), użyty raz po wczytaniu szablonów. */
  requested?: string
  onRequestDone?: () => void
}

/**
 * ViewModel szybkich szablonów: klik, Alt+1…9 albo wybór z palety zapisuje wpis od razu
 * (szablon bez czasu startuje timer). Gdy brakuje projektu, linku albo notatki wymaganych
 * przez typ pracy, najpierw otwiera okno. Budowa wpisu: `templatePlan` w domain/templates.
 */
export function useQuickTemplatesViewModel({
  workDate,
  isToday,
  requested,
  onRequestDone,
}: QuickTemplatesViewModelOptions) {
  const messages = useMessages(entriesMessages)
  const format = useFormat()
  const templates = useQuery(templatesQuery).data ?? []
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = (useQuery(projectsQuery).data ?? []).filter(
    (project) => !project.archivedAt,
  )
  const timeZone = useQuery(settingsQuery).data?.timezone
  const [picking, setPicking] = useState<Picking | null>(null)
  const typeOf = (id: string) => types.find((type) => type.id === id)

  const apply = useDataMutation(
    async ({ template, at, ...choice }: TemplateChoice & Picking) => {
      const plan = templatePlan(template, typeOf(template.taskTypeId), choice, {
        workDate,
        now: nowTimeIn(timeZone),
        at,
      })
      if (plan.kind === 'entry') return entriesApi.create(plan.input)
      const result = await entriesApi.start(plan.input)
      return result.ok ? { ...result, value: result.value.started } : result
    },
    {
      invalidate: [entryKeys.all],
      success: (entry) =>
        entry.running
          ? `${messages.form.timerStarted}: ${entry.title}`
          : fmt(messages.templates.logged, {
              name: entry.title,
              time: format.minutes(entry.durationMinutes),
            }),
      onSuccess: () => setPicking(null),
    },
  )

  const use = (template: QuickTemplate, at?: ScheduledMeeting) => {
    const needs = templateNeeds(
      template,
      typeOf(template.taskTypeId),
      projects,
      isToday,
    )
    if (templateNeedsDialog(needs, Boolean(at))) setPicking({ template, at })
    else apply.mutate({ template, at, ...defaultChoice(template) })
  }

  // Wybór z palety: raz, gdy szablony i typy są już wczytane.
  useEffect(() => {
    if (!requested || templates.length === 0 || types.length === 0) return
    const template = templates.find(
      (quickTemplate) => quickTemplate.id === requested,
    )
    onRequestDone?.()
    if (template) use(template)
  }, [requested, templates.length, types.length])

  // Alt+1…9: szablon z tym skrótem.
  useEffect(() => {
    const onKey = (keyboardEvent: KeyboardEvent) => {
      if (
        !keyboardEvent.altKey ||
        keyboardEvent.ctrlKey ||
        keyboardEvent.metaKey ||
        !/^Digit[1-9]$/.test(keyboardEvent.code)
      )
        return
      const template = templates.find(
        (quickTemplate) =>
          quickTemplate.hotkey === Number(keyboardEvent.code.slice(5)),
      )
      if (!template) return
      keyboardEvent.preventDefault()
      use(template)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return {
    t: messages,
    format,
    templates,
    projects,
    typeOf,
    isToday,
    workDate,
    busy: apply.isPending,
    picking,
    use,
    logAll: (meetings: ReadonlyArray<ScheduledMeeting>) => {
      for (const scheduledMeeting of meetings)
        use(scheduledMeeting.template, scheduledMeeting)
    },
    submitPicked: (choice: TemplateChoice) =>
      picking && apply.mutate({ ...picking, ...choice }),
    closePicker: () => setPicking(null),
  }
}

export type QuickTemplatesViewModel = ReturnType<
  typeof useQuickTemplatesViewModel
>
