/** Host adresu do krótkiego podpisu linku („jira.example.com”); „Link”, gdy adres jest zły. */
export function linkHost(link: string) {
  try {
    return new URL(link).hostname
  } catch {
    return 'Link'
  }
}

/** Podpis linku zadania: numer ticketu (PAY-142, !477), a bez niego host. */
export const linkLabel = (link: string, taskKey: string | null | undefined) =>
  taskKey ?? linkHost(link)
