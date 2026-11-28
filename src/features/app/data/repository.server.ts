import { inScope } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { and, asc, eq } from 'drizzle-orm'

import { todayIn } from '#/shared/domain/dates'

import { database } from '#/server/db/client'

import * as schema from '#/server/db/schema'

import { currentUser } from '#/features/account/data/repository.server'

import { toEntry } from '#/features/time-entries/data/mappers.server'

import { toProject } from '#/features/projects/data/mappers.server'

import { toScaleStep } from '#/features/story-points/data/mappers.server'

import { readSettings } from '#/features/settings/data/repository.server'
import { getWorkspaceState } from '#/features/workspaces/data/repository.server'

import { toTaskType } from '#/features/task-types/data/mappers.server'

import { toTemplate } from '#/features/templates/data/mappers.server'

import { toUser } from '#/features/auth/data/mappers.server'

import {
  entriesOn,
  pausedOn,
} from '#/features/time-entries/data/repository.server'

export async function getBootstrap(scope: Scope) {
  const [user, settings, workspaces] = await Promise.all([
    currentUser(scope.userId),
    readSettings(database, scope),
    getWorkspaceState(scope),
  ])
  const today = todayIn(settings.timezone)
  const [types, scale, projects, templates, entries, paused, [running]] =
    await Promise.all([
      database
        .select()
        .from(schema.taskTypes)
        .where(inScope(schema.taskTypes, scope))
        .orderBy(asc(schema.taskTypes.sortOrder)),
      database
        .select()
        .from(schema.storyPointScale)
        .where(inScope(schema.storyPointScale, scope))
        .orderBy(asc(schema.storyPointScale.points)),
      database
        .select()
        .from(schema.projects)
        .where(inScope(schema.projects, scope))
        .orderBy(asc(schema.projects.name)),
      database
        .select()
        .from(schema.quickTemplates)
        .where(inScope(schema.quickTemplates, scope))
        .orderBy(asc(schema.quickTemplates.sortOrder)),
      entriesOn(database, scope, today),
      pausedOn(database, scope, today),
      // Jeden timer na konto: może działać w innej przestrzeni niż bieżąca.
      database
        .select()
        .from(schema.timeEntries)
        .where(
          and(
            eq(schema.timeEntries.userId, scope.userId),
            eq(schema.timeEntries.running, true),
          ),
        ),
    ])
  const here = running?.workspaceId === scope.workspaceId
  return {
    user: toUser(user),
    settings,
    workspaces,
    taskTypes: types.map(toTaskType),
    scale: scale.map(toScaleStep),
    projects: projects.map(toProject),
    templates: templates.map(toTemplate),
    today,
    entries: entries.map(toEntry),
    paused: paused.map(toEntry),
    running: running && here ? toEntry(running) : null,
    runningElsewhere:
      running && !here
        ? { workspaceId: running.workspaceId, entry: toEntry(running) }
        : null,
  }
}
