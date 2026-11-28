import {
  DayOffBanner,
  DayOffButton,
} from '#/features/days-off/views/day-off-today'
import { fmt } from '#/i18n/format'
import { StartBreakButton } from '../breaks'
import { DayPicker } from '../day-picker'
import { EntryForm } from '../entry-form'
import { TaskSearch } from '../task-search'
import { UnfinishedTasks } from '../unfinished'
import { DayStats } from './day-stats'
import { EntryList } from './entry-list'
import { QuickTemplates } from './quick-templates'
import { useTodayViewModel } from '../../controllers/use-today'
import type { TodayProps } from '../../controllers/use-today'

export type { TodayRequest } from '../../controllers/use-today'

/**
 * Strona Dziś (widok w MVVM): nagłówek z wyborem dnia, liczby dnia, szablony,
 * zadania do dokończenia, formularz wpisu i lista wpisów. Stan i dane są
 * w `useTodayViewModel`, a lista ma własny `useEntryListViewModel`.
 */
export function TodayPage(props: TodayProps) {
  const viewModel = useTodayViewModel(props)
  const { t: messages, isToday, workDate } = viewModel
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-soft">
            {viewModel.dateLabel}
          </p>
          <h1 className="type-display text-4xl sm:text-5xl">
            {viewModel.heading}
          </h1>
        </div>
        <div className="flex flex-wrap items-start gap-2 sm:justify-end">
          {isToday && <StartBreakButton date={workDate} />}
          <DayOffButton date={workDate} />
          <DayPicker
            value={workDate}
            today={viewModel.today}
            min={viewModel.minDate}
            limited={viewModel.limited}
            onChange={viewModel.changeDate}
          />
        </div>
      </header>

      <DayOffBanner date={workDate} />
      <DayStats viewModel={viewModel} />

      <QuickTemplates
        workDate={workDate}
        isToday={isToday}
        requested={viewModel.templateRequest}
        onRequestDone={viewModel.onRequestDone}
      />

      {isToday && <UnfinishedTasks today={viewModel.today} />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="log-time"
          className="rounded-2xl border border-line bg-surface"
        >
          <header className="border-b border-line px-5 py-4 sm:px-6">
            <h2 id="log-time" className="type-heading text-2xl">
              {messages.form.title}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {isToday
                ? messages.form.lead
                : fmt(messages.day.pastLead, { date: viewModel.dateLabel })}
            </p>
          </header>
          <div className="px-5 py-5 sm:px-6">
            <TaskSearch isToday={isToday} onUse={viewModel.useTask} />
            <EntryForm workDate={workDate} prefill={viewModel.prefill} />
          </div>
        </section>

        <section
          aria-labelledby="today-entries"
          className="rounded-2xl border border-line bg-surface"
        >
          <header className="border-b border-line px-5 py-4 sm:px-6">
            <h2 id="today-entries" className="type-heading text-2xl">
              {isToday
                ? messages.list.title
                : fmt(messages.day.listTitle, { date: viewModel.shortDate })}
            </h2>
          </header>
          {viewModel.entries.length === 0 ? (
            <p className="px-5 py-6 text-ink-soft sm:px-6">
              {viewModel.entriesPending
                ? '…'
                : isToday
                  ? messages.list.empty
                  : messages.day.listEmpty}
            </p>
          ) : (
            <EntryList entries={viewModel.entries} />
          )}
        </section>
      </div>
    </div>
  )
}
