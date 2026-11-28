import { legal } from './legal'
import { site } from './site'

/**
 * Co jeszcze blokuje publiczny start: placeholdery w danych firmy i przykładowe adresy e-mail.
 * Dokumenty prawne pokazują te wartości dosłownie, a Stripe sprawdza dane sprzedawcy na stronie.
 */
export interface LaunchInput {
  legal: {
    operator: { name: string; address: string; ids: string }
    email: { privacy: string }
    processors: { hosting: string; database: string; email: string }
  }
  supportEmail: string
  appUrl: string
}

export function launchProblems(
  input: LaunchInput = {
    legal,
    supportEmail: site.supportEmail,
    appUrl: site.url,
  },
): Array<string> {
  const problems: Array<string> = []
  const fields: Record<string, string> = {
    'legal.operator.name': input.legal.operator.name,
    'legal.operator.address': input.legal.operator.address,
    'legal.operator.ids': input.legal.operator.ids,
    'legal.processors.hosting': input.legal.processors.hosting,
    'legal.processors.database': input.legal.processors.database,
    'legal.processors.email': input.legal.processors.email,
  }
  for (const [name, value] of Object.entries(fields)) {
    const hasPlaceholder = /\[|…/.test(value)
    if (hasPlaceholder)
      problems.push(`${name} ma placeholder: „${value}” (src/config/legal.ts)`)
  }
  const emails: Record<string, string> = {
    'site.supportEmail': input.supportEmail,
    'legal.email.privacy': input.legal.email.privacy,
  }
  for (const [name, value] of Object.entries(emails)) {
    const isPlaceholderEmail =
      /@example\.(com|org|net)$/i.test(value) ||
      !/^[^@\s]+@[^@\s]+\.\w+$/.test(value)
    if (isPlaceholderEmail)
      problems.push(`${name} to przykładowy albo błędny adres: ${value}`)
  }
  const isLocalUrl = /localhost|127\.0\.0\.1/.test(input.appUrl)
  if (isLocalUrl)
    problems.push(
      `adres strony to ${input.appUrl}; ustaw VITE_APP_URL na domenę produkcyjną`,
    )
  return problems
}
