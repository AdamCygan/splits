import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { Button } from '#/components/ui/button'
import { Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import type { SprintTimeGoal } from '#/data/types'
import { parseDuration } from '#/domain/entries'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { settingsMessages } from '#/i18n/messages/settings'
import { taskTypesQuery } from '../queries'

/** Wiersz formularza: rodzaj pracy i czas wpisany po ludzku („6h”, „1h 30m”, „90”). */
export type GoalDraft = { key: string; taskTypeId: string; time: string }

export const goalDrafts = (
  goals: ReadonlyArray<SprintTimeGoal>,
  minutesLabel: (m: number) => string,
): Array<GoalDraft> =>
  goals.map((g) => ({
    key: crypto.randomUUID(),
    taskTypeId: g.taskTypeId,
    time: minutesLabel(g.minutes),
  }))

/** Cele do zapisu albo null, gdy któryś wiersz jest niepoprawny. */
export function goalsFromDrafts(
  rows: ReadonlyArray<GoalDraft>,
): Array<SprintTimeGoal> | null {
  const goals = rows.map((r) => ({
    taskTypeId: r.taskTypeId,
    minutes: parseDuration(r.time) ?? 0,
  }))
  return goals.every((g) => g.taskTypeId && g.minutes > 0) ? goals : null
}

/**
 * Cele czasowe sprintu: ile czasu chcesz poświęcić na dany rodzaj pracy
 * (np. Code Review 6h, spotkania najwyżej 8h). Każdy rodzaj pracy raz.
 */
export function TimeGoalsField({
  rows,
  onChange,
  showErrors,
}: {
  rows: Array<GoalDraft>
  onChange: (rows: Array<GoalDraft>) => void
  showErrors: boolean
}) {
  const t = useMessages(settingsMessages).sprints.timeGoals
  const format = useFormat()
  const types = useQuery(taskTypesQuery).data ?? []
  const id = useId()
  const free = types.filter((x) => !rows.some((r) => r.taskTypeId === x.id))
  const update = (key: string, patch: Partial<GoalDraft>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{t.legend}</legend>
      <p id={`${id}-hint`} className="text-sm text-ink-soft">
        {t.hint}
      </p>
      {rows.length > 0 && (
        <ul className="space-y-2.5">
          {rows.map((row, i) => {
            const type = types.find((x) => x.id === row.taskTypeId)
            const minutes = parseDuration(row.time)
            const timeError = showErrors && !minutes ? t.timeError : null
            const typeError = showErrors && !row.taskTypeId ? t.typeError : null
            const name = type?.name ?? fmt(t.row, { n: i + 1 })
            return (
              <li key={row.key} className="flex flex-wrap items-start gap-2">
                <div className="min-w-40 flex-1">
                  <Select
                    aria-label={fmt(t.typeLabel, { n: i + 1 })}
                    aria-invalid={typeError ? true : undefined}
                    value={row.taskTypeId}
                    onChange={(e) =>
                      update(row.key, { taskTypeId: e.target.value })
                    }
                  >
                    <option value="">{t.pickType}</option>
                    {types
                      .filter(
                        (x) =>
                          x.id === row.taskTypeId ||
                          free.some((f) => f.id === x.id),
                      )
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </Select>
                  {typeError && (
                    <p className="mt-1 text-sm text-destructive">{typeError}</p>
                  )}
                </div>
                <div className="w-32">
                  <Input
                    aria-label={fmt(t.timeLabel, { name })}
                    aria-invalid={timeError ? true : undefined}
                    aria-describedby={`${id}-hint`}
                    inputMode="text"
                    placeholder="6h"
                    value={row.time}
                    onChange={(e) => update(row.key, { time: e.target.value })}
                    onBlur={() =>
                      minutes &&
                      update(row.key, { time: format.minutes(minutes) })
                    }
                  />
                  {timeError && (
                    <p className="mt-1 text-sm text-destructive">{timeError}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={fmt(t.remove, { name })}
                  onClick={() =>
                    onChange(rows.filter((r) => r.key !== row.key))
                  }
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {free.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...rows,
              { key: crypto.randomUUID(), taskTypeId: free[0]!.id, time: '' },
            ])
          }
        >
          <Plus aria-hidden className="size-4" />
          {t.add}
        </Button>
      )}
    </fieldset>
  )
}
