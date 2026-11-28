import { entriesApi } from '../data/api'
import { entryKeys } from '../data/queries'
import type { TaskRef, TimeEntry } from '#/features/time-entries/data/dto'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { useDataMutation } from '#/shared/data/mutations'

export const refOf = (timeEntry: TimeEntry): TaskRef => ({
  title: timeEntry.title,
  link: timeEntry.link,
  taskTypeId: timeEntry.taskTypeId,
})

export interface FinishTaskInput {
  ref: TaskRef
  finished: boolean
}

/** Zakończone / z powrotem w toku: wszystkie sesje zadania naraz. */
export function useFinishTask() {
  const messages = useMessages(entriesMessages).unfinished
  return useDataMutation(
    ({ ref, finished }: FinishTaskInput) =>
      entriesApi.finishTask(ref, finished),
    {
      invalidate: [entryKeys.all],
      success: (_unused, { ref, finished }) =>
        fmt(finished ? messages.finished : messages.reopened, {
          name: ref.title,
        }),
    },
  )
}
