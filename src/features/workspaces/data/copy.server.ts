import { eq, sql } from 'drizzle-orm'
import { syncCadenceSprints } from '#/features/sprints/data/repository.server'
import type { CopyKind } from '#/features/workspaces/domain/workspaces'
import type { Tx } from '#/server/db/client'
import { lowerName } from '#/server/db/helpers'
import * as t from '#/server/db/schema'
import { inScope, owner } from '#/server/db/scope'
import type { Scope } from '#/server/db/scope'

/**
 * Kopiowanie między przestrzeniami konta. Kopia łączy się z tym, co już jest w docelowej:
 * ten sam element (ten sam sync_id albo, dla elementów z nazwą, ta sama nazwa) dostaje dane
 * ze źródła i wspólny sync_id, a brakujące powstają. Nic w docelowej nie jest usuwane,
 * poza skalą SP, którą zastępuje skala źródła.
 */
export async function copyInto(
  tx: Tx,
  from: Scope,
  to: Scope,
  kinds: ReadonlyArray<CopyKind>,
) {
  const has = (k: CopyKind) => kinds.includes(k)
  if (has('workTypes')) await copyTaskTypes(tx, from, to)
  if (has('statuses')) await copyStatuses(tx, from, to)
  if (has('tags')) await copyTags(tx, from, to)
  if (has('storyPoints')) await copyScale(tx, from, to)
  if (has('workday')) await copyWorkday(tx, from, to)
  if (has('templates')) await copyTemplates(tx, from, to)
  if (has('daysOff')) await copyDaysOff(tx, from, to)
  if (has('sprints')) await copySprints(tx, from, to)
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
    rows.find((r) => r.syncId === source.syncId) ??
    rows.find((r) => lowerName(r.name) === lowerName(source.name)) ??
    null
  )
}

/** Mapa id rodzaju pracy: źródło → docelowa przestrzeń (bez zmian w docelowej). */
export async function taskTypeMap(tx: Tx, from: Scope, to: Scope) {
  const [source, target] = await Promise.all([
    tx.select().from(t.taskTypes).where(inScope(t.taskTypes, from)),
    tx.select().from(t.taskTypes).where(inScope(t.taskTypes, to)),
  ])
  const map = new Map<string, string>()
  for (const s of source) {
    const match = findCounterpart(target, s)
    if (match) map.set(s.id, match.id)
  }
  return map
}

async function copyTaskTypes(tx: Tx, from: Scope, to: Scope) {
  const [source, target] = await Promise.all([
    tx.select().from(t.taskTypes).where(inScope(t.taskTypes, from)),
    tx.select().from(t.taskTypes).where(inScope(t.taskTypes, to)),
  ])
  for (const s of source) {
    const { id: _id, userId: _u, workspaceId: _w, createdAt: _c, ...data } = s
    const match = findCounterpart(target, s)
    if (match)
      await tx.update(t.taskTypes).set(data).where(eq(t.taskTypes.id, match.id))
    else await tx.insert(t.taskTypes).values({ ...data, ...owner(to) })
  }
}

async function copyStatuses(tx: Tx, from: Scope, to: Scope) {
  const [source, target] = await Promise.all([
    tx.select().from(t.taskStatuses).where(inScope(t.taskStatuses, from)),
    tx.select().from(t.taskStatuses).where(inScope(t.taskStatuses, to)),
  ])
  // Status domyślny jest jeden na przestrzeń: przejmuje go odpowiednik domyślnego ze źródła.
  if (source.some((s) => s.isDefault))
    await tx
      .update(t.taskStatuses)
      .set({ isDefault: false })
      .where(inScope(t.taskStatuses, to))
  for (const s of source) {
    const { id: _id, userId: _u, workspaceId: _w, ...data } = s
    const match = findCounterpart(target, s)
    if (match)
      await tx
        .update(t.taskStatuses)
        .set(data)
        .where(eq(t.taskStatuses.id, match.id))
    else await tx.insert(t.taskStatuses).values({ ...data, ...owner(to) })
  }
}

async function copyTags(tx: Tx, from: Scope, to: Scope) {
  const [source, target] = await Promise.all([
    tx.select().from(t.tags).where(inScope(t.tags, from)),
    tx.select().from(t.tags).where(inScope(t.tags, to)),
  ])
  for (const s of source) {
    const { id: _id, userId: _u, workspaceId: _w, ...data } = s
    const match = findCounterpart(target, s)
    if (match) await tx.update(t.tags).set(data).where(eq(t.tags.id, match.id))
    else await tx.insert(t.tags).values({ ...data, ...owner(to) })
  }
}

async function copyScale(tx: Tx, from: Scope, to: Scope) {
  const source = await tx
    .select()
    .from(t.storyPointScale)
    .where(inScope(t.storyPointScale, from))
  await tx.delete(t.storyPointScale).where(inScope(t.storyPointScale, to))
  if (source.length)
    await tx.insert(t.storyPointScale).values(
      source.map((s) => ({
        points: s.points,
        maxMinutes: s.maxMinutes,
        ...owner(to),
      })),
    )
}

async function copyWorkday(tx: Tx, from: Scope, to: Scope) {
  const [source] = await tx
    .select()
    .from(t.workspaceSettings)
    .where(eq(t.workspaceSettings.workspaceId, from.workspaceId))
  if (!source) return
  const { workspaceId: _w, userId: _u, updatedAt: _a, ...data } = source
  await tx
    .update(t.workspaceSettings)
    .set(data)
    .where(eq(t.workspaceSettings.workspaceId, to.workspaceId))
  await syncCadenceSprints(tx, to)
}

/**
 * Szablony: rodzaj pracy przechodzi na odpowiednik w docelowej przestrzeni (bez niego szablon
 * jest pomijany), projekt nie (projekty są osobne), a zajęty skrót zostaje pusty.
 */
async function copyTemplates(tx: Tx, from: Scope, to: Scope) {
  const [source, target, types] = await Promise.all([
    tx.select().from(t.quickTemplates).where(inScope(t.quickTemplates, from)),
    tx.select().from(t.quickTemplates).where(inScope(t.quickTemplates, to)),
    taskTypeMap(tx, from, to),
  ])
  const hotkeys = new Set(target.map((x) => x.hotkey).filter((h) => h !== null))
  let order = target.length
  for (const s of source) {
    const taskTypeId = types.get(s.taskTypeId)
    if (!taskTypeId) continue
    const match = target.find((x) => lowerName(x.label) === lowerName(s.label))
    const data = {
      taskTypeId,
      projectId: null,
      askProject: s.askProject || s.projectId !== null,
      label: s.label,
      title: s.title,
      storyPoints: s.storyPoints,
      defaultDurationMinutes: s.defaultDurationMinutes,
      schedule: s.schedule,
    }
    if (match) {
      await tx
        .update(t.quickTemplates)
        .set(data)
        .where(eq(t.quickTemplates.id, match.id))
      continue
    }
    const hotkey = s.hotkey !== null && !hotkeys.has(s.hotkey) ? s.hotkey : null
    if (hotkey !== null) hotkeys.add(hotkey)
    await tx
      .insert(t.quickTemplates)
      .values({ ...data, hotkey, sortOrder: order++, ...owner(to) })
  }
}

async function copyDaysOff(tx: Tx, from: Scope, to: Scope) {
  const source = await tx
    .select()
    .from(t.daysOff)
    .where(inScope(t.daysOff, from))
  if (source.length === 0) return
  await tx
    .insert(t.daysOff)
    .values(
      source.map((s) => ({
        date: s.date,
        kind: s.kind,
        note: s.note,
        ...owner(to),
      })),
    )
    .onConflictDoUpdate({
      target: [t.daysOff.workspaceId, t.daysOff.date],
      set: { kind: sql`excluded.kind`, note: sql`excluded.note` },
    })
}

/**
 * Sprinty: kadencja zastępuje kadencję docelowej, a sprinty łączą się po sync_id albo po
 * tych samych datach. Cele czasowe przechodzą na odpowiadające rodzaje pracy.
 */
async function copySprints(tx: Tx, from: Scope, to: Scope) {
  const [[cadence], source, target, types] = await Promise.all([
    tx.select().from(t.sprintCadences).where(inScope(t.sprintCadences, from)),
    tx.select().from(t.sprints).where(inScope(t.sprints, from)),
    tx.select().from(t.sprints).where(inScope(t.sprints, to)),
    taskTypeMap(tx, from, to),
  ])
  await tx.delete(t.sprintCadences).where(inScope(t.sprintCadences, to))
  if (cadence) {
    const { workspaceId: _w, userId: _u, ...data } = cadence
    await tx.insert(t.sprintCadences).values({ ...data, ...owner(to) })
  }
  for (const s of source) {
    const { id: _id, userId: _u, workspaceId: _w, ...data } = s
    const values = {
      ...data,
      timeGoals: s.timeGoals.flatMap((g) => {
        const id = types.get(g.taskTypeId)
        return id ? [{ ...g, taskTypeId: id }] : []
      }),
    }
    const match =
      target.find((x) => x.syncId === s.syncId) ??
      target.find((x) => x.startsOn === s.startsOn && x.endsOn === s.endsOn)
    if (match)
      await tx.update(t.sprints).set(values).where(eq(t.sprints.id, match.id))
    else await tx.insert(t.sprints).values({ ...values, ...owner(to) })
  }
  await syncCadenceSprints(tx, to)
}
