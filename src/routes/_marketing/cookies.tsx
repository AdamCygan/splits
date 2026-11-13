import { createFileRoute } from '@tanstack/react-router'
import { fillLegal, LegalPage, legalDocs } from '#/features/legal/legal-page'
import { getLocale } from '#/i18n/locale'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/_marketing/cookies')({
  head: () => {
    const doc = legalDocs.cookies[getLocale()]
    return seo({
      title: `${doc.title} | Splits`,
      description: fillLegal(doc.summary, ''),
      path: '/cookies',
    })
  },
  component: () => <LegalPage id="cookies" />,
})
