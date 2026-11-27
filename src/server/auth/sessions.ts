import type { refreshTokens } from '../db/schema'

type Row = Pick<
  typeof refreshTokens.$inferSelect,
  'familyId' | 'userAgent' | 'ip' | 'createdAt' | 'revokedAt' | 'expiresAt'
>

export interface ActiveSession {
  id: string
  userAgent: string | null
  ip: string | null
  startedAt: string
  lastActiveAt: string
  current: boolean
}

/**
 * Aktywne sesje = rodziny refresh tokenów, których najnowszy token nie jest unieważniony
 * ani przeterminowany. Start rodziny to logowanie, najnowszy token to ostatnia aktywność.
 * Bieżące urządzenie pierwsze, potem od ostatnio używanego.
 */
export function activeSessions(
  rows: ReadonlyArray<Row>,
  currentFamily: string | null,
  now = new Date(),
): Array<ActiveSession> {
  const families = new Map<string, Array<Row>>()
  for (const row of rows) {
    const list = families.get(row.familyId)
    if (list) list.push(row)
    else families.set(row.familyId, [row])
  }
  const result: Array<ActiveSession> = []
  for (const [id, list] of families) {
    const sorted = [...list].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )
    const latest = sorted.at(-1)!
    if (latest.revokedAt || latest.expiresAt <= now) continue
    result.push({
      id,
      userAgent: latest.userAgent,
      ip: latest.ip,
      startedAt: sorted[0]!.createdAt.toISOString(),
      lastActiveAt: latest.createdAt.toISOString(),
      current: id === currentFamily,
    })
  }
  return result.sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      b.lastActiveAt.localeCompare(a.lastActiveAt),
  )
}
