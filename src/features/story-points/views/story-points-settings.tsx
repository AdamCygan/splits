import { useSaveScale } from '../controllers/use-save-scale'
import { scaleQuery } from '../data/queries'
import { parseRow, toRows } from '../domain/scale-rows'
import type { Row } from '../domain/scale-rows'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  QueryView,
  SaveBar,
  SectionHeader,
  SettingsCard,
  useAnnouncer,
} from '#/features/settings/views/ui'
import type { SpScaleStep } from '#/features/story-points/data/dto'
import {
  SCALE_LIMITS,
  scalePresets,
  validateScale,
} from '#/features/story-points/domain/sp-scale'
import type { ScaleIssue } from '#/features/story-points/domain/sp-scale'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { settingsMessages } from '#/i18n/messages/settings'
import { cn } from '#/lib/utils'
import { useUnsavedWarning } from '#/shared/controllers/use-unsaved-warning'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

export function StoryPointSettings() {
  const messages = useMessages(settingsMessages)
  return (
    <div>
      <SectionHeader
        title={messages.storyPoints.title}
        lead={messages.storyPoints.lead}
      />
      <QueryView query={scaleQuery} skeletonRows={7}>
        {(scale) => <ScaleEditor scale={scale} />}
      </QueryView>
    </div>
  )
}

interface ScaleEditorProps {
  scale: Array<SpScaleStep>
}

function ScaleEditor({ scale }: ScaleEditorProps) {
  const messages = useMessages(settingsMessages).storyPoints
  const format = useFormat()
  const [rows, setRows] = useState(() => toRows(scale))
  const [submitted, setSubmitted] = useState(false)
  const [announcer, announce] = useAnnouncer()
  useEffect(() => setRows(toRows(scale)), [scale])

  const save = useSaveScale()

  const parsed = rows.map(parseRow)
  const issues = validateScale(parsed)
  const issuesAt = (index: number) =>
    issues.filter(
      (issue): issue is Extract<ScaleIssue, { index: number }> =>
        'index' in issue && issue.index === index,
    )
  const globalIssue = issues.find((issue) => !('index' in issue))
  const dirty =
    JSON.stringify(parsed) !==
    JSON.stringify(
      scale.map(({ points, maxMinutes }) => ({ points, maxMinutes })),
    )
  useUnsavedWarning(dirty)

  // Przedziały liczone po posortowaniu (tak jak w raportach).
  const sortedLimits = [...parsed].sort(
    (left, right) => left.points - right.points,
  )
  const rangeLabel = (points: number, maxMinutes: number) => {
    const index = sortedLimits.findIndex(
      (sortedLimit) => sortedLimit.points === points,
    )
    const min = index > 0 ? sortedLimits[index - 1]!.maxMinutes : 0
    return index <= 0
      ? fmt(messages.rangeFirst, { max: format.minutes(maxMinutes) })
      : fmt(messages.range, {
          min: format.minutes(min),
          max: format.minutes(maxMinutes),
        })
  }

  const update = (key: number, patch: Partial<Row>) =>
    setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const onSubmit = (formEvent: FormEvent) => {
    formEvent.preventDefault()
    setSubmitted(true)
    if (issues.length === 0)
      save.mutate([...parsed].sort((left, right) => left.points - right.points))
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      {announcer}
      <SettingsCard title={messages.presets}>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(scalePresets) as Array<keyof typeof scalePresets>).map(
            (name) => (
              <Button
                key={name}
                type="button"
                variant="outline"
                onClick={() => {
                  setRows(toRows(scalePresets[name]))
                  announce(messages.presetApplied)
                }}
              >
                {messages.presetNames[name]}
                <span className="text-ink-soft">
                  {scalePresets[name]
                    .map((scaleStepDraft) => scaleStepDraft.points)
                    .join(' · ')}
                </span>
              </Button>
            ),
          )}
        </div>
      </SettingsCard>

      <SettingsCard title={messages.title}>
        {submitted && globalIssue && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {messages.issues[globalIssue.code]}
          </p>
        )}
        <div
          aria-hidden
          className="hidden grid-cols-[7rem_minmax(0,15rem)_minmax(0,1fr)_2.75rem] gap-x-3 pb-2 text-sm font-medium text-ink-soft sm:grid"
        >
          <span>{messages.columns.points}</span>
          <span>{messages.columns.limit}</span>
          <span>{messages.columns.range}</span>
        </div>
        {/* Lista zamiast tabeli: na telefonie wiersz zawija się w dwie linie bez poziomego przewijania. */}
        <ol className="divide-y divide-line border-t border-line">
          {rows.map((row, index) => {
            const rowIssues = submitted ? issuesAt(index) : []
            const errorId = `scale-row-${row.key}-error`
            const parsedStep = parsed[index]!
            const pointsInvalid = rowIssues.some(
              (rowIssue) =>
                rowIssue.code === 'points_range' ||
                rowIssue.code === 'duplicate_points',
            )
            const timeInvalid = rowIssues.some(
              (rowIssue) =>
                rowIssue.code === 'minutes_range' ||
                rowIssue.code === 'not_increasing',
            )
            const describedBy = rowIssues.length ? errorId : undefined
            return (
              <li
                key={row.key}
                className="grid grid-cols-[5rem_minmax(0,1fr)_2.75rem] items-start gap-x-3 gap-y-1.5 py-3 sm:grid-cols-[7rem_minmax(0,15rem)_minmax(0,1fr)_2.75rem]"
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={SCALE_LIMITS.minPoints}
                  max={SCALE_LIMITS.maxPoints}
                  step={0.5}
                  className={cn(
                    'w-full',
                    pointsInvalid && 'border-destructive',
                  )}
                  aria-label={fmt(messages.pointsLabel, { n: index + 1 })}
                  aria-invalid={pointsInvalid || undefined}
                  aria-describedby={describedBy}
                  value={row.points}
                  onChange={(event) =>
                    update(row.key, { points: event.target.value })
                  }
                />
                <div className="flex min-w-0 items-center gap-1.5">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className={cn(
                      'w-16 px-2.5',
                      timeInvalid && 'border-destructive',
                    )}
                    aria-label={fmt(messages.hoursLabel, { n: index + 1 })}
                    aria-invalid={timeInvalid || undefined}
                    aria-describedby={describedBy}
                    value={row.hours}
                    onChange={(event) =>
                      update(row.key, { hours: event.target.value })
                    }
                  />
                  <span aria-hidden className="text-sm text-ink-soft">
                    h
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    step={5}
                    className={cn(
                      'w-16 px-2.5',
                      timeInvalid && 'border-destructive',
                    )}
                    aria-label={fmt(messages.minutesLabel, { n: index + 1 })}
                    aria-invalid={timeInvalid || undefined}
                    aria-describedby={describedBy}
                    value={row.minutes}
                    onChange={(event) =>
                      update(row.key, { minutes: event.target.value })
                    }
                  />
                  <span aria-hidden className="text-sm text-ink-soft">
                    min
                  </span>
                </div>
                <p className="col-start-2 row-start-2 text-sm text-ink-soft sm:col-start-3 sm:row-start-1 sm:self-center">
                  {Number.isFinite(parsedStep.points) &&
                  parsedStep.maxMinutes > 0
                    ? rangeLabel(parsedStep.points, parsedStep.maxMinutes)
                    : '—'}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="col-start-3 row-start-1 size-11 sm:col-start-4"
                  disabled={rows.length === 1}
                  aria-label={fmt(messages.remove, { sp: `${row.points} SP` })}
                  onClick={() =>
                    setRows(rows.filter((otherRow) => otherRow.key !== row.key))
                  }
                >
                  <X aria-hidden className="size-4" />
                </Button>
                {rowIssues.length > 0 && (
                  <ul
                    id={errorId}
                    className="col-span-full space-y-0.5 text-sm text-destructive"
                  >
                    {[
                      ...new Set(rowIssues.map((rowIssue) => rowIssue.code)),
                    ].map((code) => (
                      <li key={code}>{messages.issues[code]}</li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          disabled={rows.length >= SCALE_LIMITS.maxSteps}
          onClick={() => {
            const last = parsed.reduce(
              (largest, step) =>
                step.maxMinutes > largest.maxMinutes ? step : largest,
              { points: 0, maxMinutes: 0 },
            )
            setRows([
              ...rows,
              ...toRows([
                {
                  points: Math.max(1, Math.ceil(last.points * 1.6)),
                  maxMinutes: Math.max(60, last.maxMinutes * 2),
                },
              ]),
            ])
          }}
        >
          <Plus aria-hidden className="size-4" />
          {messages.addRow}
        </Button>
      </SettingsCard>

      <SettingsCard title={messages.preview}>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-px overflow-hidden rounded-xl border border-line bg-line">
          {sortedLimits.map((sortedLimit, index) => (
            <li
              key={`${sortedLimit.points}-${index}`}
              className="bg-surface px-3 py-3"
            >
              <p className="type-heading text-2xl">
                {Number.isFinite(sortedLimit.points)
                  ? format.number(sortedLimit.points)
                  : '—'}
              </p>
              <p className="text-sm text-ink-soft">
                {Number.isFinite(sortedLimit.points) &&
                sortedLimit.maxMinutes > 0
                  ? rangeLabel(sortedLimit.points, sortedLimit.maxMinutes)
                  : '—'}
              </p>
            </li>
          ))}
        </ol>
      </SettingsCard>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        onDiscard={() => {
          setRows(toRows(scale))
          setSubmitted(false)
        }}
      />
    </form>
  )
}
