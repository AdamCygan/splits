import { eq, sql } from 'drizzle-orm'
import { syncCadenceSprints } from '#/features/sprints/data/repository.server'
import type { CopyKind } from '#/features/workspaces/domain/workspaces'
import type { Tx } from '#/server/db/client'
import { lowerName } from '#/server/db/helpers'
import * as schema from '#/server/db/schema'
import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'

/**
 * Kopiowanie między przestrzeniami konta. Kopia łączy się z tym, co już jest w docelowej:
 * ten sam element (ten sam sync_id albo, dla elementów z nazwą, ta sama nazwa) dostaje dane
 * ze źródła i wspólny sync_id, a brakujące powstają. Nic w docelowej nie jest usuwane,
 * poza skalą SP, którą zastępuje skala źródła.
 */
export async function copyInto(
  transaction: Tx,
  from: Scope,
  to: Scope,
  kinds: ReadonlyArray<CopyKind>,
) {
  const has = (copyKind: CopyKind) => kinds.includes(copyKind)
  if (has('workTypes')) await copyTaskTypes(transaction, from, to)
  if (has('statuses')) await copyStatuses(transaction, from, to)
  if (has('tags')) await copyTags(transaction, from, to)
  if (has('storyPoints')) await copyScale(transaction, from, to)
  if (has('workday')) await copyWorkday(transaction, from, to)
  if (has('templates')) await copyTemplates(transaction, from, to)
  if (has('daysOff')) await copyDaysOff(transaction, from, to)
  if (has('sprints')) await copySprints(transaction, from, to)
}

interface Named {
  id: string
  syncId: string
  name: string
}

interface SyncKey {
  syncId: string
  name: string
}

/** Odpowiednik elementu w docelowej przestrzeni: po sync_id, a gdy go nie ma, po nazwie. */
export function findCounterpart<T extends Named>(
  rows: ReadonlyArray<T>,
  source: SyncKey,
) {
  return (
    rows.find((named) => named.syncId === source.syncId) ??
    rows.find((named) => lowerName(named.name) === lowerName(source.name)) ??
    null
  )
}

/** Mapa id rodzaju pracy: źródło → docelowa przestrzeń (bez zmian w docelowej). */
export async function taskTypeMap(transaction: Tx, from: Scope, to: Scope) {
  const [source, target] = await Promise.all([
    transaction
      .select()
      .from(schema.taskTypes)
      .where(inScope(schema.taskTypes, from)),
    transaction
      .select()
      .from(schema.taskTypes)
      .where(inScope(schema.taskTypes, to)),
  ])
  const map = new Map<string, string>()
  for (const sourceRows of source) {
    const match = findCounterpart(target, sourceRows)
    if (match) map.set(sourceRows.id, match.id)
  }
  return map
}

async function copyTaskTypes(transaction: Tx, from: Scope, to: Scope) {
  const [source, target] = await Promise.all([
    transaction
      .select()
      .from(schema.taskTypes)
      .where(inScope(schema.taskTypes, from)),
    transaction
      .select()
      .from(schema.taskTypes)
      .where(inScope(schema.taskTypes, to)),
  ])
  for (const sourceRows of source) {
    const {
      id: _id,
      userId: _userId,
      workspaceId: _workspaceId,
      createdAt: _createdAt,
      ...data
    } = sourceRows
    const match = findCounterpart(target, sourceRows)
    if (match)
      await transaction
        .update(schema.taskTypes)
        .set(data)
        .where(eq(schema.taskTypes.id, match.id))
    else
      await transaction
        .insert(schema.taskTypes)
        .values({ ...data, ...owner(to) })
  }
}

async function copyStatuses(transaction: Tx, from: Scope, to: Scope) {
  const [source, target] = await Promise.all([
    transaction
      .select()
      .from(schema.taskStatuses)
      .where(inScope(schema.taskStatuses, from)),
    transaction
      .select()
      .from(schema.taskStatuses)
      .where(inScope(schema.taskStatuses, to)),
  ])
  // Status domyślny jest jeden na przestrzeń: przejmuje go odpowiednik domyślnego ze źródła.
  if (source.some((sourceRow) => sourceRow.isDefault))
    await transaction
      .update(schema.taskStatuses)
      .set({ isDefault: false })
      .where(inScope(schema.taskStatuses, to))
  for (const sourceRows of source) {
    const {
      id: _id,
      userId: _userId,
      workspaceId: _workspaceId,
      ...data
    } = sourceRows
    const match = findCounterpart(target, sourceRows)
    if (match)
      await transaction
        .update(schema.taskStatuses)
        .set(data)
        .where(eq(schema.taskStatuses.id, match.id))
    else
      await transaction
        .insert(schema.taskStatuses)
        .values({ ...data, ...owner(to) })
  }
}

async function copyTags(transaction: Tx, from: Scope, to: Scope) {
  const [source, target] = await Promise.all([
    transaction.select().from(schema.tags).where(inScope(schema.tags, from)),
    transaction.select().from(schema.tags).where(inScope(schema.tags, to)),
  ])
  for (const sourceRows of source) {
    const {
      id: _id,
      userId: _userId,
      workspaceId: _workspaceId,
      ...data
    } = sourceRows
    const match = findCounterpart(target, sourceRows)
    if (match)
      await transaction
        .update(schema.tags)
        .set(data)
        .where(eq(schema.tags.id, match.id))
    else await transaction.insert(schema.tags).values({ ...data, ...owner(to) })
  }
}

async function copyScale(transaction: Tx, from: Scope, to: Scope) {
  const source = await transaction
    .select()
    .from(schema.storyPointScale)
    .where(inScope(schema.storyPointScale, from))
  await transaction
    .delete(schema.storyPointScale)
    .where(inScope(schema.storyPointScale, to))
  if (source.length)
    await transaction.insert(schema.storyPointScale).values(
      source.map((sourceRow) => ({
        points: sourceRow.points,
        maxMinutes: sourceRow.maxMinutes,
        ...owner(to),
      })),
    )
}

async function copyWorkday(transaction: Tx, from: Scope, to: Scope) {
  const [source] = await transaction
    .select()
    .from(schema.workspaceSettings)
    .where(eq(schema.workspaceSettings.workspaceId, from.workspaceId))
  if (!source) return
  const {
    workspaceId: _workspaceId,
    userId: _userId,
    updatedAt: _updatedAt,
    ...data
  } = source
  await transaction
    .update(schema.workspaceSettings)
    .set(data)
    .where(eq(schema.workspaceSettings.workspaceId, to.workspaceId))
  await syncCadenceSprints(transaction, to)
}

/**
 * Szablony: rodzaj pracy przechodzi na odpowiednik w docelowej przestrzeni (bez niego szablon
 * jest pomijany), projekt nie (projekty są osobne), a zajęty skrót zostaje pusty.
 */
async function copyTemplates(transaction: Tx, from: Scope, to: Scope) {
  const [source, target, types] = await Promise.all([
    transaction
      .select()
      .from(schema.quickTemplates)
      .where(inScope(schema.quickTemplates, from)),
    transaction
      .select()
      .from(schema.quickTemplates)
      .where(inScope(schema.quickTemplates, to)),
    taskTypeMap(transaction, from, to),
  ])
  const hotkeys = new Set(
    target
      .map((targetRow) => targetRow.hotkey)
      .filter((hotkey) => hotkey !== null),
  )
  let order = target.length
  for (const sourceRows of source) {
    const taskTypeId = types.get(sourceRows.taskTypeId)
    if (!taskTypeId) continue
    const match = target.find(
      (targetRow) => lowerName(targetRow.label) === lowerName(sourceRows.label),
    )
    const data = {
      taskTypeId,
      projectId: null,
      askProject: sourceRows.askProject || sourceRows.projectId !== null,
      label: sourceRows.label,
      title: sourceRows.title,
      storyPoints: sourceRows.storyPoints,
      defaultDurationMinutes: sourceRows.defaultDurationMinutes,
      schedule: sourceRows.schedule,
    }
    if (match) {
      await transaction
        .update(schema.quickTemplates)
        .set(data)
        .where(eq(schema.quickTemplates.id, match.id))
      continue
    }
    const hotkey =
      sourceRows.hotkey !== null && !hotkeys.has(sourceRows.hotkey)
        ? sourceRows.hotkey
        : null
    if (hotkey !== null) hotkeys.add(hotkey)
    await transaction
      .insert(schema.quickTemplates)
      .values({ ...data, hotkey, sortOrder: order++, ...owner(to) })
  }
}

async function copyDaysOff(transaction: Tx, from: Scope, to: Scope) {
  const source = await transaction
    .select()
    .from(schema.daysOff)
    .where(inScope(schema.daysOff, from))
  if (source.length === 0) return
  await transaction
    .insert(schema.daysOff)
    .values(
      source.map((sourceRow) => ({
        date: sourceRow.date,
        kind: sourceRow.kind,
        note: sourceRow.note,
        ...owner(to),
      })),
    )
    .onConflictDoUpdate({
      target: [schema.daysOff.workspaceId, schema.daysOff.date],
      set: { kind: sql`excluded.kind`, note: sql`excluded.note` },
    })
}

/**
 * Sprinty: kadencja zastępuje kadencję docelowej, a sprinty łączą się po sync_id albo po
 * tych samych datach. Cele czasowe przechodzą na odpowiadające rodzaje pracy.
 */
async function copySprints(transaction: Tx, from: Scope, to: Scope) {
  const [[cadence], source, target, types] = await Promise.all([
    transaction
      .select()
      .from(schema.sprintCadences)
      .where(inScope(schema.sprintCadences, from)),
    transaction
      .select()
      .from(schema.sprints)
      .where(inScope(schema.sprints, from)),
    transaction
      .select()
      .from(schema.sprints)
      .where(inScope(schema.sprints, to)),
    taskTypeMap(transaction, from, to),
  ])
  await transaction
    .delete(schema.sprintCadences)
    .where(inScope(schema.sprintCadences, to))
  if (cadence) {
    const { workspaceId: _workspaceId, userId: _userId, ...data } = cadence
    await transaction
      .insert(schema.sprintCadences)
      .values({ ...data, ...owner(to) })
  }
  for (const sourceRows of source) {
    const {
      id: _id,
      userId: _userId,
      workspaceId: _workspaceId,
      ...data
    } = sourceRows
    const values = {
      ...data,
      timeGoals: sourceRows.timeGoals.flatMap((sprintTimeGoal) => {
        const id = types.get(sprintTimeGoal.taskTypeId)
        return id ? [{ ...sprintTimeGoal, taskTypeId: id }] : []
      }),
    }
    const match =
      target.find((targetRow) => targetRow.syncId === sourceRows.syncId) ??
      target.find(
        (targetRow) =>
          targetRow.startsOn === sourceRows.startsOn &&
          targetRow.endsOn === sourceRows.endsOn,
      )
    if (match)
      await transaction
        .update(schema.sprints)
        .set(values)
        .where(eq(schema.sprints.id, match.id))
    else
      await transaction
        .insert(schema.sprints)
        .values({ ...values, ...owner(to) })
  }
  await syncCadenceSprints(transaction, to)
}
