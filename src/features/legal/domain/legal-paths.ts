import { accessibilityDoc } from './accessibility'
import { cookiesDoc } from './cookies'
import { privacyDoc } from './privacy'
import { termsDoc } from './terms'
import type { LegalDocId } from './types'
import { LEGAL_PLACEHOLDERS } from '#/config/legal'

export const legalDocs = {
  terms: termsDoc,
  privacy: privacyDoc,
  cookies: cookiesDoc,
  accessibility: accessibilityDoc,
} as const

export const legalPaths: Record<
  LegalDocId,
  '/terms' | '/privacy' | '/cookies' | '/accessibility'
> = {
  terms: '/terms',
  privacy: '/privacy',
  cookies: '/cookies',
  accessibility: '/accessibility',
}

/** {pole} → wartość z config/legal.ts; {date} = data wejścia w życie w języku strony. */
export function fillLegal(text: string, date: string) {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key === 'date'
      ? date
      : ((LEGAL_PLACEHOLDERS as Record<string, string>)[key] ?? match),
  )
}
