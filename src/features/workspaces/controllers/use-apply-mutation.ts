import { useCallback } from 'react'
import type { QueryKey } from '@tanstack/react-query'
import { useMessages } from '#/i18n/context'
import { workspacesMessages } from '#/i18n/messages/workspaces'
import type { ApplyTo, R } from '#/shared/data/http'
import { useDataMutation } from '#/shared/data/mutations'
import type { ApplyKind } from '../domain/workspaces'
import { useApplyTarget } from './apply-scope'

interface Applied<TVars> {
  vars: TVars
  apply: ApplyTo
}

/** Wywołanie zwrotne jednego `mutate` (jak w TanStack Query). */
export interface MutateCallbacks<TVars, TData> {
  onSuccess?: (data: TData, vars: TVars) => void
}

export interface ApplyMutationOptions<TVars, TData> {
  invalidate: ReadonlyArray<QueryKey>
  success?: string | ((data: TData, vars: TVars) => string)
  onSuccess?: (data: TData, vars: TVars) => void
  /** Czy ta zmiana w ogóle dotyczy rzeczy z przestrzeni (np. sam język: nie pytamy). */
  asks?: (vars: TVars) => boolean
}

/**
 * Mutacja zmiany, która może trafić do wszystkich przestrzeni (dni wolne, sprinty, rodzaje
 * pracy…). `mutate` najpierw ustala, gdzie ją zastosować (zapamiętany wybór albo pytanie),
 * a anulowane pytanie nic nie zapisuje. Komunikat po zapisie mówi, gdy zmiana poszła wszędzie.
 */
export function useApplyMutation<TVars, TData>(
  kind: ApplyKind,
  fn: (vars: TVars, apply: ApplyTo) => R<TData>,
  options: ApplyMutationOptions<TVars, TData>,
) {
  const t = useMessages(workspacesMessages).apply
  const target = useApplyTarget()
  const { success, onSuccess, asks } = options
  const inner = useDataMutation(
    ({ vars, apply }: Applied<TVars>) => fn(vars, apply),
    {
      invalidate: options.invalidate,
      success: success
        ? (data, v) => {
            const text =
              typeof success === 'function' ? success(data, v.vars) : success
            return v.apply === 'all' ? `${text} ${t.suffix}` : text
          }
        : undefined,
      onSuccess: onSuccess ? (data, v) => onSuccess(data, v.vars) : undefined,
    },
  )
  const { mutate: run, mutateAsync: runAsync } = inner
  const resolve = useCallback(
    async (vars: TVars) =>
      asks && !asks(vars) ? ('this' as const) : target(kind),
    [asks, target, kind],
  )
  const mutate = useCallback(
    (vars: TVars, call?: MutateCallbacks<TVars, TData>) => {
      void resolve(vars).then((apply) => {
        if (!apply) return
        run(
          { vars, apply },
          call?.onSuccess
            ? { onSuccess: (data) => call.onSuccess?.(data, vars) }
            : undefined,
        )
      })
    },
    [resolve, run],
  )
  const mutateAsync = useCallback(
    async (vars: TVars) => {
      const apply = await resolve(vars)
      return apply ? runAsync({ vars, apply }) : undefined
    },
    [resolve, runAsync],
  )
  return {
    isPending: inner.isPending,
    isSuccess: inner.isSuccess,
    error: inner.error,
    reset: inner.reset,
    mutate,
    mutateAsync,
  }
}
