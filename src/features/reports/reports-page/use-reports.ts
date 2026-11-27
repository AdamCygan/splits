import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { selectable } from '#/domain/archive'
import type { TaskRef } from '#/features/time-entries/data/dto'
import { addDays, todayIn } from '#/domain/dates'
import { percentOf } from '#/domain/numbers'
import {
  byType,
  groupTasks,
  isValidRange,
  nextSort,
  reportCsv,
  reportRange,
  sortRows,
  totalsOf,
  withElapsed,
} from '#/domain/report'
import type {
  ReportPeriod,
  ReportRange,
  SortState,
  TaskSort,
} from '#/domain/report'
import { currentSprint, startedSprints } from '#/domain/sprints'
import { historyStart } from '#/domain/workday'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'
import {
  meQuery,
  projectsQuery,
  settingsQuery,
  sprintsQuery,
  taskTypesQuery,
} from '#/features/settings/queries'
import { rangeEntriesQuery } from '#/features/time-entries/queries'
import { useI18n, useMessages } from '#/i18n/context'
import { formatDateRange } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import { downloadFile } from '#/lib/download'
import type { ChartBucket } from '../charts'

/** Ile ostatnich sprintów pokazujemy w wyborze okresu. */
const RECENT_SPRINTS = 8

export interface ReportsViewModelOptions {
  initialSprintId?: string
}

/**
 * ViewModel Raportów: okres (sprint, kalendarz, własne daty) przycięty do planu, filtr
 * rodzaju, sortowanie tabeli, liczby, podział na rodzaje i eksport CSV.
 */
export function useReportsViewModel({
  initialSprintId,
}: ReportsViewModelOptions) {
  const t = useMessages(reportsMessages)
  const { locale } = useI18n()
  const navigate = useNavigate()
  const settings = useQuery(settingsQuery).data
  const user = useQuery(meQuery).data
  const sprints = useQuery(sprintsQuery).data ?? []
  const types = useQuery(taskTypesQuery).data ?? []
  const projects = useQuery(projectsQuery).data ?? []
  const today = todayIn(settings?.timezone)
  const isFree = !hasProAccess(user)
  const oldest = historyStart(today, isFree ? FREE_LIMITS.historyDays : null)

  const [editing, setEditing] = useState<TaskRef | null>(null)
  const [chosen, setChosen] = useState<ReportPeriod | null>(
    initialSprintId ? `sprint:${initialSprintId}` : null,
  )
  const [custom, setCustom] = useState<ReportRange>(() => ({
    from: addDays(today, -13),
    to: today,
  }))
  const [typeId, setTypeId] = useState('')
  const [sort, setSort] = useState<SortState>({ by: 'minutes', dir: 'desc' })

  const started = startedSprints(sprints, today).slice(0, RECENT_SPRINTS)
  // Sprint z linku (strona Sprinty) może być starszy niż ostatnie: dokładamy go do listy.
  const linked = sprints.find((s) => s.id === initialSprintId)
  const recent =
    linked && !started.includes(linked) ? [...started, linked] : started
  const current = currentSprint(recent, today)
  const fallback: ReportPeriod = current ? `sprint:${current.id}` : 'this_week'
  // Nieznany sprint w adresie (usunięty, cudzy) = zwykły domyślny okres.
  const period: ReportPeriod =
    chosen?.startsWith('sprint:') &&
    sprints.length > 0 &&
    !sprints.some((s) => `sprint:${s.id}` === chosen)
      ? fallback
      : (chosen ?? fallback)
  const sprint = period.startsWith('sprint:')
    ? sprints.find((s) => `sprint:${s.id}` === period)
    : undefined
  const { range, clamped } = reportRange({
    period,
    sprint,
    custom,
    today,
    weekStartsOn: settings?.weekStartsOn ?? 1,
    oldest,
  })
  const valid = isValidRange(range)

  const entries = useQuery({
    ...rangeEntriesQuery(range.from, range.to),
    enabled: valid,
  })

  const allRows = useMemo(
    () => groupTasks(withElapsed(entries.data ?? [], Date.now()), types),
    [entries.data, types],
  )
  const rows = typeId ? allRows.filter((r) => r.taskTypeId === typeId) : allRows
  const sorted = sortRows(rows, sort.by, sort.dir)
  const typeRows = byType(
    allRows,
    types.map((x) => x.id),
  )
  const allMinutes = typeRows.reduce((sum, r) => sum + r.minutes, 0)
  const typeOf = (id: string) => types.find((x) => x.id === id)
  const projectOf = (id: string | null) => projects.find((p) => p.id === id)

  return {
    today,
    isFree,
    oldest,
    clamped,
    recent,
    current,
    period,
    custom,
    customValid: isValidRange(custom),
    typeId,
    sort,
    range,
    valid,
    periodLabel: valid ? formatDateRange(locale, range.from, range.to) : '',
    pending: entries.isPending && valid,
    activeTypes: selectable(types),
    types,
    allRows,
    rows,
    sorted,
    // Wykresy liczą się z tych samych danych co tabela: filtr rodzaju zawęża wszystko.
    chartEntries: (entries.data ?? []).filter(
      (e) => !typeId || e.taskTypeId === typeId,
    ),
    totals: totalsOf(rows),
    sessions: rows.reduce((sum, r) => sum + r.sessions, 0),
    typeRows,
    editing,
    typeOf,
    projectOf,
    /** Udział rodzaju w całym czasie okresu (bez filtra), w procentach. */
    percent: (minutes: number) => percentOf(minutes, allMinutes),
    // akcje
    choosePeriod: setChosen,
    setCustom,
    setTypeId,
    toggleType: (id: string) => setTypeId((v) => (v === id ? '' : id)),
    toggleSort: (by: TaskSort) => setSort((s) => nextSort(s, by)),
    edit: setEditing,
    closeEdit: () => setEditing(null),
    /** Słupek wykresu: dzień otwiera widok dnia, tydzień/miesiąc zawęża raport. */
    openBucket: (b: ChartBucket) => {
      if (b.unit === 'day')
        void navigate({ to: '/app/day', search: { date: b.from } })
      else {
        setCustom({ from: b.from, to: b.to })
        setChosen('custom')
      }
    },
    exportCsv: () => {
      const csv = reportCsv(sorted, {
        head: t.csvHead,
        typeName: (id) => typeOf(id)?.name ?? '',
        projectName: (id) => projectOf(id)?.name ?? '',
      })
      // BOM: Excel rozpoznaje wtedy UTF-8 i polskie znaki.
      downloadFile(
        `timeblame-report-${range.from}_${range.to}.csv`,
        ['﻿', csv],
        'text/csv;charset=utf-8',
      )
      toast.success(t.exported)
    },
  }
}

export type ReportsViewModel = ReturnType<typeof useReportsViewModel>
