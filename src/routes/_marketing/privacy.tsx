import { createFileRoute } from '@tanstack/react-router'
import { fillLegal, LegalPage, legalDocs } from '#/features/legal/legal-page'
import { getLocale } from '#/i18n/locale'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/_marketing/privacy')({
  head: () => {
    const doc = legalDocs.privacy[getLocale()]
    return seo({
      title: `${doc.title} | Pointhours`,
      description: fillLegal(doc.summary, ''),
      path: '/privacy',
    })
  },
  component: () => <LegalPage id="privacy" />,
})
