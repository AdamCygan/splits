import type { GoalDraft } from '../domain/time-goals'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { taskTypesQuery } from '#/features/task-types/data/queries'
import { parseDuration } from '#/features/time-entries/domain/entries'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { settingsMessages } from '#/i18n/messages/settings'
import { Plus, Trash2 } from 'lucide-react'
import { useId } from 'react'

export interface TimeGoalsFieldProps {
  rows: Array<GoalDraft>
  onChange: (rows: Array<GoalDraft>) => void
  showErrors: boolean
}

/**
 * Cele czasowe sprintu: ile czasu chcesz poświęcić na dany rodzaj pracy
 * (np. Code Review 6h, spotkania najwyżej 8h). Każdy rodzaj pracy raz.
 */
export function TimeGoalsField({
  rows,
  onChange,
  showErrors,
}: TimeGoalsFieldProps) {
  const messages = useMessages(settingsMessages).sprints.timeGoals
  const format = useFormat()
  const types = useQuery(taskTypesQuery).data ?? []
  const id = useId()
  const free = types.filter(
    (type) => !rows.some((goalDraft) => goalDraft.taskTypeId === type.id),
  )
  const update = (key: string, patch: Partial<GoalDraft>) =>
    onChange(
      rows.map((goalDraft) =>
        goalDraft.key === key ? { ...goalDraft, ...patch } : goalDraft,
      ),
    )

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{messages.legend}</legend>
      <p id={`${id}-hint`} className="text-sm text-ink-soft">
        {messages.hint}
      </p>
      {rows.length > 0 && (
        <ul className="space-y-2.5">
          {rows.map((row, index) => {
            const type = types.find(
              (workType) => workType.id === row.taskTypeId,
            )
            const minutes = parseDuration(row.time)
            const timeError = showErrors && !minutes ? messages.timeError : null
            const typeError =
              showErrors && !row.taskTypeId ? messages.typeError : null
            const name = type?.name ?? fmt(messages.row, { n: index + 1 })
            return (
              <li key={row.key} className="flex flex-wrap items-start gap-2">
                <div className="min-w-40 flex-1">
                  <Select
                    aria-label={fmt(messages.typeLabel, { n: index + 1 })}
                    aria-invalid={typeError ? true : undefined}
                    value={row.taskTypeId}
                    onChange={(event) =>
                      update(row.key, { taskTypeId: event.target.value })
                    }
                  >
                    <option value="">{messages.pickType}</option>
                    {types
                      .filter(
                        (workType) =>
                          workType.id === row.taskTypeId ||
                          free.some((freeType) => freeType.id === workType.id),
                      )
                      .map((workType) => (
                        <option key={workType.id} value={workType.id}>
                          {workType.name}
                        </option>
                      ))}
                  </Select>
                  {typeError && (
                    <p className="mt-1 text-sm text-destructive">{typeError}</p>
                  )}
                </div>
                <div className="w-32">
                  <Input
                    aria-label={fmt(messages.timeLabel, { name })}
                    aria-invalid={timeError ? true : undefined}
                    aria-describedby={`${id}-hint`}
                    inputMode="text"
                    placeholder="6h"
                    value={row.time}
                    onChange={(event) =>
                      update(row.key, { time: event.target.value })
                    }
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
                  aria-label={fmt(messages.remove, { name })}
                  onClick={() =>
                    onChange(
                      rows.filter((goalDraft) => goalDraft.key !== row.key),
                    )
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
          {messages.add}
        </Button>
      )}
    </fieldset>
  )
}
