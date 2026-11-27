import { settingsInput } from '../data/inputs.server'
import { toSettings } from '../data/mappers.server'
import { hasProAccess } from '#/features/billing/domain/plans'
import { db } from '#/server/db/client'
import * as t from '#/server/db/schema'
import { currentUser } from '#/features/account/controllers/routes.server'
import { syncCadenceSprints } from '#/features/sprints/controllers/routes.server'
import type { AppEnv } from '#/server/http/context'
import { ApiError, notFound } from '#/server/http/errors'
import { body } from '#/server/http/inputs'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

export const settingsRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const [row] = await db
      .select()
      .from(t.userSettings)
      .where(eq(t.userSettings.userId, c.get('userId')))
    if (!row) throw notFound()
    return c.json(toSettings(row))
  })
  .put('/', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, settingsInput)
    const row = await db.transaction(async (tx) => {
      // Przypomnienia e-mail są w Pro. Free może je tylko wyłączyć albo zostawić bez zmian.
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
    return c.json(toSettings(row))
  })
