import { useCallback } from 'react'
import type { QueryKey } from '@tanstack/react-query'
import { useMessages } from '#/i18n/context'
import { workspacesMessages } from '#/i18n/messages/workspaces'
import type { ApplyTo, R } from '#/shared/data/http'
import { useDataMutation } from '#/shared/data/mutations'
import type { ApplyKind } from '../domain/workspaces'
import { useApplyTarget } from './apply-scope'

interface Applied<TVars> {
  variables: TVars
  apply: ApplyTo
}

/** Wywołanie zwrotne jednego `mutate` (jak w TanStack Query). */
export interface MutateCallbacks<TVars, TData> {
  onSuccess?: (data: TData, variables: TVars) => void
}

export interface ApplyMutationOptions<TVars, TData> {
  invalidate: ReadonlyArray<QueryKey>
  success?: string | ((data: TData, variables: TVars) => string)
  onSuccess?: (data: TData, variables: TVars) => void
  /** Czy ta zmiana w ogóle dotyczy rzeczy z przestrzeni (np. sam język: nie pytamy). */
  asks?: (variables: TVars) => boolean
}

/**
 * Mutacja zmiany, która może trafić do wszystkich przestrzeni (dni wolne, sprinty, rodzaje
 * pracy…). `mutate` najpierw ustala, gdzie ją zastosować (zapamiętany wybór albo pytanie),
 * a anulowane pytanie nic nie zapisuje. Komunikat po zapisie mówi, gdy zmiana poszła wszędzie.
 */
export function useApplyMutation<TVars, TData>(
  kind: ApplyKind,
  callback: (variables: TVars, apply: ApplyTo) => R<TData>,
  options: ApplyMutationOptions<TVars, TData>,
) {
  const messages = useMessages(workspacesMessages).apply
  const target = useApplyTarget()
  const { success, onSuccess, asks } = options
  const inner = useDataMutation(
    ({ variables, apply }: Applied<TVars>) => callback(variables, apply),
    {
      invalidate: options.invalidate,
      success: success
        ? (data, applied) => {
            const text =
              typeof success === 'function'
                ? success(data, applied.variables)
                : success
            return applied.apply === 'all' ? `${text} ${messages.suffix}` : text
          }
        : undefined,
      onSuccess: onSuccess
        ? (data, applied) => onSuccess(data, applied.variables)
        : undefined,
    },
  )
  const { mutate: run, mutateAsync: runAsync } = inner
  const resolve = useCallback(
    async (variables: TVars) =>
      asks && !asks(variables) ? ('this' as const) : target(kind),
    [asks, target, kind],
  )
  const mutate = useCallback(
    (variables: TVars, call?: MutateCallbacks<TVars, TData>) => {
      void resolve(variables).then((apply) => {
        if (!apply) return
        run(
          { variables, apply },
          call?.onSuccess
            ? { onSuccess: (data) => call.onSuccess?.(data, variables) }
            : undefined,
        )
      })
    },
    [resolve, run],
  )
  const mutateAsync = useCallback(
    async (variables: TVars) => {
      const apply = await resolve(variables)
      return apply ? runAsync({ variables, apply }) : undefined
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
