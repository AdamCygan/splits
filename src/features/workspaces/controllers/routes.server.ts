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
const remember = (c: Parameters<typeof setCookie>[0], id: string) =>
  setCookie(c, WORKSPACE_COOKIE, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: serverEnv.isProduction,
    maxAge: 60 * 60 * 24 * 365,
  })

export const workspaceRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await getWorkspaceState(scopeOf(c))))
  .post('/', async (c) => {
    const input = await body(c, workspaceCreateInput)
    return c.json(await createWorkspace(c.get('userId'), input), 201)
  })
  /** Przełączenie: następne żądania tej przeglądarki dotyczą wybranej przestrzeni. */
  .put('/current', async (c) => {
    const { id } = await body(c, currentInput)
    await assertOwnWorkspace(c.get('userId'), id)
    remember(c, id)
    return c.json(
      await getWorkspaceState({ userId: c.get('userId'), workspaceId: id }),
    )
  })
  .put('/order', async (c) => {
    const { ids } = await body(c, idsInput)
    return c.json(await reorderWorkspaces(c.get('userId'), ids))
  })
  .put('/prefs', async (c) => {
    const input = await body(c, prefsInput)
    await updatePrefs(c.get('userId'), input)
    return c.json(await getWorkspaceState(scopeOf(c)))
  })
  .put('/:id', async (c) => {
    const input = await body(c, workspaceInput)
    return c.json(
      await updateWorkspace(c.get('userId'), c.req.param('id'), input),
    )
  })
  /** Kopiuje wybrane rzeczy z innej przestrzeni do tej (łączy z tym, co już jest). */
  .post('/:id/copy', async (c) => {
    const input = await body(c, workspaceCopyInput)
    await copyToWorkspace(
      c.get('userId'),
      c.req.param('id'),
      input.from,
      input.copy,
    )
    return c.body(null, 204)
  })
  .delete('/:id', async (c) => {
    await deleteWorkspace(c.get('userId'), c.req.param('id'))
    return c.body(null, 204)
  })
