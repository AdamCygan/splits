import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Field, Select } from '#/components/ui/controls'
import { Input } from '#/components/ui/input'
import { Segmented } from '#/components/ui/segmented'
import type { TaskSort } from '#/domain/report'
import { TASK_PERIODS } from '#/domain/task-list'
import type { TaskPeriodChoice, TaskPeriodId } from '#/domain/task-list'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { panelMessages } from '#/i18n/messages/panel'
import { cn } from '#/lib/utils'
import type { TasksViewModel } from './use-tasks'

/**
 * Wyszukiwanie, filtry (rodzaj, wycena, okres lub sprint) i widok (grupowanie, stan,
 * sortowanie). Na telefonie wszystko poza wyszukiwaniem zwija się pod „Filtry (n)”.
 */
export function TaskFilters({ vm }: { vm: TasksViewModel }) {
  const t = useMessages(panelMessages).tasks
  const hidden = !vm.filtersOpen && 'max-sm:hidden'
  return (
    <>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <Field label={t.search}>
          {(control) => (
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft"
              />
              <Input
                {...control}
                type="search"
                value={vm.search}
                placeholder={t.searchPlaceholder}
                onChange={(e) => vm.setSearch(e.target.value)}
                className="h-11 pl-10"
              />
            </div>
          )}
        </Field>
        <div id="task-filters" className={cn('contents', hidden)}>
          <Field label={t.type}>
            {(control) => (
              <Select
                {...control}
                value={vm.filters.typeId}
                onChange={(e) => vm.setFilter('typeId', e.target.value)}
              >
                <option value="">{t.allTypes}</option>
                {vm.usedTypes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.estimate}>
            {(control) => (
              <Select
                {...control}
                value={vm.filters.estimate}
                onChange={(e) =>
                  vm.setFilter(
                    'estimate',
                    e.target.value as typeof vm.filters.estimate,
                  )
                }
              >
                {(['all', 'over', 'within', 'under'] as const).map((id) => (
                  <option key={id} value={id}>
                    {t.estimates[id]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.period}>
            {(control) => (
              <Select
                {...control}
                value={vm.choice}
                onChange={(e) =>
                  vm.setChoice(e.target.value as TaskPeriodChoice)
                }
              >
                <optgroup label={t.periodGroup}>
                  {(vm.isFree
                    ? (['d30'] as Array<TaskPeriodId>)
                    : (Object.keys(TASK_PERIODS) as Array<TaskPeriodId>)
                  ).map((id) => (
                    <option key={id} value={id}>
                      {t.periods[id]}
                    </option>
                  ))}
                </optgroup>
                {vm.sprintOptions.length > 0 && (
                  <optgroup label={t.sprintGroup}>
                    {vm.sprintOptions.map((s) => (
                      <option key={s.id} value={`sprint:${s.id}`}>
                        {s.endsOn >= vm.today
                          ? fmt(t.currentSprint, { name: s.name })
                          : s.name}
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
        aria-expanded={vm.filtersOpen}
        aria-controls="task-filters task-view"
        onClick={vm.toggleFilters}
      >
        <SlidersHorizontal aria-hidden />
        {vm.activeFilters > 0
          ? fmt(t.filtersCount, { n: vm.activeFilters })
          : t.filters}
        <ChevronDown
          aria-hidden
          className={cn(
            'ml-auto transition-transform',
            vm.filtersOpen && 'rotate-180',
          )}
        />
      </Button>

      <div
        id="task-view"
        className={cn('mb-5 flex flex-wrap items-end gap-x-6 gap-y-3', hidden)}
      >
        <Segmented
          label={t.view.groupBy}
          size="sm"
          value={vm.grouping}
          onChange={vm.setGrouping}
          options={(['kind', 'day', 'none'] as const).map((value) => ({
            value,
            label: t.view.groups[value],
          }))}
        />
        <Segmented
          label={t.view.status}
          size="sm"
          value={vm.filters.status}
          onChange={(v) => vm.setFilter('status', v)}
          options={(['all', 'open', 'done'] as const).map((value) => ({
            value,
            label: t.view.statuses[value],
          }))}
        />
        <Field
          label={t.view.sort}
          className="w-full sm:ml-auto sm:w-auto sm:min-w-44"
        >
          {(control) => (
            <Select
              {...control}
              value={vm.sort}
              onChange={(e) => vm.setSort(e.target.value as TaskSort)}
            >
              {(['last', 'minutes', 'storyPoints', 'title'] as const).map(
                (id) => (
                  <option key={id} value={id}>
                    {t.view.sorts[id]}
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
