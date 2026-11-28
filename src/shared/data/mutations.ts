import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { ApiError, unwrap } from '#/lib/api-client'
import { useErrorText } from '#/lib/use-error-text'
import type { R } from '#/shared/data/http'
import { toast } from 'sonner'

interface MutationOptions<TVars, TData> {
  /** Które dane odświeżyć po sukcesie. */
  invalidate: ReadonlyArray<QueryKey>
  /** Komunikat po sukcesie (toast, ogłaszany też czytnikom ekranu). */
  success?: string | ((data: TData, variables: TVars) => string)
  onSuccess?: (data: TData, variables: TVars) => void
}

/**
 * Mutacja na warstwie danych: Result → wyjątek dla TanStack Query, odświeżenie danych,
 * toast z potwierdzeniem. Błędy pól (fieldErrors) zostają dla formularza; inne błędy dostają toast.
 */
export function useDataMutation<TVars, TData>(
  callback: (variables: TVars) => R<TData>,
  options: MutationOptions<TVars, TData>,
) {
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  return useMutation({
    mutationFn: (variables: TVars) => unwrap(callback(variables)),
    onSuccess: async (result, variables) => {
      await Promise.all(
        options.invalidate.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      )
      const message =
        typeof options.success === 'function'
          ? options.success(result, variables)
          : options.success
      if (message) toast.success(message)
      options.onSuccess?.(result, variables)
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        Object.keys(error.details.fieldErrors).length > 0
      )
        return
      toast.error(
        error instanceof ApiError ? errorText(error.details) : String(error),
      )
    },
  })
}

/** Błąd konkretnego pola z nieudanej mutacji (do wyświetlenia pod polem). */
export function mutationFieldError(
  error: unknown,
  field: string,
): string | null {
  if (!(error instanceof ApiError)) return null
  const entry = Object.entries(error.details.fieldErrors).find(
    ([key]) => key.toLowerCase() === field.toLowerCase(),
  )
  return entry?.[1][0] ?? null
}
