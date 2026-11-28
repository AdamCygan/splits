import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Field, Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { Segmented } from '#/components/ui/segmented'
import type { TaskSort } from '#/features/reports/domain/report'
import { TASK_PERIODS } from '#/features/tasks/domain/task-list'
import type {
  TaskPeriodChoice,
  TaskPeriodId,
} from '#/features/tasks/domain/task-list'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'
import { cn } from '#/lib/utils'
import type { TasksViewModel } from '../../controllers/use-tasks'

export interface TaskFiltersProps {
  viewModel: TasksViewModel
}

/**
 * Wyszukiwanie, filtry (rodzaj, wycena, okres lub sprint) i widok (grupowanie, stan,
 * sortowanie). Na telefonie wszystko poza wyszukiwaniem zwija się pod „Filtry (n)”.
 */
export function TaskFilters({ viewModel }: TaskFiltersProps) {
  const messages = useMessages(panelMessages).tasks
  const hidden = !viewModel.filtersOpen && 'max-sm:hidden'
  return (
    <>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <Field label={messages.search}>
          {(control) => (
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft"
              />
              <Input
                {...control}
                type="search"
                value={viewModel.search}
                placeholder={messages.searchPlaceholder}
                onChange={(event) => viewModel.setSearch(event.target.value)}
                className="h-11 pl-10"
              />
            </div>
          )}
        </Field>
        <div id="task-filters" className={cn('contents', hidden)}>
          <Field label={messages.type}>
            {(control) => (
              <Select
                {...control}
                value={viewModel.filters.typeId}
                onChange={(event) =>
                  viewModel.setFilter('typeId', event.target.value)
                }
              >
                <option value="">{messages.allTypes}</option>
                {viewModel.usedTypes.map((usedType) => (
                  <option key={usedType.id} value={usedType.id}>
                    {usedType.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={messages.estimate}>
            {(control) => (
              <Select
                {...control}
                value={viewModel.filters.estimate}
                onChange={(event) =>
                  viewModel.setFilter(
                    'estimate',
                    event.target.value as typeof viewModel.filters.estimate,
                  )
                }
              >
                {(['all', 'over', 'within', 'under'] as const).map((id) => (
                  <option key={id} value={id}>
                    {messages.estimates[id]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={messages.period}>
            {(control) => (
              <Select
                {...control}
                value={viewModel.choice}
                onChange={(event) =>
                  viewModel.setChoice(event.target.value as TaskPeriodChoice)
                }
              >
                <optgroup label={messages.periodGroup}>
                  {(viewModel.isFree
                    ? (['d30'] as Array<TaskPeriodId>)
                    : (Object.keys(TASK_PERIODS) as Array<TaskPeriodId>)
                  ).map((id) => (
                    <option key={id} value={id}>
                      {messages.periods[id]}
                    </option>
                  ))}
                </optgroup>
                {viewModel.sprintOptions.length > 0 && (
                  <optgroup label={messages.sprintGroup}>
                    {viewModel.sprintOptions.map((sprint) => (
                      <option key={sprint.id} value={`sprint:${sprint.id}`}>
                        {sprint.endsOn >= viewModel.today
                          ? fmt(messages.currentSprint, { name: sprint.name })
                          : sprint.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
            )}
          </Field>
        </div>
      </div>

      <Button
        variant="outline"
        className="mb-4 w-full sm:hidden"
        aria-expanded={viewModel.filtersOpen}
        aria-controls="task-filters task-view"
        onClick={viewModel.toggleFilters}
      >
        <SlidersHorizontal aria-hidden />
        {viewModel.activeFilters > 0
          ? fmt(messages.filtersCount, { n: viewModel.activeFilters })
          : messages.filters}
        <ChevronDown
          aria-hidden
          className={cn(
            'ml-auto transition-transform',
            viewModel.filtersOpen && 'rotate-180',
          )}
        />
      </Button>

      <div
        id="task-view"
        className={cn('mb-5 flex flex-wrap items-end gap-x-6 gap-y-3', hidden)}
      >
        <Segmented
          label={messages.view.groupBy}
          size="sm"
          value={viewModel.grouping}
          onChange={viewModel.setGrouping}
          options={(['kind', 'day', 'none'] as const).map((value) => ({
            value,
            label: messages.view.groups[value],
          }))}
        />
        <Segmented
          label={messages.view.status}
          size="sm"
          value={viewModel.filters.status}
          onChange={(status) => viewModel.setFilter('status', status)}
          options={(['all', 'open', 'done'] as const).map((value) => ({
            value,
            label: messages.view.statuses[value],
          }))}
        />
        <Field
          label={messages.view.sort}
          className="w-full sm:ml-auto sm:w-auto sm:min-w-44"
        >
          {(control) => (
            <Select
              {...control}
              value={viewModel.sort}
              onChange={(event) =>
                viewModel.setSort(event.target.value as TaskSort)
              }
            >
              {(['last', 'minutes', 'storyPoints', 'title'] as const).map(
                (id) => (
                  <option key={id} value={id}>
                    {messages.view.sorts[id]}
                  </option>
                ),
              )}
            </Select>
          )}
        </Field>
      </div>
    </>
  )
}
