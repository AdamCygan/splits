import { entriesApi } from '../data/api'
import { entryKeys } from '../data/queries'
import type { TaskRef, TimeEntry } from '#/features/time-entries/data/dto'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { entriesMessages } from '#/i18n/messages/entries'
import { useDataMutation } from '#/shared/data/mutations'

export const refOf = (e: TimeEntry): TaskRef => ({
  title: e.title,
  link: e.link,
  taskTypeId: e.taskTypeId,
})

export interface FinishTaskInput {
  ref: TaskRef
  finished: boolean
}

/** Zakończone / z powrotem w toku: wszystkie sesje zadania naraz. */
export function useFinishTask() {
  const t = useMessages(entriesMessages).unfinished
  return useDataMutation(
    ({ ref, finished }: FinishTaskInput) =>
      entriesApi.finishTask(ref, finished),
    {
      invalidate: [entryKeys.all],
      success: (_, { ref, finished }) =>
        fmt(finished ? t.finished : t.reopened, { name: ref.title }),
    },
  )
}
