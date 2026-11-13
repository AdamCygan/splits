import { TanStackDevtools } from '@tanstack/react-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

/**
 * Devtools tylko w trybie deweloperskim — ładowane leniwie z __root.tsx, nie trafiają do produkcji.
 * Devtools TanStack Query są w QueryProvider (panel /app), bo tylko tam działa Query.
 */
export default function Devtools() {
  return (
    <TanStackDevtools
      config={{ position: 'bottom-right' }}
      plugins={[
        { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
      ]}
    />
  )
}
