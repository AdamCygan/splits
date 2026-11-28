import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { appApi } from '#/features/app/data/api'
import { primeCache } from '#/features/app/data/bootstrap'
import { useCurrentUser } from '#/features/auth/data/session'
import { FREE_LIMITS, hasProAccess } from '#/features/billing/domain/plans'
import { settingsQuery } from '#/features/settings/data/queries'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { workspacesMessages } from '#/i18n/messages/workspaces'
import { unwrap } from '#/lib/api-client'
import { useErrorText } from '#/lib/use-error-text'
import { useDataMutation } from '#/shared/data/mutations'
import { todayIn } from '#/shared/domain/dates'
import { workspacesApi } from '../data/api'
import type {
  Workspace,
  WorkspaceCreateInput,
  WorkspaceInput,
  WorkspacePrefs,
  WorkspaceState,
} from '../data/dto'
import {
  runningElsewhereQuery,
  workspaceKeys,
  workspacesQuery,
} from '../data/queries'
import { runningQuery } from '#/features/time-entries/data/queries'
import {
  shouldAskToday,
  workspaceForDigit,
  workspaceShortcut,
} from '../domain/workspaces'
import type { CopyKind } from '../domain/workspaces'

/** Klucze, które przeżywają zmianę przestrzeni (konto i sam start panelu). */
const KEEP = new Set(['me', 'bootstrap', 'workspaces'])
const CHANNEL = 'timeblame:workspace'
const PICKED_KEY = 'tb:workspace-picked-on'

/** Przestrzenie konta i bieżąca (z /bootstrap, bez osobnego żądania). */
export function useWorkspaces() {
  const { data } = useQuery(workspacesQuery)
  const items = data?.items ?? []
  const current = items.find((w) => w.id === data?.current) ?? items[0] ?? null
  const isPro = hasProAccess(useCurrentUser())
  return {
    state: data ?? null,
    items,
    current,
    prefs: data?.prefs ?? { apply: {}, askDaily: true },
    /** Plan Free ma jedną przestrzeń: nowa prowadzi do planu Pro. */
    canCreate: isPro || items.length < FREE_LIMITS.workspaces,
    shortcutOf: (id: string) =>
      workspaceShortcut(items.findIndex((w) => w.id === id)),
  }
}

/**
 * Po zmianie przestrzeni: dane poprzedniej znikają z pamięci, a start panelu (/bootstrap)
 * wypełnia ją danymi nowej. Ekrany przerysowują się (klucz = id przestrzeni w układzie panelu).
 */
async function loadWorkspace(client: QueryClient, state: WorkspaceState) {
  await client.cancelQueries()
  client.removeQueries({
    predicate: (q) => !KEEP.has(String(q.queryKey[0])),
  })
  const boot = await appApi.bootstrap()
  if (boot.ok) primeCache(client, boot.value)
  client.setQueryData(workspaceKeys.state, state)
}

function markPicked(day: string) {
  try {
    localStorage.setItem(PICKED_KEY, day)
  } catch {
    // Bez localStorage (tryb prywatny): zapytamy przy następnym wejściu.
  }
}

function pickedOn() {
  try {
    return localStorage.getItem(PICKED_KEY)
  } catch {
    return null
  }
}

function useToday() {
  const { data } = useQuery(settingsQuery)
  return todayIn(data?.timezone)
}

/** Przełączenie przestrzeni (menu, skrót, paleta, okno na start dnia). */
export function useSwitchWorkspace() {
  const client = useQueryClient()
  const t = useMessages(workspacesMessages)
  const errorText = useErrorText()
  const today = useToday()
  return useCallback(
    async (workspace: Workspace) => {
      markPicked(today)
      const current = client.getQueryData<WorkspaceState>(workspaceKeys.state)
      if (current?.current === workspace.id) return true
      const result = await workspacesApi.setCurrent(workspace.id)
      if (!result.ok) {
        toast.error(errorText(result.error))
        return false
      }
      await loadWorkspace(client, result.value)
      broadcast(workspace.id)
      toast.success(fmt(t.switched, { name: workspace.name }))
      return true
    },
    [client, errorText, t.switched, today],
  )
}

function broadcast(id: string) {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(CHANNEL)
  channel.postMessage({ id })
  channel.close()
}

/**
 * Inna karta tej przeglądarki zmieniła przestrzeń (ciasteczko jest wspólne): ta karta też
 * przechodzi na nią, żeby nie zapisać czegoś w złej przestrzeni.
 */
export function useWorkspaceTabsSync() {
  const client = useQueryClient()
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = () => {
      void unwrap(workspacesApi.state()).then((state) =>
        loadWorkspace(client, state),
      )
    }
    return () => channel.close()
  }, [client])
}

/** Alt+Shift+1…9: przełącza na przestrzeń o tym numerze na liście. */
export function useWorkspaceShortcuts() {
  const { items } = useWorkspaces()
  const switchTo = useSwitchWorkspace()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return
      const match = /^Digit([1-9])$/.exec(e.code)
      if (!match) return
      const target = workspaceForDigit(items, Number(match[1]))
      if (!target) return
      e.preventDefault()
      void switchTo(target)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, switchTo])
}

/**
 * Okno „W czym dziś pracujesz?”: przy pierwszym wejściu danego dnia, gdy są co najmniej
 * dwie przestrzenie i użytkownik tego nie wyłączył.
 */
export function useDailyPicker() {
  const { items, current, prefs } = useWorkspaces()
  const today = useToday()
  const switchTo = useSwitchWorkspace()
  const savePrefs = useSavePrefs()
  const [dismissed, setDismissed] = useState(false)
  const [dontAsk, setDontAsk] = useState(false)
  const open =
    !dismissed &&
    shouldAskToday({
      workspaceCount: items.length,
      askDaily: prefs.askDaily,
      pickedOn: pickedOn(),
      today,
    })
  const finish = () => {
    markPicked(today)
    setDismissed(true)
    if (dontAsk) savePrefs.mutate({ askDaily: false })
  }
  return {
    open,
    items,
    current,
    dontAsk,
    setDontAsk,
    pick: (workspace: Workspace) => {
      finish()
      void switchTo(workspace)
    },
    close: finish,
  }
}

export function useSavePrefs() {
  const client = useQueryClient()
  return useDataMutation(
    (input: Partial<WorkspacePrefs>) => workspacesApi.prefs(input),
    {
      invalidate: [],
      onSuccess: (state) => client.setQueryData(workspaceKeys.state, state),
    },
  )
}

/** Akcje strony Ustawienia → Przestrzenie. */
interface WorkspaceUpdate {
  id: string
  input: WorkspaceInput
}

interface WorkspaceCopy {
  to: Workspace
  from: string
  kinds: Array<CopyKind>
}

export function useWorkspaceActions() {
  const t = useMessages(workspacesMessages).settings
  const client = useQueryClient()
  const switchTo = useSwitchWorkspace()
  const { items, current } = useWorkspaces()
  const refresh = [workspaceKeys.state]

  const create = useDataMutation(
    (input: WorkspaceCreateInput) => workspacesApi.create(input),
    {
      invalidate: refresh,
      success: (w) => fmt(t.created, { name: w.name }),
    },
  )
  const update = useDataMutation(
    ({ id, input }: WorkspaceUpdate) => workspacesApi.update(id, input),
    { invalidate: refresh, success: t.saved },
  )
  const remove = useDataMutation(
    (workspace: Workspace) => workspacesApi.remove(workspace.id),
    {
      invalidate: [],
      success: (_r, w) => fmt(t.deleted, { name: w.name }),
      onSuccess: (_r, w) => {
        // Usunięta była bieżąca: serwer wraca do pierwszej, więc ładujemy ją od nowa.
        if (w.id === current?.id)
          void unwrap(workspacesApi.state()).then((state) =>
            loadWorkspace(client, state),
          )
        else void client.invalidateQueries({ queryKey: workspaceKeys.state })
      },
    },
  )
  const reorder = useDataMutation(
    (ids: Array<string>) => workspacesApi.reorder(ids),
    { invalidate: refresh },
  )
  const copy = useDataMutation(
    ({ to, from, kinds }: WorkspaceCopy) =>
      workspacesApi.copy(to.id, { from, copy: kinds }),
    {
      invalidate: [],
      success: (_r, v) => fmt(t.copied, { name: v.to.name }),
      onSuccess: (_r, v) => {
        // Kopia do bieżącej przestrzeni: odświeżamy jej dane.
        if (v.to.id === current?.id) {
          const state = client.getQueryData<WorkspaceState>(workspaceKeys.state)
          if (state) void loadWorkspace(client, state)
        }
      },
    },
  )
  const move = (id: string, delta: -1 | 1) => {
    const ids = items.map((w) => w.id)
    const from = ids.indexOf(id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= ids.length) return
    ids.splice(to, 0, ...ids.splice(from, 1))
    reorder.mutate(ids)
  }
  return { create, update, remove, copy, move, switchTo }
}

/**
 * Timer z innej przestrzeni (jeden timer na konto): jego przestrzeń, wpis i przejście tam.
 * null, gdy timera nie ma albo właśnie ruszył timer w bieżącej przestrzeni.
 */
export function useRunningElsewhere() {
  const { items } = useWorkspaces()
  const switchTo = useSwitchWorkspace()
  const elsewhere = useQuery(runningElsewhereQuery).data ?? null
  const runningHere = useQuery(runningQuery).data
  const workspace = items.find((w) => w.id === elsewhere?.workspaceId)
  if (!elsewhere || !workspace || runningHere) return null
  return {
    workspace,
    entry: elsewhere.entry,
    go: () => void switchTo(workspace),
  }
}
