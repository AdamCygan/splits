import { eq } from 'drizzle-orm'
import { currentUser } from '#/features/account/controllers/routes.server'
import { hasProAccess } from '#/features/billing/domain/plans'
import { syncCadenceSprints } from '#/features/sprints/data/repository.server'
import { db } from '#/server/db/client'
import * as t from '#/server/db/schema'
import { ApiError, notFound } from '#/server/http/errors'
import type { settingsInput } from './inputs.server'
import { toSettings } from './mappers.server'
import type { z } from 'zod'

export type SettingsInput = z.infer<typeof settingsInput>

/** Ustawienia konta. */
export async function getSettings(userId: string) {
  const [row] = await db
    .select()
    .from(t.userSettings)
    .where(eq(t.userSettings.userId, userId))
  if (!row) throw notFound()
  return toSettings(row)
}

/**
 * Zapis ustawień. Przypomnienia e-mail są w Pro: Free może je tylko wyłączyć albo zostawić
 * bez zmian. Po zmianie dni pracy sprinty z kadencji liczą się od nowa.
 */
export async function updateSettings(userId: string, input: SettingsInput) {
  const row = await db.transaction(async (tx) => {
    if (input.dailyReminderAt !== null) {
      const [current] = await tx
        .select({ at: t.userSettings.dailyReminderAt })
        .from(t.userSettings)
        .where(eq(t.userSettings.userId, userId))
      if (
        current?.at !== input.dailyReminderAt &&
        !hasProAccess(await currentUser(userId))
      )
        throw new ApiError('plan.pro_feature', 403, 'dailyReminderAt')
    }
    const [updated] = await tx
      .update(t.userSettings)
      .set({
        ...input,
        workingDays: [...new Set(input.workingDays)].sort((a, b) => a - b),
        summaryTemplate: input.summaryTemplate?.trim()
          ? input.summaryTemplate
          : null,
      })
      .where(eq(t.userSettings.userId, userId))
      .returning()
    await syncCadenceSprints(tx, userId)
    return updated
  })
  if (!row) throw notFound()
  return toSettings(row)
}
