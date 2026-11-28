import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { WORKSPACE_COOKIE } from '#/features/workspaces/domain/workspaces'
import type { AppEnv } from '#/server/http/context'
import { serverEnv } from '#/server/env'
import { body, idsInput } from '#/server/http/inputs'
import { scopeOf } from '#/server/http/scope'
import {
  currentInput,
  prefsInput,
  workspaceCopyInput,
  workspaceCreateInput,
  workspaceInput,
} from '../data/inputs.server'
import {
  assertOwnWorkspace,
  copyToWorkspace,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceState,
  reorderWorkspaces,
  updatePrefs,
  updateWorkspace,
} from '../data/repository.server'

/** Ciasteczko bieżącej przestrzeni: tylko dla serwera, ważne rok (każda przeglądarka osobno). */
const remember = (context: Parameters<typeof setCookie>[0], id: string) =>
  setCookie(context, WORKSPACE_COOKIE, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: serverEnv.isProduction,
    maxAge: 60 * 60 * 24 * 365,
  })

export const workspaceRoutes = new Hono<AppEnv>()
  .get('/', async (context) =>
    context.json(await getWorkspaceState(scopeOf(context))),
  )
  .post('/', async (context) => {
    const input = await body(context, workspaceCreateInput)
    return context.json(
      await createWorkspace(context.get('userId'), input),
      201,
    )
  })
  /** Przełączenie: następne żądania tej przeglądarki dotyczą wybranej przestrzeni. */
  .put('/current', async (context) => {
    const { id } = await body(context, currentInput)
    await assertOwnWorkspace(context.get('userId'), id)
    remember(context, id)
    return context.json(
      await getWorkspaceState({
        userId: context.get('userId'),
        workspaceId: id,
      }),
    )
  })
  .put('/order', async (context) => {
    const { ids } = await body(context, idsInput)
    return context.json(await reorderWorkspaces(context.get('userId'), ids))
  })
  .put('/prefs', async (context) => {
    const input = await body(context, prefsInput)
    await updatePrefs(context.get('userId'), input)
    return context.json(await getWorkspaceState(scopeOf(context)))
  })
  .put('/:id', async (context) => {
    const input = await body(context, workspaceInput)
    return context.json(
      await updateWorkspace(
        context.get('userId'),
        context.req.param('id'),
        input,
      ),
    )
  })
  /** Kopiuje wybrane rzeczy z innej przestrzeni do tej (łączy z tym, co już jest). */
  .post('/:id/copy', async (context) => {
    const input = await body(context, workspaceCopyInput)
    await copyToWorkspace(
      context.get('userId'),
      context.req.param('id'),
      input.from,
      input.copy,
    )
    return context.body(null, 204)
  })
  .delete('/:id', async (context) => {
    await deleteWorkspace(context.get('userId'), context.req.param('id'))
    return context.body(null, 204)
  })
