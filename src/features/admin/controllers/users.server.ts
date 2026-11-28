import {
  listUsers,
  exportUsers,
  getUserDetail,
  changeUser,
  revokeUserSessions,
  deleteUser,
  listInput,
  patchInput,
  deleteInput,
} from '../data/users.server'
import { Hono } from 'hono'
import type { AppEnv } from '#/server/http/context'
import { ApiError, invalid } from '#/server/http/errors'
import { body, parse } from '#/server/http/inputs'
import { isOwner } from '#/features/auth/data/repository.server'
import { findUser } from '../data/shared.server'
import { userFilterInput } from '../data/users-query.server'

export const userRoutes = new Hono<AppEnv>()
  .get('/users', async (context) => {
    const input = parse(listInput, context.req.query())
    const { page, ...filter } = input
    return context.json(await listUsers(page, filter))
  })

  /** Wszystkie konta z filtrami (do CSV w przeglądarce); eksport trafia do dziennika. */
  .get('/users/export', async (context) => {
    const admin = context.get('admin')!
    const filter = parse(userFilterInput, context.req.query())
    return context.json(await exportUsers(admin, filter))
  })

  /** Szczegóły konta: dane, bezpieczeństwo, zalogowane urządzenia i płatności. */
  .get('/users/:id', async (context) => {
    const user = await findUser(context.req.param('id'))
    return context.json(await getUserDetail(user))
  })

  /** Zmiana planu, roli albo blokada. Każda zmiana osobno w dzienniku. */
  .patch('/users/:id', async (context) => {
    const admin = context.get('admin')!
    const user = await findUser(context.req.param('id'))
    const input = await body(context, patchInput)
    const self = user.id === admin.id
    const changesOwnAccess =
      self && (input.role !== undefined || input.disabled !== undefined)
    if (changesOwnAccess) throw new ApiError('admin.self', 400)
    const changesDemoAccount =
      user.isDemo && (input.plan !== undefined || input.role !== undefined)
    if (changesDemoAccount) throw invalid()
    // Właściciela (ADMIN_EMAILS) nie da się zdegradować ani zablokować z panelu.
    const demotesOwner =
      isOwner(user) && (input.role === 'client' || input.disabled === true)
    if (demotesOwner) throw new ApiError('admin.owner', 400)
    return context.json(await changeUser(admin, user, input))
  })

  /** Wylogowanie ze wszystkich urządzeń (np. po zgłoszeniu przejęcia konta). */
  .post('/users/:id/revoke-sessions', async (context) => {
    const admin = context.get('admin')!
    const user = await findUser(context.req.param('id'))
    await revokeUserSessions(admin, user)
    return context.body(null, 204)
  })

  /**
   * Usunięcie konta z danymi: najpierw koniec subskrypcji w Stripe, potem ON DELETE CASCADE.
   * Wymaga przepisania adresu konta.
   */
  .delete('/users/:id', async (context) => {
    const admin = context.get('admin')!
    const user = await findUser(context.req.param('id'))
    const isSelf = user.id === admin.id
    if (isSelf) throw new ApiError('admin.self', 400)
    const isOwnerAccount = isOwner(user)
    if (isOwnerAccount) throw new ApiError('admin.owner', 400)
    const input = await body(context, deleteInput)
    const isEmailMismatch =
      input.confirmEmail.toLowerCase() !== user.email.toLowerCase()
    if (isEmailMismatch)
      throw new ApiError('admin.confirm_email', 400, 'confirmEmail')
    await deleteUser(admin, user)
    return context.body(null, 204)
  })
