import type { Locale } from '#/i18n/config'
import type { Tx } from '#/server/db/client'
import * as schema from '#/server/db/schema'
import { owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { seedWorkspace } from '#/server/seed-data'
import { defaultWorkspaceName } from '#/features/workspaces/domain/workspaces'

/**
 * Dane startowe nowego konta: ustawienia konta i pierwsza przestrzeń z konfiguracją
 * (te same dane, które widział tryb demo).
 */
export async function createAccountData(
  transaction: Tx,
  userId: string,
  locale: Locale,
  timezone: string,
  withSamples = false,
) {
  await transaction.insert(schema.userSettings).values({
    userId,
    weekStartsOn: 1,
    timezone,
    locale,
    dailyReminderAt: null,
  })
  const [workspace] = await transaction
    .insert(schema.workspaces)
    .values({ userId, name: defaultWorkspaceName(locale), color: '#3D3BF3' })
    .returning()
  await seedWorkspaceData(
    transaction,
    { userId, workspaceId: workspace!.id },
    locale,
    timezone,
    withSamples,
  )
  return workspace!
}

/** Konfiguracja startowa przestrzeni: ustawienia dnia, skala SP, rodzaje pracy, statusy, kadencja. */
export async function seedWorkspaceData(
  transaction: Tx,
  scope: Scope,
  locale: Locale,
  timezone: string,
  withSamples = false,
) {
  const workspace = seedWorkspace(locale, withSamples, timezone)
  const own = <T extends object>(rows: Array<T>) =>
    rows.map((row) => ({ ...row, ...owner(scope) }))

  await transaction.insert(schema.workspaceSettings).values({
    ...owner(scope),
    workdayTargetMinutes: workspace.settings.workdayTargetMinutes,
    workingDays: workspace.settings.workingDays,
    timeRoundingMinutes: workspace.settings.timeRoundingMinutes,
    summaryTemplate: workspace.settings.summaryTemplate,
    breakMinutes: workspace.settings.breakMinutes,
  })
  await transaction
    .insert(schema.storyPointScale)
    .values(own(workspace.spScale))
  await transaction.insert(schema.taskTypes).values(
    own(workspace.taskTypes).map((row) => ({
      ...row,
      archivedAt: row.archivedAt ? new Date(row.archivedAt) : null,
    })),
  )
  await transaction.insert(schema.taskStatuses).values(
    own(workspace.statuses).map((row) => ({
      ...row,
      archivedAt: row.archivedAt ? new Date(row.archivedAt) : null,
    })),
  )
  if (workspace.cadence)
    await transaction
      .insert(schema.sprintCadences)
      .values({ ...owner(scope), ...workspace.cadence })
  if (workspace.projects.length)
    await transaction.insert(schema.projects).values(
      own(workspace.projects).map((row) => ({
        ...row,
        archivedAt: row.archivedAt ? new Date(row.archivedAt) : null,
      })),
    )
  if (workspace.tags.length)
    await transaction.insert(schema.tags).values(own(workspace.tags))
  if (workspace.templates.length)
    await transaction
      .insert(schema.quickTemplates)
      .values(own(workspace.templates))
  const entries = workspace.entries ?? []
  if (entries.length)
    await transaction.insert(schema.timeEntries).values(
      own(entries).map((entry) => ({
        ...entry,
        startedAt: entry.startedAt ? new Date(entry.startedAt) : null,
        createdAt: new Date(entry.createdAt),
        finishedAt: entry.finishedAt ? new Date(entry.finishedAt) : null,
      })),
    )
}
