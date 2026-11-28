import type { TaskRef } from './dto'
import { entriesApi } from './api'
import { queryOptions } from '@tanstack/react-query'
import { unwrap } from '#/lib/api-client'

export const entryKeys = {
  all: ['time-entries'] as const,
  day: (workDate: string) => ['time-entries', 'day', workDate] as const,
  running: ['time-entries', 'running'] as const,
  paused: ['time-entries', 'paused'] as const,
  unfinished: ['time-entries', 'unfinished'] as const,
  range: (from: string, to: string) =>
    ['time-entries', 'range', from, to] as const,
}

/** Wpisy z zakresu dni do raportów (unieważniane razem z innymi wpisami). */
export const rangeEntriesQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: entryKeys.range(from, to),
    queryFn: () => unwrap(entriesApi.range(from, to)),
  })

export const entriesQuery = (workDate: string) =>
  queryOptions({
    queryKey: entryKeys.day(workDate),
    queryFn: () => unwrap(entriesApi.list(workDate)),
  })

export const pausedQuery = queryOptions({
  queryKey: entryKeys.paused,
  queryFn: () => unwrap(entriesApi.paused()),
})

export const unfinishedQuery = queryOptions({
  queryKey: entryKeys.unfinished,
  queryFn: () => unwrap(entriesApi.unfinished()),
})

export const runningQuery = queryOptions({
  queryKey: entryKeys.running,
  queryFn: () => unwrap(entriesApi.running()),
})

/** Klucz zapytania o wszystkie sesje jednego zadania (unieważniany po zmianach wpisów). */
export const taskQueryKey = (ref: TaskRef) =>
  [...entryKeys.all, 'task', ref.taskTypeId, ref.link ?? '', ref.title] as const

/** Wszystkie sesje zadania, od najstarszej. */
export const taskSessionsQuery = (ref: TaskRef) =>
  queryOptions({
    queryKey: taskQueryKey(ref),
    queryFn: () => unwrap(entriesApi.forTask(ref)),
  })

/** Wyszukiwanie zadań po tytule albo linku (od 2 znaków), wyniki ważne 10 s. */
export const taskSearchQuery = (query: string) =>
  queryOptions({
    queryKey: [...entryKeys.all, 'search', query],
    queryFn: () => unwrap(entriesApi.search(query)),
    enabled: query.length >= 2,
    staleTime: 10_000,
  })
