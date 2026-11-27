import type {
  Project,
  QuickTemplate,
  TaskType,
  TimeEntryInput,
  TimerStartInput,
} from '#/data/types'
import { minutesBetween } from './entries'
import { spForType } from './report'
import type { ScheduledMeeting } from './schedule'

/** Co użytkownik dopowiada w oknie przed zapisem szablonu. */
export type TemplateChoice = {
  projectId: string | null
  link: string | null
  note: string | null
  /** Czas wpisu podany w oknie (dzień z przeszłości, a szablon nie ma czasu). */
  minutes: number | null
}

/** Czego brakuje, żeby szablon zapisał wpis jednym kliknięciem. */
export function templateNeeds(
  template: QuickTemplate,
  type: TaskType | undefined,
  projects: ReadonlyArray<Project>,
  isToday: boolean,
) {
  return {
    project: template.askProject && projects.length > 0,
    // Szablon bez czasu włącza timer, a timer działa tylko dziś: wcześniej trzeba podać czas.
    duration: !isToday && template.defaultDurationMinutes === null,
    link: type?.linkRequirement === 'required',
    note: type?.descriptionRequirement === 'required',
  }
}

/** Czy szablon trzeba najpierw uzupełnić w oknie (spotkanie z harmonogramu ma już godziny). */
export function templateNeedsDialog(
  needs: ReturnType<typeof templateNeeds>,
  scheduled: boolean,
) {
  return (
    needs.project || needs.link || needs.note || (needs.duration && !scheduled)
  )
}

/** Wybór bez okna: projekt z szablonu, reszta pusta. */
export const defaultChoice = (template: QuickTemplate): TemplateChoice => ({
  projectId: template.projectId,
  link: null,
  note: null,
  minutes: null,
})

/** Jak zapisać szablon: gotowy wpis albo start timera (szablon bez czasu, dziś). */
export type TemplatePlan =
  | { kind: 'entry'; input: TimeEntryInput }
  | { kind: 'timer'; input: TimerStartInput }

/**
 * Wpis z szablonu. Spotkanie z harmonogramu (`at`) dostaje godziny od–do; szablon
 * z czasem to wpis z czasem trwania; bez czasu startuje timer od `now`.
 */
export function templatePlan(
  template: QuickTemplate,
  type: TaskType | undefined,
  choice: TemplateChoice,
  options: { workDate: string; now: string; at?: ScheduledMeeting },
): TemplatePlan {
  const base = {
    taskTypeId: template.taskTypeId,
    projectId: choice.projectId,
    title: template.title,
    link: choice.link,
    storyPoints: spForType(type, template.storyPoints),
    workDate: options.workDate,
    note: choice.note,
  }
  const finished = {
    overtimeMinutes: null,
    overtimeNote: null,
    estimateMinutes: null,
    extensionMinutes: null,
    extensionNote: null,
    running: false,
  }
  const duration = template.defaultDurationMinutes ?? choice.minutes
  const { at } = options
  if (at) {
    return {
      kind: 'entry',
      input: {
        ...base,
        ...finished,
        startTime: at.start,
        endTime: at.end,
        durationMinutes: minutesBetween(at.start, at.end) ?? duration ?? 0,
      },
    }
  }
  if (duration === null)
    return { kind: 'timer', input: { ...base, startTime: options.now } }
  return {
    kind: 'entry',
    input: {
      ...base,
      ...finished,
      startTime: null,
      endTime: null,
      durationMinutes: duration,
    },
  }
}
