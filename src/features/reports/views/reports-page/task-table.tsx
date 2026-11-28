import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  Pencil,
} from 'lucide-react'
import { Badge, ColorDot } from '#/components/ui/controls'
import type {
  SortState,
  TaskRow,
  TaskSort,
} from '#/features/reports/domain/report'
import { linkLabel } from '#/features/tasks/domain/links'
import { TaskLink } from '#/features/tasks/views/task-link'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import { cn } from '#/lib/utils'
import type { ReportsViewModel } from '../../controllers/use-reports'
import { safeUrl } from '#/features/time-entries/domain/entries'

export interface TaskTableProps {
  vm: ReportsViewModel
}

/** Tabela zadań okresu z sortowaniem po kolumnach i sumą w stopce. */
export function TaskTable({ vm }: TaskTableProps) {
  const t = useMessages(reportsMessages)
  const format = useFormat()
  const sortProps = {
    sort: vm.sort,
    onSort: vm.toggleSort,
    sortLabel: t.table.sortBy,
  }
  return (
    <section
      aria-labelledby="report-tasks"
      className="min-w-0 rounded-2xl border border-line bg-surface"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
        <h2 id="report-tasks" className="type-heading text-2xl">
          {t.table.title}
        </h2>
        <p className="text-sm text-ink-soft">{vm.periodLabel}</p>
      </header>
      <div
        className="relative overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={t.table.region}
      >
        <table className="w-full text-left text-sm sm:min-w-[40rem]">
          <caption className="sr-only">
            {fmt(t.table.caption, { period: vm.periodLabel })}
          </caption>
          <thead className="bg-muted/50 text-ink-soft">
            <tr>
              <SortHeader
                column="title"
                label={t.table.columns.title}
                className="pl-5 sm:pl-6"
                {...sortProps}
              />
              <th
                scope="col"
                className="hidden px-3 py-2.5 font-medium sm:table-cell"
              >
                {t.table.columns.type}
              </th>
              <SortHeader
                column="storyPoints"
                label={t.table.columns.storyPoints}
                numeric
                {...sortProps}
              />
              <SortHeader
                column="minutes"
                label={t.table.columns.minutes}
                numeric
                {...sortProps}
              />
              <th
                scope="col"
                className="hidden px-3 py-2.5 text-right font-medium sm:table-cell"
              >
                {t.table.columns.sessions}
              </th>
              <SortHeader
                column="last"
                label={t.table.columns.last}
                className="hidden pr-5 sm:table-cell sm:pr-6"
                {...sortProps}
              />
            </tr>
          </thead>
          <tbody>
            {vm.sorted.map((r) => (
              <TaskTableRow key={r.key} row={r} vm={vm} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-semibold">
              <th scope="row" className="py-3 pr-3 pl-5 sm:pl-6">
                {t.table.total}
              </th>
              <td className="hidden px-3 py-3 font-normal text-ink-soft sm:table-cell">
                {format.plural(t.byType.tasks, vm.totals.tasks)}
              </td>
              <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                {format.number(vm.totals.storyPoints)}
              </td>
              <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                {format.minutes(vm.totals.minutes)}
              </td>
              <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">
                {vm.sessions}
              </td>
              <td className="hidden pr-5 sm:table-cell sm:pr-6" />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

interface TaskTableRowProps {
  row: TaskRow
  vm: ReportsViewModel
}

/** Wiersz zadania: tytuł z edycją, rodzaj, projekt, link, SP, czas z estymatą, sesje, data. */
function TaskTableRow({ row: r, vm }: TaskTableRowProps) {
  const t = useMessages(reportsMessages)
  const format = useFormat()
  const { locale } = useI18n()
  const type = vm.typeOf(r.taskTypeId)
  const project = vm.projectOf(r.projectId)
  const task = { title: r.title, link: r.link, taskTypeId: r.taskTypeId }
  return (
    <tr className="border-t border-line align-top">
      <th
        scope="row"
        className="max-w-[22rem] py-3 pr-3 pl-5 font-medium sm:pl-6"
      >
        <span className="inline-flex max-w-full items-start gap-1.5">
          <TaskLink task={task}>{r.title}</TaskLink>
          <button
            type="button"
            aria-label={fmt(t.table.edit, { name: r.title })}
            onClick={() => vm.edit(task)}
            className="mt-0.5 shrink-0 rounded text-ink-soft opacity-60 hover:opacity-100 focus-visible:opacity-100"
          >
            <Pencil aria-hidden className="size-3.5" />
          </button>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 font-normal">
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft sm:hidden">
            <ColorDot
              color={type?.color ?? 'var(--line)'}
              className="size-2.5"
            />
            {type?.name}
          </span>
          {project && <Badge tone="muted">{project.key ?? project.name}</Badge>}
          {r.running && <Badge tone="success">{t.table.running}</Badge>}
          {r.link && (
            <a
              href={safeUrl(r.link)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              {linkLabel(r.link, r.taskKey)}
              <ExternalLink aria-hidden className="size-3" />
              <span className="sr-only">
                {' '}
                {fmt(t.table.open, { name: r.title })}
              </span>
            </a>
          )}
        </span>
      </th>
      <td className="hidden px-3 py-3 sm:table-cell">
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <ColorDot color={type?.color ?? 'var(--line)'} />
          {type?.name}
        </span>
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
        {r.storyPoints === null ? (
          <span className="text-ink-soft">{t.table.noSp}</span>
        ) : (
          <span className="font-semibold">{format.number(r.storyPoints)}</span>
        )}
      </td>
      <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
        {format.minutes(r.minutes)}
        {/* Estymata i różnica w osobnych liniach: w jednej linii (nowrap) rozpychały tabelę na telefonie. */}
        {r.estimateMinutes !== null && (
          <span
            className={cn(
              'block text-xs font-medium',
              r.minutes > r.estimateMinutes ? 'text-warn' : 'text-ink-soft',
            )}
          >
            <span className="block">
              {fmt(t.table.estimate, {
                time: format.minutes(r.estimateMinutes),
              })}
            </span>
            {r.minutes !== r.estimateMinutes && (
              <span className="block">
                {fmt(
                  r.minutes > r.estimateMinutes
                    ? t.table.overEstimate
                    : t.table.underEstimate,
                  {
                    time: format.minutes(
                      Math.abs(r.minutes - r.estimateMinutes),
                    ),
                  },
                )}
              </span>
            )}
          </span>
        )}
        {r.extensionMinutes > 0 && (
          <span
            className="block text-xs font-medium text-ink-soft"
            title={r.extensionNotes.join('\n')}
          >
            {fmt(t.table.extension, {
              time: format.minutes(r.extensionMinutes),
            })}
          </span>
        )}
        {r.overtimeMinutes > 0 && (
          <span
            className="block text-xs font-medium text-ink-soft"
            title={r.overtimeNotes.join('\n')}
          >
            {fmt(t.stats.overtime, {
              time: format.minutes(r.overtimeMinutes),
            })}
          </span>
        )}
      </td>
      <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">
        {r.sessions}
      </td>
      <td className="hidden py-3 pr-5 pl-3 whitespace-nowrap text-ink-soft sm:table-cell sm:pr-6">
        {formatDate(locale, r.last, { day: 'numeric', month: 'short' })}
      </td>
    </tr>
  )
}

interface SortHeaderProps {
  column: TaskSort
  label: string
  sort: SortState
  onSort: (column: TaskSort) => void
  sortLabel: string
  numeric?: boolean
  className?: string
}

/** Nagłówek kolumny z przyciskiem sortowania i aria-sort. */
function SortHeader({
  column,
  label,
  sort,
  onSort,
  sortLabel,
  numeric = false,
  className,
}: SortHeaderProps) {
  const active = sort.by === column
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
      }
      className={cn(
        'px-3 py-1.5 font-medium whitespace-nowrap',
        numeric && 'text-right',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex min-h-9 items-center gap-1 rounded hover:text-ink',
          active && 'text-ink',
        )}
      >
        {label}
        <Icon aria-hidden className="size-3.5" />
        <span className="sr-only">, {fmt(sortLabel, { column: label })}</span>
      </button>
    </th>
  )
}
