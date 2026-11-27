import { createFileRoute } from '@tanstack/react-router'
import { absoluteUrl, site } from '#/config/site'

/** RFC 9116: data ważności co najwyżej rok naprzód; liczona przy każdym żądaniu. */
const DAYS_VALID = 180

/** Treść security.txt: kontakt w sprawie podatności (adres z site.supportEmail). */
export function securityTxt(now: Date, contactEmail: string) {
  const expires = new Date(now.getTime() + DAYS_VALID * 86_400_000)
  return [
    `Contact: mailto:${contactEmail}`,
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    'Preferred-Languages: en, pl',
    `Canonical: ${absoluteUrl('/.well-known/security.txt')}`,
    `Policy: https://github.com/AdamCygan/splits/security/policy`,
    '',
  ].join('\n')
}

export const Route = createFileRoute('/.well-known/security.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(securityTxt(new Date(), site.supportEmail), {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
          },
        }),
    },
  },
})
