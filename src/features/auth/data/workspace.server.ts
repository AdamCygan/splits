import type { Locale } from '#/i18n/config'
import type { Tx } from '#/server/db/client'
import * as t from '#/server/db/schema'
import { seedWorkspace } from '#/server/seed-data'

/** Zapisuje dane startowe nowego konta (te same, które widział tryb demo). */
export async function createWorkspace(
  tx: Tx,
  userId: string,
  locale: Locale,
  timezone: string,
  withSamples = false,
) {
  const ws = seedWorkspace(locale, withSamples, timezone)
  const own = <T extends object>(rows: Array<T>) =>
    rows.map((r) => ({ ...r, userId }))

  await tx.insert(t.userSettings).values({ userId, ...ws.settings })
  await tx.insert(t.storyPointScale).values(own(ws.spScale))
  await tx.insert(t.taskTypes).values(
    own(ws.taskTypes).map((x) => ({
      ...x,
      archivedAt: x.archivedAt ? new Date(x.archivedAt) : null,
    })),
  )
  await tx.insert(t.taskStatuses).values(
    own(ws.statuses).map((x) => ({
      ...x,
      archivedAt: x.archivedAt ? new Date(x.archivedAt) : null,
    })),
  )
  if (ws.cadence)
    await tx.insert(t.sprintCadences).values({ userId, ...ws.cadence })
  if (ws.projects.length)
    await tx.insert(t.projects).values(
      own(ws.projects).map((x) => ({
        ...x,
        archivedAt: x.archivedAt ? new Date(x.archivedAt) : null,
      })),
    )
  if (ws.tags.length) await tx.insert(t.tags).values(own(ws.tags))
  if (ws.templates.length)
    await tx.insert(t.quickTemplates).values(own(ws.templates))
  const entries = ws.entries ?? []
  if (entries.length)
    await tx.insert(t.timeEntries).values(
      own(entries).map((e) => ({
        ...e,
        startedAt: e.startedAt ? new Date(e.startedAt) : null,
        createdAt: new Date(e.createdAt),
        finishedAt: e.finishedAt ? new Date(e.finishedAt) : null,
      })),
    )
}
