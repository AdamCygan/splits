import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { todayIn } from '#/shared/domain/dates'
import { db } from '../db/client'
import * as t from '../db/schema'
import type { AppEnv } from '../http/context'
import { notFound } from '../http/errors'
import { currentUser } from './account'
import {
  toEntry,
  toProject,
  toScaleStep,
  toSettings,
  toTaskType,
  toTemplate,
  toUser,
} from './dto'
import { entriesOn, pausedOn } from './entries'

/**
 * Start panelu jednym żądaniem: konto, ustawienia, konfiguracja i dzisiejszy dzień.
 * Wcześniej ekran „Dziś” wysyłał 8 osobnych żądań, a lista wpisów czekała dodatkowo
 * na ustawienia (strefa czasowa). Tu serwer zna strefę, więc wszystko wraca naraz.
 */
export const bootstrapRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const userId = c.get('userId')
  const [user, [settings]] = await Promise.all([
    currentUser(userId),
    db.select().from(t.userSettings).where(eq(t.userSettings.userId, userId)),
  ])
  if (!settings) throw notFound()
  const today = todayIn(settings.timezone)
  const [types, scale, projects, templates, entries, paused, [running]] =
    await Promise.all([
      db
        .select()
        .from(t.taskTypes)
        .where(eq(t.taskTypes.userId, userId))
        .orderBy(asc(t.taskTypes.sortOrder)),
      db
        .select()
        .from(t.storyPointScale)
        .where(eq(t.storyPointScale.userId, userId))
        .orderBy(asc(t.storyPointScale.points)),
      db
        .select()
        .from(t.projects)
        .where(eq(t.projects.userId, userId))
        .orderBy(asc(t.projects.name)),
      db
        .select()
        .from(t.quickTemplates)
        .where(eq(t.quickTemplates.userId, userId))
        .orderBy(asc(t.quickTemplates.sortOrder)),
      entriesOn(db, userId, today),
      pausedOn(db, userId, today),
      db
        .select()
        .from(t.timeEntries)
        .where(
          and(
            eq(t.timeEntries.userId, userId),
            eq(t.timeEntries.running, true),
          ),
        ),
    ])
  return c.json({
    user: toUser(user),
    settings: toSettings(settings),
    taskTypes: types.map(toTaskType),
    scale: scale.map(toScaleStep),
    projects: projects.map(toProject),
    templates: templates.map(toTemplate),
    today,
    entries: entries.map(toEntry),
    paused: paused.map(toEntry),
    running: running ? toEntry(running) : null,
  })
})
