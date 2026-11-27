import { createFileRoute } from '@tanstack/react-router'
import { absoluteUrl } from '#/config/site'

/** Publiczne strony do indeksowania. Nowa strona marketingowa = nowy wpis tutaj. */
const pages: ReadonlyArray<{
  path: string
  priority: string
  changefreq: string
}> = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/pricing', priority: '0.8', changefreq: 'monthly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/cookies', priority: '0.3', changefreq: 'yearly' },
  { path: '/accessibility', priority: '0.3', changefreq: 'monthly' },
  { path: '/register', priority: '0.6', changefreq: 'yearly' },
]

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => {
        const urls = pages
          .map(
            (p) =>
              `  <url><loc>${absoluteUrl(p.path)}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`,
          )
          .join('\n')
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
          {
            headers: {
              'Content-Type': 'application/xml; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
            },
          },
        )
      },
    },
  },
})
