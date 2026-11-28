import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  Pencil,
} from 'lucide-react'
import { Badge, ColorDot } from '#/components/ui/controls'
import {
  Fact,
  Facts,
  RecordCard,
  RecordList,
  SortPicker,
} from '#/components/ui/record-cards'
import type { SortOption } from '#/components/ui/record-cards'
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
  viewModel: ReportsViewModel
}

/** Tabela zadań okresu z sortowaniem po kolumnach i sumą w stopce. */
export function TaskTable({ viewModel }: TaskTableProps) {
  const messages = useMessages(reportsMessages)
  const format = useFormat()
  const sortProps = {
    sort: viewModel.sort,
    onSort: viewModel.toggleSort,
    sortLabel: messages.table.sortBy,
  }
  const columns = messages.table.columns
  const sortOptions: ReadonlyArray<SortOption<TaskSort>> = [
    { value: 'minutes', label: columns.minutes },
    { value: 'storyPoints', label: columns.storyPoints },
    { value: 'last', label: columns.last },
    { value: 'title', label: columns.title },
  ]
  return (
    <section
      aria-labelledby="report-tasks"
      className="min-w-0 rounded-2xl border border-line bg-surface"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
        <h2 id="report-tasks" className="type-heading text-2xl">
          {messages.table.title}
        </h2>
        <p className="text-sm text-ink-soft">{viewModel.periodLabel}</p>
      </header>
      <SortPicker
        options={sortOptions}
        column={viewModel.sort.by}
        direction={viewModel.sort.dir}
        onSort={viewModel.toggleSort}
        className="border-b border-line px-5 py-3"
      />
      <RecordList label={messages.table.title}>
        {viewModel.sorted.map((taskRow) => (
          <TaskCard key={taskRow.key} row={taskRow} viewModel={viewModel} />
        ))}
      </RecordList>
      <p className="flex flex-wrap justify-between gap-x-4 border-t-2 border-line px-5 py-3 text-sm font-semibold tabular-nums sm:hidden">
        <span>
          {messages.table.total}:{' '}
          {format.plural(messages.byType.tasks, viewModel.totals.tasks)}
        </span>
        <span>
          {format.minutes(viewModel.totals.minutes)},{' '}
          {format.number(viewModel.totals.storyPoints)}{' '}
          {messages.table.columns.storyPoints}
        </span>
      </p>
      <div
        className="relative hidden overflow-x-auto sm:block"
        tabIndex={0}
        role="region"
        aria-label={messages.table.region}
      >
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">
            {fmt(messages.table.caption, { period: viewModel.periodLabel })}
          </caption>
          <thead className="bg-muted/50 text-ink-soft">
            <tr>
              <SortHeader
                column="title"
                label={messages.table.columns.title}
                className="pl-5 sm:pl-6"
                {...sortProps}
              />
              <th
                scope="col"
                className="hidden px-3 py-2.5 font-medium sm:table-cell"
              >
                {messages.table.columns.type}
              </th>
              <SortHeader
                column="storyPoints"
                label={messages.table.columns.storyPoints}
                numeric
                {...sortProps}
              />
              <SortHeader
                column="minutes"
                label={messages.table.columns.minutes}
                numeric
                {...sortProps}
              />
              <th
                scope="col"
                className="hidden px-3 py-2.5 text-right font-medium sm:table-cell"
              >
                {messages.table.columns.sessions}
              </th>
              <SortHeader
                column="last"
                label={messages.table.columns.last}
                className="hidden pr-5 sm:table-cell sm:pr-6"
                {...sortProps}
              />
            </tr>
          </thead>
          <tbody>
            {viewModel.sorted.map((taskRow) => (
              <TaskTableRow
                key={taskRow.key}
                row={taskRow}
                viewModel={viewModel}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-semibold">
              <th scope="row" className="py-3 pr-3 pl-5 sm:pl-6">
                {messages.table.total}
              </th>
              <td className="hidden px-3 py-3 font-normal text-ink-soft sm:table-cell">
                {format.plural(messages.byType.tasks, viewModel.totals.tasks)}
              </td>
              <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                {format.number(viewModel.totals.storyPoints)}
              </td>
              <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                {format.minutes(viewModel.totals.minutes)}
              </td>
              <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">
                {viewModel.sessions}
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
  viewModel: ReportsViewModel
}

/** Wiersz zadania (od sm): tytuł z edycją, rodzaj, SP, czas z estymatą, sesje, data. */
function TaskTableRow({ row, viewModel }: TaskTableRowProps) {
  const { locale } = useI18n()
  const type = viewModel.typeOf(row.taskTypeId)
  return (
    <tr className="border-t border-line align-top">
      <th
        scope="row"
        className="max-w-[22rem] py-3 pr-3 pl-5 font-medium sm:pl-6"
      >
        <TaskHeading row={row} viewModel={viewModel} />
      </th>
      <td className="px-3 py-3">
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <ColorDot color={type?.color ?? 'var(--line)'} />
          {type?.name}
        </span>
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
        <StoryPoints row={row} />
      </td>
      <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
        <TimeDetails row={row} />
      </td>
      <td className="px-3 py-3 text-right tabular-nums">{row.sessions}</td>
      <td className="py-3 pr-5 pl-3 whitespace-nowrap text-ink-soft sm:pr-6">
        {formatDate(locale, row.last, { day: 'numeric', month: 'short' })}
      </td>
    </tr>
  )
}

/** Karta zadania na telefonie: te same dane co wiersz tabeli, podpisane. */
function TaskCard({ row, viewModel }: TaskTableRowProps) {
  const messages = useMessages(reportsMessages)
  const { locale } = useI18n()
  const columns = messages.table.columns
  return (
    <RecordCard>
      <div className="font-medium">
        <TaskHeading row={row} viewModel={viewModel} showType />
      </div>
      <Facts className="text-sm">
        <Fact label={columns.minutes}>
          <TimeDetails row={row} />
        </Fact>
        <Fact label={columns.storyPoints}>
          <StoryPoints row={row} />
        </Fact>
        <Fact label={columns.sessions}>{row.sessions}</Fact>
        <Fact label={columns.last}>
          {formatDate(locale, row.last, { day: 'numeric', month: 'short' })}
        </Fact>
      </Facts>
    </RecordCard>
  )
}

interface TaskHeadingProps extends TaskTableRowProps {
  /** Rodzaj pracy pod tytułem (karta; w tabeli ma własną kolumnę). */
  showType?: boolean
}

/** Tytuł zadania z edycją oraz projekt, działający timer i link do ticketu. */
function TaskHeading({ row, viewModel, showType = false }: TaskHeadingProps) {
  const messages = useMessages(reportsMessages)
  const type = viewModel.typeOf(row.taskTypeId)
  const project = viewModel.projectOf(row.projectId)
  const task = { title: row.title, link: row.link, taskTypeId: row.taskTypeId }
  return (
    <>
      <span className="inline-flex max-w-full items-start gap-1.5">
        <TaskLink task={task}>{row.title}</TaskLink>
        <button
          type="button"
          aria-label={fmt(messages.table.edit, { name: row.title })}
          onClick={() => viewModel.edit(task)}
          className="mt-0.5 shrink-0 rounded text-ink-soft opacity-60 hover:opacity-100 focus-visible:opacity-100"
        >
          <Pencil aria-hidden className="size-3.5" />
        </button>
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1.5 font-normal">
        {showType && (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <ColorDot
              color={type?.color ?? 'var(--line)'}
              className="size-2.5"
            />
            {type?.name}
          </span>
        )}
        {project && <Badge tone="muted">{project.key ?? project.name}</Badge>}
        {row.running && <Badge tone="success">{messages.table.running}</Badge>}
        {row.link && (
          <a
            href={safeUrl(row.link)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            {linkLabel(row.link, row.taskKey)}
            <ExternalLink aria-hidden className="size-3" />
            <span className="sr-only">
              {' '}
              {fmt(messages.table.open, { name: row.title })}
            </span>
          </a>
        )}
      </span>
    </>
  )
}

interface RowProps {
  row: TaskRow
}

function StoryPoints({ row }: RowProps) {
  const messages = useMessages(reportsMessages)
  const format = useFormat()
  const { storyPoints } = row
  const isUnestimated = storyPoints === null
  if (isUnestimated)
    return <span className="text-ink-soft">{messages.table.noSp}</span>
  return <span className="font-semibold">{format.number(storyPoints)}</span>
}

/** Czas zadania z estymatą, różnicą, przedłużeniem i nadgodzinami (każde w osobnej linii). */
function TimeDetails({ row }: RowProps) {
  const messages = useMessages(reportsMessages)
  const format = useFormat()
  const estimate = row.estimateMinutes
  return (
    <>
      <span className="font-semibold">{format.minutes(row.minutes)}</span>
      {/* Estymata i różnica w osobnych liniach: w jednej linii (nowrap) rozpychały tabelę na telefonie. */}
      {estimate !== null && (
        <span
          className={cn(
            'block text-xs font-medium',
            row.minutes > estimate ? 'text-warn' : 'text-ink-soft',
          )}
        >
          <span className="block">
            {fmt(messages.table.estimate, {
              time: format.minutes(estimate),
            })}
          </span>
          {row.minutes !== estimate && (
            <span className="block">
              {fmt(
                row.minutes > estimate
                  ? messages.table.overEstimate
                  : messages.table.underEstimate,
                {
                  time: format.minutes(Math.abs(row.minutes - estimate)),
                },
              )}
            </span>
          )}
        </span>
      )}
      {row.extensionMinutes > 0 && (
        <span
          className="block text-xs font-medium text-ink-soft"
          title={row.extensionNotes.join('\n')}
        >
          {fmt(messages.table.extension, {
            time: format.minutes(row.extensionMinutes),
          })}
        </span>
      )}
      {row.overtimeMinutes > 0 && (
        <span
          className="block text-xs font-medium text-ink-soft"
          title={row.overtimeNotes.join('\n')}
        >
          {fmt(messages.stats.overtime, {
            time: format.minutes(row.overtimeMinutes),
          })}
        </span>
      )}
    </>
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
