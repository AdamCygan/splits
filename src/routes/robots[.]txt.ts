import { createFileRoute } from '@tanstack/react-router'
import { absoluteUrl } from '#/config/site'

/** /robots.txt — panel i ekrany logowania poza indeksem, adres sitemapy z VITE_APP_URL. */
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(
          [
            'User-agent: *',
            'Allow: /',
            'Disallow: /app',
            'Disallow: /login',
            'Disallow: /forgot-password',
            '',
            `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
            '',
          ].join('\n'),
          {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
            },
          },
        ),
    },
  },
})
