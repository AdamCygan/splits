import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { data } from '#/data'
import type { R } from '#/data/source'
import { ApiError, unwrap } from '#/lib/api-client'
import { useErrorText } from '#/lib/use-error-text'

/** Klucze zapytań — jedno źródło, żeby mutacje unieważniały właściwe dane. */
export const keys = {
  me: ['me'],
  settings: ['settings'],
  scale: ['sp-scale'],
  taskTypes: ['task-types'],
  statuses: ['task-statuses'],
  cadence: ['sprint-cadence'],
  sprints: ['sprints'],
  projects: ['projects'],
  tags: ['tags'],
  templates: ['quick-templates'],
  daysOff: ['days-off'],
  security: ['security'],
  sessions: ['sessions'],
  invoices: ['invoices'],
} as const satisfies Record<string, QueryKey>

export const meQuery = queryOptions({
  queryKey: keys.me,
  queryFn: () => unwrap(data.account.me()),
})
export const securityQuery = queryOptions({
  queryKey: keys.security,
  queryFn: () => unwrap(data.account.security()),
})
export const sessionsQuery = queryOptions({
  queryKey: keys.sessions,
  queryFn: () => unwrap(data.account.sessions()),
})
export const invoicesQuery = queryOptions({
  queryKey: keys.invoices,
  queryFn: () => unwrap(data.billing.invoices()),
})
export const settingsQuery = queryOptions({
  queryKey: keys.settings,
  queryFn: () => unwrap(data.settings.get()),
})
export const scaleQuery = queryOptions({
  queryKey: keys.scale,
  queryFn: () => unwrap(data.spScale.get()),
})
export const taskTypesQuery = queryOptions({
  queryKey: keys.taskTypes,
  queryFn: () => unwrap(data.taskTypes.list()),
})
export const statusesQuery = queryOptions({
  queryKey: keys.statuses,
  queryFn: () => unwrap(data.statuses.list()),
})
export const cadenceQuery = queryOptions({
  queryKey: keys.cadence,
  queryFn: () => unwrap(data.sprints.getCadence()),
})
export const sprintsQuery = queryOptions({
  queryKey: keys.sprints,
  queryFn: () => unwrap(data.sprints.list()),
})
/** Dni wolne w zakresie dat (urlop, L4, święta). */
export const daysOffQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: [...keys.daysOff, from, to],
    queryFn: () => unwrap(data.daysOff.list(from, to)),
  })
export const projectsQuery = queryOptions({
  queryKey: keys.projects,
  queryFn: () => unwrap(data.projects.list()),
})
export const tagsQuery = queryOptions({
  queryKey: keys.tags,
  queryFn: () => unwrap(data.tags.list()),
})
export const templatesQuery = queryOptions({
  queryKey: keys.templates,
  queryFn: () => unwrap(data.templates.list()),
})

interface MutationOptions<TVars, TData> {
  /** Które dane odświeżyć po sukcesie. */
  invalidate: ReadonlyArray<QueryKey>
  /** Komunikat po sukcesie (toast, ogłaszany też czytnikom ekranu). */
  success?: string | ((data: TData, vars: TVars) => string)
  onSuccess?: (data: TData, vars: TVars) => void
}

/**
 * Mutacja na warstwie danych: Result → wyjątek dla TanStack Query, odświeżenie danych,
 * toast z potwierdzeniem. Błędy pól (fieldErrors) zostają dla formularza; inne błędy dostają toast.
 */
export function useDataMutation<TVars, TData>(
  fn: (vars: TVars) => R<TData>,
  options: MutationOptions<TVars, TData>,
) {
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  return useMutation({
    mutationFn: (vars: TVars) => unwrap(fn(vars)),
    onSuccess: async (result, vars) => {
      await Promise.all(
        options.invalidate.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      )
      const message =
        typeof options.success === 'function'
          ? options.success(result, vars)
          : options.success
      if (message) toast.success(message)
      options.onSuccess?.(result, vars)
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
