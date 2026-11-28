import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { body, parse } from '#/server/http/inputs'
import { rateLimit } from '#/server/http/rate-limit'
import {
  adminFeedbackChangeInput,
  adminFeedbackFilterInput,
  feedbackInput,
} from '../data/inputs.server'
import {
  createFeedback,
  listFeedback,
  listMyFeedback,
  updateFeedback,
} from '../data/repository.server'

/** Zgłoszenia użytkownika (/api/v1/feedback). */
export const feedbackRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await listMyFeedback(c.get('userId'))))
  .post('/', async (c) => {
    const userId = c.get('userId')
    rateLimit(`feedback:${userId}`, 10, 60 * 60_000)
    const input = await body(c, feedbackInput)
    return c.json(await createFeedback(userId, input), 201)
  })

/** Skrzynka zgłoszeń w panelu admina (/api/v1/admin/feedback; dostęp pilnuje requireAdmin). */
export const adminFeedbackRoutes = new Hono<AppEnv>()
  .get('/feedback', async (c) => {
    const filter = parse(adminFeedbackFilterInput, c.req.query())
    return c.json(await listFeedback(filter))
  })
  .patch('/feedback/:id', async (c) => {
    const change = await body(c, adminFeedbackChangeInput)
    return c.json(
      await updateFeedback(c.get('admin')!, c.req.param('id'), change),
    )
  })
