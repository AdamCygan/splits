import { queryOptions } from '@tanstack/react-query'
import { breaksApi } from '#/features/breaks/data/api'
import { entriesApi } from './data/api'
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

/** Przerwy w pracy: lista z dnia i trwająca przerwa. */
export const breakKeys = { all: ['breaks'] as const }
export const breaksQuery = (date: string) =>
  queryOptions({
    queryKey: [...breakKeys.all, 'day', date],
    queryFn: () => unwrap(breaksApi.list(date)),
  })
export const runningBreakQuery = queryOptions({
  queryKey: [...breakKeys.all, 'running'],
  queryFn: () => unwrap(breaksApi.running()),
})
