import { createFileRoute } from '@tanstack/react-router'
import { fillLegal, legalDocs } from '#/features/legal/domain/legal-paths'
import { LegalPage } from '#/features/legal/views/legal-page'
import { getLocale } from '#/i18n/locale'
import { seo } from '#/lib/seo'
import { site } from '#/config/site'

export const Route = createFileRoute('/_marketing/cookies')({
  head: () => {
    const doc = legalDocs.cookies[getLocale()]
    return seo({
      title: `${doc.title} | ${site.name}`,
      description: fillLegal(doc.summary, ''),
      path: '/cookies',
    })
  },
  component: () => <LegalPage id="cookies" />,
})
