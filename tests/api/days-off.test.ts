import { describe, expect, it } from 'vitest'
import { client, registered } from './helpers'

interface DayOff {
  date: string
  kind: string
  note: string | null
}

describe('days off', () => {
  it('Should mark a range on working days only and list it', async () => {
    const { apiClient } = await registered()
    // pt 13 – śr 18 listopada 2026: weekend 14–15 jest pomijany.
    const set = await apiClient.put<Array<DayOff>>('/days-off', {
      from: '2026-11-13',
      to: '2026-11-18',
      kind: 'vacation',
      note: '  Long weekend  ',
    })
    expect(set.status).toBe(200)
    expect(set.body.map((dayOff) => dayOff.date)).toEqual([
      '2026-11-13',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ])
    expect(set.body[0]).toMatchObject({
      kind: 'vacation',
      note: 'Long weekend',
    })

    // Zmiana rodzaju jednego dnia nadpisuje go zamiast dublować.
    await apiClient.put('/days-off', {
      from: '2026-11-18',
      to: '2026-11-18',
      kind: 'sick',
      note: null,
    })
    const list = await apiClient.get<Array<DayOff>>(
      '/days-off?from=2026-11-01&to=2026-11-30',
    )
    expect(list.body.map((dayOff) => `${dayOff.date}:${dayOff.kind}`)).toEqual([
      '2026-11-13:vacation',
      '2026-11-16:vacation',
      '2026-11-17:vacation',
      '2026-11-18:sick',
    ])

    // Jeden dzień w weekend też da się oznaczyć (np. dyżur odbierany w sobotę).
    const saturday = await apiClient.put<Array<DayOff>>('/days-off', {
      from: '2026-11-14',
      to: '2026-11-14',
      kind: 'other',
      note: null,
    })
    expect(saturday.body).toHaveLength(1)

    expect(
      (await apiClient.del('/days-off?from=2026-11-13&to=2026-11-16')).status,
    ).toBe(204)
    const after = await apiClient.get<Array<DayOff>>(
      '/days-off?from=2026-11-01&to=2026-11-30',
    )
    expect(after.body.map((dayOff) => dayOff.date)).toEqual([
      '2026-11-17',
      '2026-11-18',
    ])
  })

  it('Should validate the range and kind and keep users apart', async () => {
    const { apiClient } = await registered()
    const backwards = await apiClient.put('/days-off', {
      from: '2026-11-18',
      to: '2026-11-13',
      kind: 'vacation',
      note: null,
    })
    expect(backwards.status).toBe(400)
    const tooLong = await apiClient.put('/days-off', {
      from: '2026-01-01',
      to: '2027-06-01',
      kind: 'vacation',
      note: null,
    })
    expect(tooLong.status).toBe(400)
    const badKind = await apiClient.put('/days-off', {
      from: '2026-11-13',
      to: '2026-11-13',
      kind: 'party',
      note: null,
    })
    expect(badKind.status).toBe(400)

    await apiClient.put('/days-off', {
      from: '2026-12-24',
      to: '2026-12-24',
      kind: 'holiday',
      note: null,
    })
    const { apiClient: other } = await registered()
    const theirs = await other.get<Array<DayOff>>(
      '/days-off?from=2026-12-01&to=2026-12-31',
    )
    expect(theirs.body).toEqual([])
    expect(
      (await client().get('/days-off?from=2026-12-01&to=2026-12-31')).status,
    ).toBe(401)
  })
})
