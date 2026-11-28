import { Link } from '@tanstack/react-router'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDateRange } from '#/i18n/format'
import { daysOffMessages } from '#/i18n/messages/days-off'
import { panelMessages } from '#/i18n/messages/panel'
import { TypeBar } from './type-bar'
import type { SprintsViewModel } from '../../controllers/use-sprints'

export interface SprintHistoryProps {
  viewModel: SprintsViewModel
}

/** Zakończone sprinty w tabeli (czas, SP, czas na SP, podział) ze średnią na SP. */
export function SprintHistory({ viewModel }: SprintHistoryProps) {
  const messages = useMessages(panelMessages).sprints
  const off = useMessages(daysOffMessages)
  const format = useFormat()
  const { locale } = useI18n()
  return (
    <section
      aria-labelledby="sprint-history"
      className="mt-6 rounded-2xl border border-line bg-surface"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="max-w-[60ch]">
          <h2 id="sprint-history" className="type-heading text-2xl">
            {messages.history}
          </h2>
          <p className="mt-1 text-[0.9375rem] text-ink-soft">
            {messages.historyLead}
          </p>
        </div>
        {viewModel.average !== null && viewModel.averaged > 0 && (
          <div className="text-right">
            <p className="text-sm text-ink-soft">
              {fmt(messages.average, { n: viewModel.averaged })}
            </p>
            <p className="type-heading text-2xl tabular-nums">
              {format.minutes(viewModel.average)}
              <span className="text-base font-normal text-ink-soft"> / SP</span>
            </p>
            <p className="text-sm text-ink-soft">
              {fmt(messages.averageHint, {
                time: format.minutes(viewModel.average * 5),
              })}
            </p>
          </div>
        )}
      </header>

      {viewModel.pastStats.length === 0 ? (
        <p className="px-5 py-6 text-ink-soft sm:px-6">
          {messages.emptyHistory}
        </p>
      ) : (
        // relative: ukryte podpisy (sr-only) w komórkach nie wypychają strony w bok.
        <div
          className="relative overflow-x-auto"
          role="region"
          tabIndex={0}
          aria-label={messages.tableRegion}
        >
          <table className="w-full min-w-[40rem] text-[0.9375rem]">
            <thead>
              <tr className="text-left text-sm text-ink-soft">
                <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                  {messages.columns.sprint}
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  {messages.columns.hours}
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  {messages.columns.points}
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  {messages.columns.perSp}
                </th>
                <th
                  scope="col"
                  className="w-[32%] px-5 py-3 font-medium sm:px-6"
                >
                  {messages.columns.split}
                </th>
              </tr>
            </thead>
            <tbody>
              {viewModel.pastStats.map((sprintStats) => {
                const daysOff = viewModel.availability(sprintStats.sprint).off
                return (
                  <tr
                    key={sprintStats.sprint.id}
                    className="border-t border-line"
                  >
                    <th
                      scope="row"
                      className="px-5 py-3 text-left font-normal sm:px-6"
                    >
                      <Link
                        to="/app/analytics"
                        search={{ sprint: sprintStats.sprint.id }}
                        className="font-semibold underline-offset-4 hover:underline"
                      >
                        {sprintStats.sprint.name}
                      </Link>
                      <span className="block text-sm text-ink-soft">
                        {formatDateRange(
                          locale,
                          sprintStats.sprint.startsOn,
                          sprintStats.sprint.endsOn,
                        )}
                        {daysOff > 0 &&
                          `, ${format.plural(off.sprint.short, daysOff)}`}
                      </span>
                    </th>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {format.minutes(sprintStats.minutes)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {format.number(sprintStats.storyPoints)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {sprintStats.minutesPerSp === null
                        ? '–'
                        : format.minutes(sprintStats.minutesPerSp)}
                    </td>
                    <td className="px-5 py-3 sm:px-6">
                      <TypeBar
                        rows={sprintStats.types}
                        types={viewModel.types}
                        className="h-2.5"
                      />
                      <span className="sr-only">
                        {sprintStats.types
                          .map(
                            (typeRow) =>
                              `${viewModel.typeOf(typeRow.taskTypeId)?.name ?? '?'} ${format.minutes(typeRow.minutes)}`,
                          )
                          .join(', ')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
