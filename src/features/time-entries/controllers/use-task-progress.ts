import { entriesApi } from '../data/api'
import { taskQueryKey } from '../data/queries'
import { useQuery } from '@tanstack/react-query'
import { scaleQuery } from '#/features/story-points/data/queries'
import {
  earnedPoints,
  taskBudget,
} from '#/features/story-points/domain/sp-scale'
import { maxEstimate, maxPoints } from '#/features/tasks/domain/summary'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { unwrap } from '#/lib/api-client'

const runningMinutes = (entry: TimeEntry | undefined) =>
  entry?.running && entry.startedAt
    ? Math.max(
        0,
        Math.floor((Date.now() - Date.parse(entry.startedAt)) / 60_000),
      )
    : 0

/**
 * Postęp zadania w SP: cały przepracowany czas (wszystkie dni plus trwający timer)
 * względem budżetu (estymata albo skala SP). null = brak SP albo budżetu.
 */
export function useTaskProgress(entry: TimeEntry | undefined) {
  const scale = useQuery(scaleQuery).data ?? []
  const ref = entry
    ? { title: entry.title, link: entry.link, taskTypeId: entry.taskTypeId }
    : null
  const sessions = useQuery({
    queryKey: ref ? taskQueryKey(ref) : ['none'],
    queryFn: () => unwrap(entriesApi.forTask(ref!)),
    enabled: !!ref,
  }).data
  if (!entry || !sessions) return null
  const all = [...sessions, ...(entry.running ? [entry] : [])]
  const storyPoints = maxPoints(all)
  const estimate = maxEstimate(all)
  const budget = taskBudget(storyPoints, estimate, scale)
  if (storyPoints === null || budget === null) return null
  const worked =
    sessions.reduce((sum, session) => sum + session.durationMinutes, 0) +
    runningMinutes(entry)
  return {
    sp: storyPoints,
    budget,
    worked,
    earned: earnedPoints(storyPoints, worked, budget),
    over: Math.max(0, worked - budget),
    fromEstimate: estimate !== null,
  }
}
