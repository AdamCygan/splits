import { afterEach, describe, expect, it } from 'vitest'
import { outbox } from '#/server/email'
import { serverEnv } from '#/server/env'
import { client, registered, registeredAdmin } from './helpers'

interface Report {
  id: string
  kind: string
  message: string
  page: string | null
  status: string
  reply: string | null
}

interface AdminReport extends Report {
  note: string | null
  userAgent: string | null
  user: { email: string; plan: string }
}

interface Inbox {
  items: Array<AdminReport>
  total: number
  open: { new: number; inProgress: number }
}

const report = {
  kind: 'bug',
  message: 'The timer stops when I switch tabs.',
  page: '/app/tasks?token=secret#top',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
}

afterEach(() => serverEnv.adminEmails.clear())

describe('feedback from the app', () => {
  it('Should save a report without query strings and show it to its author only', async () => {
    const { c } = await registered()
    const sent = await c.post<Report>('/feedback', report)
    expect(sent.status).toBe(201)
    expect(sent.body).toMatchObject({
      kind: 'bug',
      page: '/app/tasks',
      status: 'new',
      reply: null,
    })

    const mine = await c.get<Array<Report>>('/feedback')
    expect(mine.body.map((r) => r.id)).toEqual([sent.body.id])

    const { c: other } = await registered()
    expect((await other.get<Array<Report>>('/feedback')).body).toEqual([])
  })

  it.each<[string, Record<string, unknown>]>([
    ['a too short message', { ...report, message: 'hey' }],
    ['an unknown kind', { ...report, kind: 'rant' }],
  ])('Should reject %s', async (_, body) => {
    const { c } = await registered()
    expect((await c.post('/feedback', body)).status).toBe(400)
  })

  it('Should need a signed-in user', async () => {
    expect((await client().post('/feedback', report)).status).toBe(401)
  })

  it('Should e-mail the app owners about a new report', async () => {
    const owner = await registered()
    serverEnv.adminEmails.add(owner.email)
    const { c, email } = await registered()
    await c.post('/feedback', report)
    const mail = [...outbox].reverse().find((m) => m.to === owner.email)
    expect(mail?.subject).toContain('bug')
    expect(mail?.text).toContain(email)
    expect(mail?.text).toContain(report.message)
  })
})

describe('feedback inbox (admin)', () => {
  it('Should list reports, change status and e-mail the reply to the author', async () => {
    const admin = await registeredAdmin()
    const { c, email } = await registered()
    const sent = await c.post<Report>('/feedback', report)

    const inbox = await admin.c.get<Inbox>('/admin/feedback?status=open')
    const row = inbox.body.items.find((r) => r.id === sent.body.id)
    expect(row).toMatchObject({
      user: { email, plan: 'free' },
      userAgent: report.userAgent,
    })
    expect(inbox.body.open.new).toBeGreaterThan(0)

    const updated = await admin.c.patch<AdminReport>(
      `/admin/feedback/${sent.body.id}`,
      {
        status: 'done',
        reply: 'Fixed in today’s release, thanks!',
        note: 'Visibility change handler',
      },
    )
    expect(updated.body).toMatchObject({
      status: 'done',
      note: expect.any(String),
    })

    const reply = [...outbox].reverse().find((m) => m.to === email)
    expect(reply?.text).toContain('Fixed in today’s release')

    const mine = await c.get<Array<Report & { note?: unknown }>>('/feedback')
    expect(mine.body[0]).toMatchObject({
      status: 'done',
      reply: 'Fixed in today’s release, thanks!',
    })
    expect(mine.body[0]).not.toHaveProperty('note')

    const authorId = (await c.get<{ id: string }>('/account')).body.id
    const log = await admin.c.get<{ items: Array<{ action: string }> }>(
      `/admin/actions?targetId=${authorId}`,
    )
    expect(log.body.items.map((a) => a.action)).toEqual(
      expect.arrayContaining(['feedback.updated', 'feedback.replied']),
    )
  })

  it('Should keep the inbox for admins only', async () => {
    const { c } = await registered()
    expect((await c.get('/admin/feedback')).status).toBe(403)
  })
})
