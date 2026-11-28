import { and, asc, eq } from 'drizzle-orm'

import { todayIn } from '#/shared/domain/dates'

import { db } from '#/server/db/client'

import * as t from '#/server/db/schema'

import { notFound } from '#/server/http/errors'

import { currentUser } from '#/features/account/data/repository.server'

import { toEntry } from '#/features/time-entries/data/mappers.server'

import { toProject } from '#/features/projects/data/mappers.server'

import { toScaleStep } from '#/features/story-points/data/mappers.server'

import { toSettings } from '#/features/settings/data/mappers.server'

import { toTaskType } from '#/features/task-types/data/mappers.server'

import { toTemplate } from '#/features/templates/data/mappers.server'

import { toUser } from '#/features/auth/data/mappers.server'

import {
  entriesOn,
  pausedOn,
} from '#/features/time-entries/data/repository.server'

export async function getBootstrap(userId: string) {
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
  return {
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
  }
}
