import type { refreshTokens } from '#/server/db/schema'

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
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    )
    const latest = sorted.at(-1)!
    const isEnded = latest.revokedAt || latest.expiresAt <= now
    if (isEnded) continue
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
    (left, right) =>
      Number(right.current) - Number(left.current) ||
      right.lastActiveAt.localeCompare(left.lastActiveAt),
  )
}
