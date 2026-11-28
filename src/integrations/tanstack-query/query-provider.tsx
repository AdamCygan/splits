import { Suspense, lazy, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * TanStack Query tylko dla panelu /app. Landing nie pobiera danych z API,
 * więc nie ładuje tej biblioteki (mniej JS = szybsza strona główna).
 */
const QueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((devtoolsModule) => ({
        default: devtoolsModule.ReactQueryDevtools,
      })),
    )
  : () => null

export interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      {children}
      <Suspense>
        <QueryDevtools buttonPosition="bottom-left" />
      </Suspense>
    </QueryClientProvider>
  )
}
