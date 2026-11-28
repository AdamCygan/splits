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
  .get('/', async (context) =>
    context.json(await listMyFeedback(context.get('userId'))),
  )
  .post('/', async (context) => {
    const userId = context.get('userId')
    rateLimit(`feedback:${userId}`, 10, 60 * 60_000)
    const input = await body(context, feedbackInput)
    return context.json(await createFeedback(userId, input), 201)
  })

/** Skrzynka zgłoszeń w panelu admina (/api/v1/admin/feedback; dostęp pilnuje requireAdmin). */
export const adminFeedbackRoutes = new Hono<AppEnv>()
  .get('/feedback', async (context) => {
    const filter = parse(adminFeedbackFilterInput, context.req.query())
    return context.json(await listFeedback(filter))
  })
  .patch('/feedback/:id', async (context) => {
    const change = await body(context, adminFeedbackChangeInput)
    return context.json(
      await updateFeedback(
        context.get('admin')!,
        context.req.param('id'),
        change,
      ),
    )
  })
