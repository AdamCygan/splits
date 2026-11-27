import { createFileRoute } from '@tanstack/react-router'
import { fillLegal, LegalPage, legalDocs } from '#/features/legal/legal-page'
import { getLocale } from '#/i18n/locale'
import { seo } from '#/lib/seo'
import { site } from '#/config/site'

export const Route = createFileRoute('/_marketing/accessibility')({
  head: () => {
    const doc = legalDocs.accessibility[getLocale()]
    return seo({
      title: `${doc.title} | ${site.name}`,
      description: fillLegal(doc.summary, ''),
      path: '/accessibility',
    })
  },
  component: () => <LegalPage id="accessibility" />,
})
