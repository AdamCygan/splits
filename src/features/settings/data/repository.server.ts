import { and, eq } from 'drizzle-orm'
import { currentUser } from '#/features/account/data/repository.server'
import { hasProAccess } from '#/features/billing/domain/plans'
import { syncCadenceSprints } from '#/features/sprints/data/repository.server'
import { database } from '#/server/db/client'
import type { Tx } from '#/server/db/client'
import * as schema from '#/server/db/schema'
import type { Scope } from '#/server/db/scope'
import { ApiError, notFound } from '#/server/http/errors'
import type { settingsInput } from './inputs.server'
import { toSettings } from './mappers.server'
import type { z } from 'zod'

export type SettingsInput = z.infer<typeof settingsInput>

/** Ustawienia konta połączone z ustawieniami dnia pracy bieżącej przestrzeni. */
export async function readSettings(transaction: Tx, scope: Scope) {
  const [row] = await transaction
    .select({
      account: schema.userSettings,
      workspace: schema.workspaceSettings,
    })
    .from(schema.userSettings)
    .innerJoin(
      schema.workspaceSettings,
      and(
        eq(schema.workspaceSettings.workspaceId, scope.workspaceId),
        eq(schema.workspaceSettings.userId, schema.userSettings.userId),
      ),
    )
    .where(eq(schema.userSettings.userId, scope.userId))
  if (!row) throw notFound()
  return toSettings(row.account, row.workspace)
}

export const getSettings = (scope: Scope) => readSettings(database, scope)

/**
 * Zapis ustawień. Język, strefa, początek tygodnia i przypomnienie należą do konta, a dzień
 * pracy (cel, dni robocze, zaokrąglanie, przerwy, szablon podsumowania) do przestrzeni:
 * bieżącej albo, gdy `workspaceIds` ma więcej przestrzeni, do każdej z nich.
 * Przypomnienia e-mail są w Pro: Free może je tylko wyłączyć albo zostawić bez zmian.
 * Po zmianie dni pracy sprinty z kadencji liczą się od nowa.
 */
export async function updateSettings(
  scope: Scope,
  input: SettingsInput,
  workspaceIds: ReadonlyArray<string> = [scope.workspaceId],
) {
  return database.transaction(async (transaction) => {
    if (input.dailyReminderAt !== null) {
      const [current] = await transaction
        .select({ at: schema.userSettings.dailyReminderAt })
        .from(schema.userSettings)
        .where(eq(schema.userSettings.userId, scope.userId))
      if (
        current?.at !== input.dailyReminderAt &&
        !hasProAccess(await currentUser(scope.userId))
      )
        throw new ApiError('plan.pro_feature', 403, 'dailyReminderAt')
    }
    await transaction
      .update(schema.userSettings)
      .set({
        weekStartsOn: input.weekStartsOn,
        timezone: input.timezone,
        locale: input.locale,
        dailyReminderAt: input.dailyReminderAt,
      })
      .where(eq(schema.userSettings.userId, scope.userId))
    const day = {
      workdayTargetMinutes: input.workdayTargetMinutes,
      workingDays: [...new Set(input.workingDays)].sort(
        (left, right) => left - right,
      ),
      timeRoundingMinutes: input.timeRoundingMinutes,
      breakMinutes: input.breakMinutes,
      summaryTemplate: input.summaryTemplate?.trim()
        ? input.summaryTemplate
        : null,
    }
    for (const workspaceId of workspaceIds) {
      const target = { userId: scope.userId, workspaceId }
      await transaction
        .update(schema.workspaceSettings)
        .set(day)
        .where(
          and(
            eq(schema.workspaceSettings.workspaceId, workspaceId),
            eq(schema.workspaceSettings.userId, scope.userId),
          ),
        )
      await syncCadenceSprints(transaction, target)
    }
    return readSettings(transaction, scope)
  })
}
