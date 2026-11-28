import { inScope } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'
import { and, asc, eq } from 'drizzle-orm'

import { todayIn } from '#/shared/domain/dates'

import { db } from '#/server/db/client'

import * as t from '#/server/db/schema'

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
    readSettings(db, scope),
    getWorkspaceState(scope),
  ])
  const today = todayIn(settings.timezone)
  const [types, scale, projects, templates, entries, paused, [running]] =
    await Promise.all([
      db
        .select()
        .from(t.taskTypes)
        .where(inScope(t.taskTypes, scope))
        .orderBy(asc(t.taskTypes.sortOrder)),
      db
        .select()
        .from(t.storyPointScale)
        .where(inScope(t.storyPointScale, scope))
        .orderBy(asc(t.storyPointScale.points)),
      db
        .select()
        .from(t.projects)
        .where(inScope(t.projects, scope))
        .orderBy(asc(t.projects.name)),
      db
        .select()
        .from(t.quickTemplates)
        .where(inScope(t.quickTemplates, scope))
        .orderBy(asc(t.quickTemplates.sortOrder)),
      entriesOn(db, scope, today),
      pausedOn(db, scope, today),
      // Jeden timer na konto: może działać w innej przestrzeni niż bieżąca.
      db
        .select()
        .from(t.timeEntries)
        .where(
          and(
            eq(t.timeEntries.userId, scope.userId),
            eq(t.timeEntries.running, true),
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
