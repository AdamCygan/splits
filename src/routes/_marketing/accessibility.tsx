import { createFileRoute } from '@tanstack/react-router'
import { fillLegal, legalDocs } from '#/features/legal/domain/legal-paths'
import { LegalPage } from '#/features/legal/views/legal-page'
import { getLocale } from '#/i18n/locale'
import { seo } from '#/lib/seo'
import { site } from '#/config/site'

export const Route = createFileRoute('/_marketing/accessibility')({
  head: () => {
    const legalDocument = legalDocs.accessibility[getLocale()]
    return seo({
      title: `${legalDocument.title} | ${site.name}`,
      description: fillLegal(legalDocument.summary, ''),
      path: '/accessibility',
    })
  },
  component: () => <LegalPage id="accessibility" />,
})
