import { absoluteUrl, site } from '#/config/site'
import { localeTags } from '#/i18n/config'
import { getLocale } from '#/i18n/locale'
import { commonMessages } from '#/i18n/messages/common'

interface SeoInput {
  title: string
  description?: string
  /** Ścieżka strony, np. "/pricing" — z niej powstaje canonical i og:url. */
  path: string
  image?: string
  type?: 'website' | 'article'
  /** Strony, które nie powinny trafiać do Google (logowanie, panel). */
  noindex?: boolean
  /** Dane strukturalne schema.org (JSON-LD). */
  jsonLd?: ReadonlyArray<Record<string, unknown>>
}

/**
 * Komplet tagów SEO dla jednej strony: title, description, canonical,
 * Open Graph, Twitter Card, robots i JSON-LD. Używane w `head` każdej trasy.
 */
export function seo({
  title,
  description,
  path,
  image,
  type = 'website',
  noindex = false,
  jsonLd = [],
}: SeoInput) {
  const locale = getLocale()
  image ??= locale === 'pl' ? site.ogImagePl : site.ogImage
  const common = commonMessages[locale]
  const pageDescription = description ?? common.seo.description
  const url = absoluteUrl(path)
  const imageUrl = absoluteUrl(image)

  return {
    meta: [
      { title },
      { name: 'description', content: pageDescription },
      {
        name: 'robots',
        content: noindex
          ? 'noindex, nofollow'
          : 'index, follow, max-image-preview:large',
      },
      { property: 'og:site_name', content: site.name },
      { property: 'og:locale', content: localeTags[locale].replace('-', '_') },
      { property: 'og:type', content: type },
      { property: 'og:title', content: title },
      { property: 'og:description', content: pageDescription },
      { property: 'og:url', content: url },
      { property: 'og:image', content: imageUrl },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: common.seo.ogAlt },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: pageDescription },
      { name: 'twitter:image', content: imageUrl },
    ],
    links: noindex ? [] : [{ rel: 'canonical', href: url }],
    scripts: jsonLd.map((data) => ({
      type: 'application/ld+json',
      children: JSON.stringify(data),
    })),
  }
}
