import { describe, expect, it } from 'vitest'
import { todayIn } from '#/domain/dates'
import { MAX_BODY_BYTES, readBody } from '#/server/http/body-limit'
import { client, registered } from './helpers'

interface Problem {
  code: string
  errors: Record<string, Array<string>>
}
interface TaskType {
  id: string
  kind: string
  storyPointsRequirement: string
}

async function entryWithLink(link: string) {
  const { c } = await registered()
  const types = await c.get<Array<TaskType>>('/task-types')
  const task = types.body.find((x) => x.kind === 'task')!
  return c.post<Problem>('/time-entries', {
    taskTypeId: task.id,
    projectId: null,
    title: 'Linked task',
    link,
    storyPoints: task.storyPointsRequirement === 'required' ? 2 : null,
    workDate: todayIn('Europe/Warsaw'),
    startTime: null,
    endTime: null,
    durationMinutes: 30,
    note: null,
    running: false,
  })
}

describe('API hardening', () => {
  it('Should send headers that stop the JSON from being run, framed or cached', async () => {
    const res = await client().get('/meta')
    expect(res.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    )
    expect(res.headers.get('strict-transport-security')).toBe(
      'max-age=63072000; includeSubDomains',
    )
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('Should refuse a request body over the limit before parsing it', async () => {
    const res = await client().post<Problem>('/auth/login', {
      login: 'x',
      password: 'x'.repeat(MAX_BODY_BYTES),
    })
    expect(res.status).toBe(413)
    expect(res.body.code).toBe('validation.too_large')
  })

  it('Should stop reading a streamed body without Content-Length at the limit', async () => {
    const chunk = new Uint8Array(64 * 1024)
    let sent = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += chunk.byteLength
        controller.enqueue(chunk)
      },
    })
    const request = new Request('http://localhost/x', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit)
    await expect(readBody(request)).rejects.toMatchObject({
      code: 'validation.too_large',
      status: 413,
    })
    expect(sent).toBeLessThan(MAX_BODY_BYTES * 2)
  })

  it.each([
    ['a foreign Origin', { Origin: 'https://evil.example.net' }],
    ['Sec-Fetch-Site: cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
  ])('Should refuse a session request with %s', async (_, headers) => {
    const res = await client().post('/auth/refresh', undefined, headers)
    expect(res.status).toBe(403)
  })

  it.each([
    'javascript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
  ])('Should reject the task link %s', async (link) => {
    const res = await entryWithLink(link)
    expect(res.status).toBe(400)
    expect(Object.keys(res.body.errors)).toEqual(['link'])
  })

  it('Should keep an https task link', async () => {
    const res = await entryWithLink('https://jira.example.com/browse/PH-1')
    expect(res.status).toBe(201)
  })
})
