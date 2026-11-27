import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate, weekdayNames } from '#/i18n/format'
import { settingsMessages } from '#/i18n/messages/settings'
import { cadenceQuery } from '#/features/sprints/data/queries'
import { scaleQuery } from '#/features/story-points/data/queries'
import { settingsQuery } from '../data/queries'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { templatesQuery } from '#/features/templates/data/queries'
import { useSetupSteps } from '../controllers/setup-progress'
import type { SetupStep } from '../controllers/setup-progress'
import { SectionHeader } from './ui'

const stepRoutes: Record<SetupStep, string> = {
  workday: '/app/settings/workday',
  sprints: '/app/settings/sprints',
  storyPoints: '/app/settings/story-points',
  workTypes: '/app/settings/work-types',
  templates: '/app/settings/templates',
}

/** Przegląd: lista kroków na start z podsumowaniem tego, co już ustawione. */
export function SettingsOverview() {
  const t = useMessages(settingsMessages)
  const { locale } = useI18n()
  const format = useFormat()
  const marked = useSetupSteps()
  const settings = useQuery(settingsQuery).data
  const cadence = useQuery(cadenceQuery).data
  const scale = useQuery(scaleQuery).data
  const types = useQuery(taskTypesQuery).data
  const templates = useQuery(templatesQuery).data

  const dayNames = weekdayNames(locale, 'short')
  const lengthLabel = (days: number) =>
    days in t.sprints.lengths
      ? t.sprints.lengths[days as 7 | 14 | 21 | 28]
      : format.plural(t.counts.days, days)

  const steps: Array<{ id: SetupStep; done: boolean; summary: string | null }> =
    [
      {
        id: 'workday',
        done: marked.includes('workday'),
        summary: settings
          ? fmt(t.overview.steps.workday.done, {
              hours: format.minutes(settings.workdayTargetMinutes),
              days: settings.workingDays.map((d) => dayNames[d]).join(', '),
            })
          : null,
      },
      {
        id: 'sprints',
        done: marked.includes('sprints') || Boolean(cadence),
        summary: cadence
          ? fmt(t.overview.steps.sprints.done, {
              length: lengthLabel(cadence.lengthDays),
              date: formatDate(locale, cadence.anchorDate),
            })
          : null,
      },
      {
        id: 'storyPoints',
        done: marked.includes('storyPoints'),
        summary: scale
          ? format.plural(t.counts.scaleValues, scale.length)
          : null,
      },
      {
        id: 'workTypes',
        done: marked.includes('workTypes'),
        summary: types
          ? format.plural(
              t.counts.workTypes,
              types.filter((x) => !x.archivedAt).length,
            )
          : null,
      },
      {
        id: 'templates',
        done: marked.includes('templates') || (templates?.length ?? 0) > 0,
        summary: templates?.length
          ? format.plural(t.counts.templates, templates.length)
          : null,
      },
    ]
  const doneCount = steps.filter((s) => s.done).length

  return (
    <div>
      <SectionHeader title={t.overview.welcome} lead={t.overview.lead} />

      <div className="mb-6 max-w-md">
        <div className="mb-2 flex justify-between text-sm">
          <span id="setup-progress-label" className="font-medium">
            {t.overview.progressLabel}
          </span>
          <span className="text-ink-soft">
            {fmt(t.overview.progress, { done: doneCount, total: steps.length })}
          </span>
        </div>
        <div
          role="progressbar"
          aria-labelledby="setup-progress-label"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
          aria-valuetext={fmt(t.overview.progress, {
            done: doneCount,
            total: steps.length,
          })}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-wt-pair transition-[width] duration-500"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((step) => {
          const copy = t.overview.steps[step.id]
          return (
            <li key={step.id}>
              <Link
                to={stepRoutes[step.id]}
                className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink-soft sm:p-5"
              >
                {step.done ? (
                  <CheckCircle2
                    aria-hidden
                    className="size-6 shrink-0 text-wt-pair"
                  />
                ) : (
                  <Circle
                    aria-hidden
                    className="size-6 shrink-0 text-ink-soft"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {copy.title}
                    <span className="sr-only">
                      ,{' '}
                      {step.done ? t.overview.doneLabel : t.overview.todoLabel}
                    </span>
                  </span>
                  <span className="block text-sm text-ink-soft">
                    {step.done && step.summary ? step.summary : copy.text}
                  </span>
                </span>
                <span className="hidden text-sm font-medium text-ink-soft group-hover:text-ink sm:block">
                  {t.overview.open}
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-ink-soft"
                />
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
